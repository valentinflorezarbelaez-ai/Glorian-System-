/**
 * BDD Test Suite for SPEC-311 / CHANGE-173:
 * Shared-Memory Worker Pool, Single-Call In-WASM SIMD128 Loop & Multi-Process WAL Crash Recovery
 *
 * Verifies BDD-1641..BDD-1646.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { EosSharedMemoryWorkerPoolCore, EosWasmSimd128VectorArenaCore } from "../src/core/index.ts";

describe("SPEC-311: Shared-Memory Worker Pool, In-WASM SIMD128 Loops & Jepsen WAL Crash Recovery", () => {
  // -------------------------------------------------------------------------
  // BDD-1641: Single-Call In-WASM SIMD128 Structured Loop Speed & Parity
  // -------------------------------------------------------------------------
  it("BDD-1641: Single-call in-WASM SIMD128 loop removes JS trampoline overhead with deterministic match", () => {
    const benchmark = EosWasmSimd128VectorArenaCore.benchmarkSimd128VsScalar(128, 250);

    assert.equal(benchmark.dimension, 128);
    assert.equal(benchmark.iterations, 250);
    assert.equal(benchmark.deterministicMatch, true);
    assert.ok(benchmark.simdNsPerOp < 150, `Expected in-WASM loop < 150 ns/op, got ${benchmark.simdNsPerOp}`);
  });

  // -------------------------------------------------------------------------
  // BDD-1642: Shared WebAssembly.Memory (SharedArrayBuffer) & Bounds
  // -------------------------------------------------------------------------
  it("BDD-1642: Allocates shared WebAssembly.Memory (SharedArrayBuffer) and rejects invalid bounds", () => {
    const { memory, report } = EosSharedMemoryWorkerPoolCore.createSharedWasmArena(4, 16);

    assert.equal(memory.buffer instanceof SharedArrayBuffer, true);
    assert.equal(report.isSharedArrayBuffer, true);
    assert.equal(report.byteLength, 4 * 65536);

    assert.throws(() => EosSharedMemoryWorkerPoolCore.createSharedWasmArena(0, 8), /PRECONDITION_FAILED/);
    assert.throws(() => EosSharedMemoryWorkerPoolCore.createSharedWasmArena(8, 4), /PRECONDITION_FAILED/);
  });

  // -------------------------------------------------------------------------
  // BDD-1643: Multi-Core worker_threads Parallel Reduction via Atomics
  // -------------------------------------------------------------------------
  it("BDD-1643: Executes multi-core worker_threads parallel reduction over SharedArrayBuffer with Atomics", async () => {
    const elements = [10, 20, 30, 40, 50, 60, 70, 80];
    const reduction = await EosSharedMemoryWorkerPoolCore.executeParallelSharedArenaReduction(elements, 2);

    assert.equal(reduction.elementCount, 8);
    assert.equal(reduction.workerCount, 2);
    assert.equal(reduction.totalSum, 360);
    assert.equal(reduction.maxElement, 80);
    assert.equal(reduction.atomicCompletedWorkers, 2);
    assert.equal(reduction.sharedMemoryVerified, true);
  });

  // -------------------------------------------------------------------------
  // BDD-1644: Sharded Elastic Fleet Audit & Merkle Root Convergence
  // -------------------------------------------------------------------------
  it("BDD-1644: Audits sharded elastic fleet concurrently with atomic counter and Merkle root", async () => {
    const projectIds = Array.from({ length: 16 }, (_, idx) => `fleet-svc-${idx + 1}`);
    const report = await EosSharedMemoryWorkerPoolCore.executeParallelElasticFleetAudit(projectIds, 4);

    assert.equal(report.totalProjects, 16);
    assert.equal(report.shardCount, 4);
    assert.equal(report.atomicProgressCount, 16);
    assert.equal(report.shards.length, 4);
    assert.equal(report.fleetMerkleRoot.length, 64);
  });

  // -------------------------------------------------------------------------
  // BDD-1645: Multi-Process On-Disk SQLite WAL Crash Recovery (Jepsen Drill)
  // -------------------------------------------------------------------------
  it("BDD-1645: Recovers 4/4 committed records and 0 dirty uncommitted rows after OS crash mid-txn", () => {
    const crash = EosSharedMemoryWorkerPoolCore.executeMultiProcessWalCrashRecoveryDrill(process.cwd());

    assert.equal(crash.walModeVerified, true);
    assert.equal(crash.committedRecordsExpected, 4);
    assert.equal(crash.committedRecordsRecovered, 4);
    assert.equal(crash.uncommittedDirtyRecordsLeaked, 0);
    assert.equal(crash.merkleRootAfterRecovery, crash.merkleRootBeforeCrash);
    assert.equal(crash.zeroDataLossVerified, true);
  });

  // -------------------------------------------------------------------------
  // BDD-1646: Signed Audit Receipt & Pure JSON CLI Output (toolchain:workers:*)
  // -------------------------------------------------------------------------
  it("BDD-1646: Emits signed receipt and verifies pure JSON CLI output", async () => {
    const root = process.cwd();
    const receipt = await EosSharedMemoryWorkerPoolCore.auditSharedMemoryWorkerPoolPipeline(root);

    assert.equal(receipt.specRef, "SPEC-311");
    assert.equal(receipt.changeRef, "CHANGE-173");
    assert.equal(receipt.status, "SHARED_MEMORY_WORKERS_AND_JEPSEN_VERIFIED");
    assert.equal(receipt.parallelReductionReport.sharedMemoryVerified, true);
    assert.equal(receipt.walCrashRecoveryReport.zeroDataLossVerified, true);
    assert.ok(receipt.inWasmSimdLoopNsPerOp < 150, `Expected < 150 ns/op, got ${receipt.inWasmSimdLoopNsPerOp}`);
    assert.equal(receipt.cryptographicSignature.length, 64);

    const receiptPath = path.join(root, "docs", "evidence", "SHARED_MEMORY_WORKER_POOL_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.cryptographicSignature, receipt.cryptographicSignature);

    const cliOut = execFileSync(process.execPath, ["bin/eos.mjs", "toolchain:workers:reduce", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    const parsed = JSON.parse(cliOut);
    assert.equal(parsed.reduction.totalSum, 360);
    assert.equal(parsed.fleetShards.atomicProgressCount, 16);
  });
});
