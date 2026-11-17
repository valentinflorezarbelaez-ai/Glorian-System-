/**
 * @file test/eosZeroFsdpEngine.test.mjs
 * @description BDD test suite for SPEC-324 / CHANGE-186: ZeRO (Zero Redundancy
 * Optimizer) & Fully Sharded Data Parallel (FSDP) Engine (ZeRO-1, ZeRO-2, ZeRO-3,
 * and Host Memory Offloading).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosZeroFsdpCore } from "../src/core/eosZeroFsdpEngine.ts";
import { handleZeroFsdpCommand } from "../bin/commands/cliZeroFsdpEngine.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/ZERO_FSDP_RECEIPT.json");

describe("SPEC-324: ZeRO & Fully Sharded Data Parallel (FSDP) Engine", () => {
  test("BDD-1719: ZeRO-Stage 1 Optimizer State Sharding (P_os) & Parity", () => {
    const numWorkers = 4;
    const numParams = 1024;
    const engine = new EosZeroFsdpCore({ numWorkers, stage: 1 });

    const shards = engine.partitionOptimizerStates(numParams, numWorkers);
    assert.equal(shards.length, numWorkers);
    for (const shard of shards) {
      assert.equal(shard.length, 256);
      assert.equal(shard.m.length, 256);
      assert.equal(shard.v.length, 256);
    }

    const params = new Float32Array(numParams);
    for (let i = 0; i < numParams; i++) {
      params[i] = Math.sin(i * 0.1);
    }

    const workerGrads = [];
    for (let w = 0; w < numWorkers; w++) {
      const g = new Float32Array(numParams);
      for (let i = 0; i < numParams; i++) {
        g[i] = Math.cos((i + w) * 0.1);
      }
      workerGrads.push(g);
    }

    const res1 = engine.stepZeRO1(params, workerGrads);
    assert.equal(res1.updatedParams.length, numParams);

    // Compute reference monolithic Adam
    const avgGrads = new Float32Array(numParams);
    for (let i = 0; i < numParams; i++) {
      let sum = 0;
      for (let w = 0; w < numWorkers; w++) sum += workerGrads[w][i];
      avgGrads[i] = sum / numWorkers;
    }
    const ref = engine.referenceMonolithicAdam(params, avgGrads);

    // Verify mathematical parity (eps <= 1e-6)
    for (let i = 0; i < numParams; i++) {
      assert.ok(
        Math.abs(res1.updatedParams[i] - ref[i]) <= 1e-6,
        `ZeRO-1 parity deviation at ${i}: ${res1.updatedParams[i]} vs ${ref[i]}`,
      );
    }

    // Verify memory reduction ratio (4*N + 12*N/P vs 16*N)
    const ratio = res1.baselineDdpBytes / res1.memoryPerWorkerBytes;
    assert.ok(ratio >= 2.2, `Expected memory savings ratio >= 2.2x, got ${ratio}`);
  });

  test("BDD-1720: ZeRO-Stage 2 Gradient Sharding (P_os+g) & Reduce-Scatter", () => {
    const numWorkers = 4;
    const numParams = 1024;
    const engine = new EosZeroFsdpCore({ numWorkers, stage: 2 });

    const params = new Float32Array(numParams);
    for (let i = 0; i < numParams; i++) {
      params[i] = Math.cos(i * 0.05);
    }

    const workerGrads = [];
    for (let w = 0; w < numWorkers; w++) {
      const g = new Float32Array(numParams);
      for (let i = 0; i < numParams; i++) {
        g[i] = Math.sin((i + w) * 0.05);
      }
      workerGrads.push(g);
    }

    const res2 = engine.stepZeRO2(params, workerGrads);
    assert.equal(res2.updatedParams.length, numParams);

    const avgGrads = new Float32Array(numParams);
    for (let i = 0; i < numParams; i++) {
      let sum = 0;
      for (let w = 0; w < numWorkers; w++) sum += workerGrads[w][i];
      avgGrads[i] = sum / numWorkers;
    }
    const ref = engine.referenceMonolithicAdam(params, avgGrads);

    for (let i = 0; i < numParams; i++) {
      assert.ok(
        Math.abs(res2.updatedParams[i] - ref[i]) <= 1e-6,
        `ZeRO-2 parity deviation at ${i}: ${res2.updatedParams[i]} vs ${ref[i]}`,
      );
    }

    // ZeRO-2 memory: 2*N + 14*N / P bytes
    const ratio = res2.baselineDdpBytes / res2.memoryPerWorkerBytes;
    assert.ok(ratio >= 2.9, `Expected ZeRO-2 savings ratio >= 2.9x, got ${ratio}`);
  });

  test("BDD-1721: ZeRO-Stage 3 / FSDP Parameter Sharding (P_os+g+p)", () => {
    const numWorkers = 4;
    const numLayers = 4;
    const layerLen = 256;
    const totalParams = numLayers * layerLen;

    const engine = new EosZeroFsdpCore({ numWorkers, stage: 3 });

    const layers = [];
    for (let l = 0; l < numLayers; l++) {
      const layer = new Float32Array(layerLen);
      for (let j = 0; j < layerLen; j++) layer[j] = Math.sin((l * layerLen + j) * 0.02);
      layers.push(layer);
    }

    const gradsPerWorker = [];
    for (let w = 0; w < numWorkers; w++) {
      const wLayers = [];
      for (let l = 0; l < numLayers; l++) {
        const gl = new Float32Array(layerLen);
        for (let j = 0; j < layerLen; j++) gl[j] = Math.cos((l * layerLen + j + w) * 0.02);
        wLayers.push(gl);
      }
      gradsPerWorker.push(wLayers);
    }

    const res3 = engine.stepZeRO3(layers, gradsPerWorker);
    assert.equal(res3.updatedLayers.length, numLayers);

    // Flatten for reference check
    const flatParams = new Float32Array(totalParams);
    const flatGrads = new Float32Array(totalParams);
    for (let l = 0; l < numLayers; l++) {
      flatParams.set(layers[l], l * layerLen);
      for (let j = 0; j < layerLen; j++) {
        let sum = 0;
        for (let w = 0; w < numWorkers; w++) sum += gradsPerWorker[w][l][j];
        flatGrads[l * layerLen + j] = sum / numWorkers;
      }
    }
    const ref = engine.referenceMonolithicAdam(flatParams, flatGrads);

    for (let l = 0; l < numLayers; l++) {
      for (let j = 0; j < layerLen; j++) {
        const globalIdx = l * layerLen + j;
        assert.ok(
          Math.abs(res3.updatedLayers[l][j] - ref[globalIdx]) <= 1e-6,
          `ZeRO-3 parity deviation at layer ${l}, idx ${j}: ${res3.updatedLayers[l][j]} vs ${ref[globalIdx]}`,
        );
      }
    }

    // Memory per worker: 16*N / P + maxLayerParams * 4
    const ratio = res3.baselineDdpBytes / res3.memoryPerWorkerBytes;
    assert.ok(ratio >= 3.0, `Expected ZeRO-3 savings ratio >= 3.0x, got ${ratio}`);
  });

  test("BDD-1722: JIT Dynamic All-Gather Deallocation & Zero Memory Leakage", () => {
    const numWorkers = 2;
    const numLayers = 3;
    const layerLen = 128;
    const engine = new EosZeroFsdpCore({ numWorkers, stage: 3 });

    const layers = Array.from({ length: numLayers }, () => new Float32Array(layerLen).fill(0.5));
    const gradsPerWorker = Array.from({ length: numWorkers }, () =>
      Array.from({ length: numLayers }, () => new Float32Array(layerLen).fill(0.01)),
    );

    const res = engine.stepZeRO3(layers, gradsPerWorker);
    assert.equal(res.purged, true);
    assert.equal(res.peakTransientBytes, layerLen * 4);
    // Peak transient is strictly bounded by single layer, NOT total model size
    assert.ok(res.peakTransientBytes < numLayers * layerLen * 4);
  });

  test("BDD-1723: Host CPU Memory Offloading (ZeRO-Offload)", () => {
    const engine = new EosZeroFsdpCore({ cpuOffload: true });
    const shards = engine.partitionOptimizerStates(512, 2);
    const shard = shards[0];

    shard.m.fill(0.123);
    shard.v.fill(0.456);

    const offloadStats = engine.offloadToHost(shard);
    assert.equal(offloadStats.hostMemoryBytes, 256 * 4 * 2);
    assert.ok(offloadStats.transferLatencyEstimateMs > 0);

    // Clear local buffers
    shard.m.fill(0);
    shard.v.fill(0);

    // Prefetch from host
    engine.prefetchFromHost(shard);
    assert.ok(Math.abs(shard.m[0] - 0.123) < 1e-6);
    assert.ok(Math.abs(shard.v[0] - 0.456) < 1e-6);
  });

  test("BDD-1724: CLI Toolchain Parity & SHA-256 Receipt Audit", async () => {
    const commands = [
      { command: "toolchain:zero:stage1", args: ["--workers=4", "--params=512", "--json"] },
      { command: "toolchain:zero:stage2", args: ["--workers=4", "--params=512", "--json"] },
      { command: "toolchain:zero:stage3", args: ["--workers=4", "--layers=4", "--layerparams=128", "--json"] },
      { command: "toolchain:zero:offload", args: ["--params=512", "--json"] },
      { command: "toolchain:zero:audit", args: ["--workers=4", "--params=512", "--json"] },
    ];

    for (const cmdCtx of commands) {
      const res = await handleZeroFsdpCommand(cmdCtx);
      assert.equal(res, true, `CLI command ${cmdCtx.command} failed`);
    }

    assert.ok(fs.existsSync(RECEIPT_PATH), "ZERO_FSDP_RECEIPT.json missing");
    const receipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, "utf8"));
    assert.equal(receipt.status, "VERIFIED");
    assert.equal(receipt.mathParityCertified, true);
    assert.equal(receipt.zeroLeakageCertified, true);
    assert.equal(receipt.hostOffloadVerified, true);
    assert.ok(receipt.receiptSha256 && receipt.receiptSha256.length === 64);
  });
});
