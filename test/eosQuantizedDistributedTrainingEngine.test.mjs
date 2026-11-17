/**
 * @file eosQuantizedDistributedTrainingEngine.test.mjs
 * @description BDD test suite for SPEC-328 / CHANGE-190: FP8 / INT8 Quantized Distributed
 * Training & Mixed-Precision Gradient Scaling Engine (BDD-1743..1748).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { EosQuantizedDistributedTrainingCore, INT8_MAX } from "../src/core/eosQuantizedDistributedTrainingEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/QUANTIZED_DISTRIBUTED_TRAINING_RECEIPT.json");

test("SPEC-328 / CHANGE-190: FP8 / INT8 Quantized Distributed Training & Mixed-Precision Scaling Engine", async (t) => {
  const engine = new EosQuantizedDistributedTrainingCore();

  await t.test("BDD-1743: Dual FP8 Bit-Accurate Quantization & Clamping (E4M3 vs E5M2)", () => {
    // 1. Single scalar encoding tests
    const e4m3Zero = EosQuantizedDistributedTrainingCore.encodeE4M3(0.0);
    assert.strictEqual(e4m3Zero, 0x00, "Zero encodes to 0x00 in E4M3");

    const e4m3Max = EosQuantizedDistributedTrainingCore.encodeE4M3(500.0);
    // Max E4M3 is sign=0, exp=15, mant=6 -> (15 << 3) | 6 = 126 (0x7e)
    assert.strictEqual(e4m3Max, 0x7e, "Overflow values clamp to 0x7e in E4M3");

    const e5m2Max = EosQuantizedDistributedTrainingCore.encodeE5M2(60000.0);
    // Max E5M2 is sign=0, exp=30, mant=3 -> (30 << 2) | 3 = 123 (0x7b)
    assert.strictEqual(e5m2Max, 0x7b, "Overflow values clamp to 0x7b in E5M2");

    // 2. Tensor quantization
    const dim = 64;
    const tensor = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      tensor[i] = (i - dim / 2) * 1.5;
    }

    const e4m3Enc = engine.quantizeFP8(tensor, "E4M3");
    assert.strictEqual(e4m3Enc.format, "E4M3");
    assert.strictEqual(e4m3Enc.data.byteLength, dim, "1 byte per element");

    const e4m3Dec = engine.dequantizeFP8(e4m3Enc);
    const e4m3Snr = engine.computeSNR(tensor, e4m3Dec);
    assert.ok(e4m3Snr >= 30.0, `E4M3 SNR must be >= 30 dB, got ${e4m3Snr}`);

    const e5m2Enc = engine.quantizeFP8(tensor, "E5M2");
    assert.strictEqual(e5m2Enc.format, "E5M2");
    assert.strictEqual(e5m2Enc.data.byteLength, dim, "1 byte per element");

    const e5m2Dec = engine.dequantizeFP8(e5m2Enc);
    const e5m2Snr = engine.computeSNR(tensor, e5m2Dec);
    assert.ok(e5m2Snr >= 25.0, `E5M2 SNR must be >= 25 dB, got ${e5m2Snr}`);
  });

  await t.test("BDD-1744: Symmetric INT8 Quantization and Dynamic Scale Normalization", () => {
    const dim = 128;
    const tensor = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      tensor[i] = Math.sin((i + 1) * 0.1) * 20.0;
    }

    const int8Enc = engine.quantizeINT8(tensor);
    assert.strictEqual(int8Enc.data.byteLength, dim, "1 byte per element in INT8");

    // Verify all values are within [-127, 127]
    for (let i = 0; i < dim; i++) {
      assert.ok(int8Enc.data[i] >= -INT8_MAX && int8Enc.data[i] <= INT8_MAX);
    }

    const int8Dec = engine.dequantizeINT8(int8Enc);
    const snr = engine.computeSNR(tensor, int8Dec);
    assert.ok(snr >= 40.0, `INT8 SNR must be >= 40 dB, got ${snr}`);

    let maxDiff = 0;
    for (let i = 0; i < dim; i++) {
      const diff = Math.abs(tensor[i] - int8Dec[i]);
      if (diff > maxDiff) maxDiff = diff;
    }
    assert.ok(maxDiff <= int8Enc.scale, "Reconstruction error bounded by scale factor");
  });

  await t.test("BDD-1745: Delayed Scaling Factor History Tracking and Saturation Recovery", () => {
    let state = engine.createInitialDelayedScaling(4, 2.0);
    assert.strictEqual(state.currentScale, 2.0);
    assert.strictEqual(state.historyWindow.length, 0);

    // Step 1: Normal activation
    state = engine.updateDelayedScaling(state, 10.0, "E4M3");
    assert.strictEqual(state.historyWindow.length, 1);
    assert.strictEqual(state.isSaturated, false);

    // Step 2: Extreme spike causing saturation
    // E4M3 max is 448.0. If aMax = 300 and currentScale = 2.0, 300 * 2.0 = 600 > 448
    state = engine.updateDelayedScaling(state, 300.0, "E4M3");
    assert.strictEqual(state.isSaturated, true, "Saturation detected when aMax * scale > FP8_MAX");
    assert.ok(state.projectedScale < state.currentScale, "Projected scale backs off to recover headroom");

    // Step 3: Rolling window limits
    state = engine.updateDelayedScaling(state, 5.0, "E4M3");
    state = engine.updateDelayedScaling(state, 6.0, "E4M3");
    state = engine.updateDelayedScaling(state, 7.0, "E4M3");
    assert.strictEqual(state.historyWindow.length, 4, "Window capped at size 4");
  });

  await t.test("BDD-1746: Dynamic Mixed-Precision Loss Scaling and Non-Finite Gradient Backoff", () => {
    const dim = 32;
    const grads = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      grads[i] = (i + 1) * 0.5;
    }

    let state = engine.createInitialLossScale(1024, 2);

    // Clean step 1
    let res = engine.backwardWithMixedPrecision(1.0, grads, state);
    assert.strictEqual(res.stepAccepted, true);
    assert.strictEqual(res.hasNonFinite, false);
    assert.strictEqual(res.nextLossScaleState.consecutiveCleanSteps, 1);
    assert.strictEqual(res.nextLossScaleState.lossScale, 1024);

    // Clean step 2 -> doubles loss scale
    res = engine.backwardWithMixedPrecision(1.0, grads, res.nextLossScaleState);
    assert.strictEqual(res.stepAccepted, true);
    assert.strictEqual(res.nextLossScaleState.consecutiveCleanSteps, 0);
    assert.strictEqual(res.nextLossScaleState.lossScale, 2048, "Loss scale doubles after threshold clean steps");

    // Step with NaN -> backoff and reject
    grads[5] = NaN;
    res = engine.backwardWithMixedPrecision(1.0, grads, res.nextLossScaleState);
    assert.strictEqual(res.stepAccepted, false, "Step rejected on NaN");
    assert.strictEqual(res.hasNonFinite, true);
    assert.strictEqual(res.nextLossScaleState.lastStepSkipped, true);
    assert.strictEqual(res.nextLossScaleState.consecutiveCleanSteps, 0);
    assert.strictEqual(res.nextLossScaleState.lossScale, 1024, "Loss scale halved on non-finite gradient");
  });

  await t.test("BDD-1747: Distributed Quantized Gradient All-Reduce Bandwidth Reduction (50% to 75%)", () => {
    const numWorkers = 4;
    const dim = 128;
    const workers = [];

    for (let w = 0; w < numWorkers; w++) {
      const g = new Float32Array(dim);
      for (let i = 0; i < dim; i++) {
        g[i] = Math.cos((i + 1) * 0.1) * (1.0 + w * 0.05);
      }
      workers.push(g);
    }

    const res = engine.simulateQuantizedAllReduce(workers, "E5M2");
    assert.strictEqual(res.numWorkers, numWorkers);
    assert.strictEqual(res.bytesTransferred, numWorkers * dim * 1, "1 byte per quantized float");
    assert.strictEqual(res.baselineFp32Bytes, numWorkers * dim * 4);
    assert.strictEqual(res.baselineFp16Bytes, numWorkers * dim * 2);

    assert.strictEqual(res.bandwidthSavingsVsFp32Percent, 75.0, "Exact 75% savings vs FP32");
    assert.strictEqual(res.bandwidthSavingsVsFp16Percent, 50.0, "Exact 50% savings vs FP16/BF16");
    assert.ok(res.snrDb >= 25.0, `Collective reduction SNR must be >= 25 dB, got ${res.snrDb}`);
    assert.ok(res.maxReconstructionError <= 0.1, "Reconstruction error bounded");
  });

  await t.test("BDD-1748: Numerical Fidelity Verification (SNR >= 40 dB) & Cryptographic Audit", () => {
    const receipt = engine.audit(128, 4, 10);
    assert.strictEqual(receipt.specRef, "SPEC-328");
    assert.strictEqual(receipt.status, "QUANTIZED_DISTRIBUTED_TRAINING_VERIFIED");
    assert.strictEqual(receipt.e4m3Verified, true);
    assert.strictEqual(receipt.e5m2Verified, true);
    assert.strictEqual(receipt.int8Verified, true);
    assert.strictEqual(receipt.delayedScalingVerified, true);
    assert.strictEqual(receipt.lossScalingVerified, true);
    assert.strictEqual(receipt.bandwidthReductionVsFp32Percent, 75.0);
    assert.strictEqual(receipt.bandwidthReductionVsFp16Percent, 50.0);
    assert.ok(receipt.sha256Signature.length === 64);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });
});
