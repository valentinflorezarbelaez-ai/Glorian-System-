/**
 * @file test/eosActivationCheckpointingEngine.test.mjs
 * @description BDD test suite for SPEC-326 / CHANGE-188: Asynchronous Pipeline Parallelism
 * & Activation Checkpointing / Recomputation Engine.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosActivationCheckpointingCore } from "../src/core/eosActivationCheckpointingEngine.ts";
import { handleActivationCheckpointingCommand } from "../bin/commands/cliActivationCheckpointingEngine.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/ACTIVATION_CHECKPOINTING_RECEIPT.json");

describe("SPEC-326: Asynchronous Pipeline Parallelism & Activation Checkpointing Engine", () => {
  test("BDD-1731: Full Activation Checkpointing & Segment Boundary Partitioning", () => {
    const engine = new EosActivationCheckpointingCore();
    const totalLayers = 16;
    const segments = engine.partitionSegments(totalLayers, 4);

    assert.equal(segments.length, 4);
    assert.equal(segments[0].startLayer, 0);
    assert.equal(segments[0].endLayer, 4);
    assert.equal(segments[3].startLayer, 12);
    assert.equal(segments[3].endLayer, 16);

    // Forward pass preserves only boundary inputs
    const hiddenDim = 8;
    const layers = Array.from({ length: totalLayers }, (_, l) => ({
      id: l,
      name: `layer_${l}`,
      weights: new Float32Array(hiddenDim * hiddenDim).fill(0.01),
      bias: new Float32Array(hiddenDim).fill(0.001),
      isNonLinear: l % 2 === 1,
      inputDim: hiddenDim,
      outputDim: hiddenDim,
    }));

    const inputs = new Float32Array(hiddenDim).fill(0.5);
    const result = engine.forwardWithCheckpoints(inputs, layers, "FULL_CHECKPOINT", 4);

    assert.equal(result.checkpoints.size, 4);
    assert.ok(result.output.length === hiddenDim);
    assert.ok(result.peakMemoryElements < 16 * hiddenDim * 3);
  });

  test("BDD-1732: Selective Activation Recomputation & Transient Buffer Deallocation", () => {
    const engine = new EosActivationCheckpointingCore();
    const hiddenDim = 8;
    const totalLayers = 8;
    const layers = Array.from({ length: totalLayers }, (_, l) => ({
      id: l,
      name: `layer_${l}`,
      weights: new Float32Array(hiddenDim * hiddenDim).fill(0.02),
      bias: new Float32Array(hiddenDim).fill(0.01),
      isNonLinear: true,
      inputDim: hiddenDim,
      outputDim: hiddenDim,
    }));

    const inputs = new Float32Array(hiddenDim).fill(0.2);
    const fwdResult = engine.forwardWithCheckpoints(inputs, layers, "FULL_CHECKPOINT", 2);

    const lossGrad = new Float32Array(hiddenDim).fill(1.0);
    const bwdResult = engine.backwardWithRecomputation(lossGrad, layers, fwdResult.checkpoints, "FULL_CHECKPOINT", 2);

    assert.equal(bwdResult.residualMemoryElements, 0, "Checkpoints must be completely emptied post-backward");
    assert.equal(bwdResult.layerGradients.length, totalLayers);
    assert.ok(bwdResult.recomputationSteps > 0, "Transient steps must be executed on-the-fly");
  });

  test("BDD-1733: Asynchronous 1F1B Schedule with Early Activation Release", async () => {
    const engine = new EosActivationCheckpointingCore();
    const numMicroBatches = 8;
    const numStages = 4;

    const schedule = await engine.async1F1BSchedule(numMicroBatches, numStages);
    assert.ok(schedule.length >= numMicroBatches * 2);

    let maxInFlight = 0;
    for (const step of schedule) {
      if (step.activeActivationsCount > maxInFlight) {
        maxInFlight = step.activeActivationsCount;
      }
      assert.ok(
        step.activeActivationsCount <= numStages,
        `Active activations (${step.activeActivationsCount}) exceeded pipeline stages bound (${numStages})`,
      );
    }

    assert.equal(maxInFlight, numStages);
    const lastStep = schedule[schedule.length - 1];
    assert.equal(lastStep.action, "BACKWARD");
    assert.equal(lastStep.activeActivationsCount, 0, "All micro-batch activations must be released at end");
  });

  test("BDD-1734: Peak Activation Memory Ceiling Bounded to O(sqrt(L))", () => {
    const engine = new EosActivationCheckpointingCore();
    const hiddenDim = 16;
    const numLayers = 36;
    const mOpt = Math.ceil(Math.sqrt(numLayers)); // 6

    const layers = Array.from({ length: numLayers }, (_, l) => ({
      id: l,
      name: `layer_${l}`,
      weights: new Float32Array(hiddenDim * hiddenDim).fill(0.01),
      bias: new Float32Array(hiddenDim).fill(0.001),
      isNonLinear: l % 2 === 1,
      inputDim: hiddenDim,
      outputDim: hiddenDim,
    }));

    const inputs = new Float32Array(hiddenDim).fill(0.1);
    const fwdCheckpoints = engine.forwardWithCheckpoints(inputs, layers, "FULL_CHECKPOINT", mOpt);
    const standardPass = engine.standardForwardBackward(inputs, layers);

    assert.ok(
      fwdCheckpoints.peakMemoryElements < standardPass.peakMemoryElements,
      "Checkpointing memory must be strictly less than standard pass memory",
    );

    const savingsPercent =
      ((standardPass.peakMemoryElements - fwdCheckpoints.peakMemoryElements) / standardPass.peakMemoryElements) * 100.0;
    assert.ok(savingsPercent >= 60.0, `Expected at least 60% memory savings, got ${savingsPercent}%`);
  });

  test("BDD-1735: Mathematical Gradient Parity Against Standard Backpropagation", () => {
    const engine = new EosActivationCheckpointingCore();
    const hiddenDim = 8;
    const numLayers = 8;

    const layers = Array.from({ length: numLayers }, (_, l) => {
      const weights = new Float32Array(hiddenDim * hiddenDim);
      for (let i = 0; i < weights.length; i++) {
        weights[i] = Math.fround(Math.sin((l + 1) * (i + 1) * 0.1) * 0.05);
      }
      return {
        id: l,
        name: `layer_${l}`,
        weights,
        bias: new Float32Array(hiddenDim).fill(0.01),
        isNonLinear: l % 2 === 1,
        inputDim: hiddenDim,
        outputDim: hiddenDim,
      };
    });

    const inputs = new Float32Array(hiddenDim);
    for (let i = 0; i < hiddenDim; i++) inputs[i] = Math.fround(Math.cos(i * 0.3) * 0.4);

    const stdResult = engine.standardForwardBackward(inputs, layers);
    const fwdResult = engine.forwardWithCheckpoints(inputs, layers, "FULL_CHECKPOINT", 2);

    const lossGrad = new Float32Array(hiddenDim).fill(1.0);
    const bwdResult = engine.backwardWithRecomputation(lossGrad, layers, fwdResult.checkpoints, "FULL_CHECKPOINT", 2);

    let maxDiff = 0.0;
    for (let l = 0; l < numLayers; l++) {
      const stdGrads = stdResult.layerGradients[l].gradWeights;
      const recGrads = bwdResult.layerGradients[l].gradWeights;
      for (let i = 0; i < stdGrads.length; i++) {
        const diff = Math.abs(stdGrads[i] - recGrads[i]);
        if (diff > maxDiff) maxDiff = diff;
      }
    }

    assert.ok(maxDiff <= 1e-6, `Max gradient diff (${maxDiff}) must be <= 1e-6`);
  });

  test("BDD-1736: CLI Toolchain Parity & Invariant Audit Receipt", async () => {
    const commands = [
      "toolchain:checkpoint:full",
      "toolchain:checkpoint:selective",
      "toolchain:checkpoint:async-1f1b",
      "toolchain:checkpoint:memory",
      "toolchain:checkpoint:audit",
    ];

    for (const cmd of commands) {
      const ok = await handleActivationCheckpointingCommand({
        command: cmd,
        args: ["--json"],
      });
      assert.equal(ok, true, `Command ${cmd} must succeed and return true`);
    }

    assert.ok(fs.existsSync(RECEIPT_PATH), "Receipt file must exist");
    const raw = fs.readFileSync(RECEIPT_PATH, "utf8");
    const receipt = JSON.parse(raw);

    assert.equal(receipt.status, "VERIFIED");
    assert.equal(receipt.gradientParityCertified, true);
    assert.equal(receipt.zeroResidualLeakage, true);
    assert.equal(receipt.peakMemoryCeilingBounded, true);
    assert.ok(receipt.sha256 && receipt.sha256.length === 64, "SHA-256 seal must be valid");
  });
});
