/**
 * BDD Test Suite for SPEC-310 / CHANGE-172:
 * WebAssembly SIMD 128-Bit (v128) Vectorized Compute, Zero-Copy Arena & Elastic Fleet Capacity
 *
 * Verifies BDD-1635..BDD-1640.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { EosUniversalFleetSyncCore, EosWasmSimd128VectorArenaCore } from "../src/core/index.ts";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";

describe("SPEC-310: WebAssembly SIMD 128-Bit (v128) Vector Arena & Elastic Fleet Governor", () => {
  // -------------------------------------------------------------------------
  // BDD-1635: Polyglot Zig/Rust SIMD128 Kernel Compilation & 0xfd Opcodes
  // -------------------------------------------------------------------------
  it("BDD-1635: Compiles Zig SIMD128 and synthesizes W3C 0xfd modules with valid magic headers", () => {
    const root = process.cwd();
    const zig = EosWasmSimd128VectorArenaCore.compileSimdPolyglotKernel("ZIG", root);
    const rust = EosWasmSimd128VectorArenaCore.compileSimdPolyglotKernel("RUST", root);

    assert.equal(zig.language, "ZIG");
    assert.equal(zig.wasmMagicValid, true);
    assert.equal(zig.simdOpcodesPresent, true);
    assert.equal(zig.sha256Digest.length, 64);

    assert.equal(rust.language, "RUST");
    assert.equal(rust.wasmMagicValid, true);
    assert.equal(rust.simdOpcodesPresent, true);
    assert.equal(rust.sha256Digest.length, 64);
  });

  // -------------------------------------------------------------------------
  // BDD-1636: 4-Lane i32x4.max_s SIMD Join With Scalar Tail on 16B Memory
  // -------------------------------------------------------------------------
  it("BDD-1636: Executes 4-lane v128 i32x4.max_s join and scalar tail on 16-byte aligned memory", () => {
    const res = EosWasmSimd128VectorArenaCore.executeSimdVectorMaxJoin([10, 40, 5, 100, 7], [20, 15, 30, 80, 12]);

    assert.equal(res.dimension, 5);
    assert.equal(res.simdLanesProcessed, 4);
    assert.equal(res.scalarTailProcessed, 1);
    assert.deepEqual(res.mergedElements, [20, 40, 30, 100, 12]);
    assert.equal(res.sumMerged, 202);
    assert.equal(res.arenaAlignedOffsetBytes % 16, 0);
  });

  // -------------------------------------------------------------------------
  // BDD-1637: 4-Lane i32x4.mul SIMD Dot Product & Mismatch Fail-Closed Guard
  // -------------------------------------------------------------------------
  it("BDD-1637: Computes 4-lane i32x4.mul dot product and enforces dimension preconditions", () => {
    const dot = EosWasmSimd128VectorArenaCore.executeSimdDotProduct([2, 3, 4, 5], [10, 20, 30, 40]);

    assert.equal(dot.dimension, 4);
    assert.equal(dot.simdLanesProcessed, 4);
    assert.equal(dot.dotProduct, 400);
    assert.ok(dot.cosineSimilarity > 0.9 && dot.cosineSimilarity <= 1.0);

    assert.throws(() => EosWasmSimd128VectorArenaCore.executeSimdDotProduct([1, 2], [3]), /PRECONDITION_FAILED/);
    assert.throws(() => EosWasmSimd128VectorArenaCore.executeSimdDotProduct([], []), /PRECONDITION_FAILED/);
  });

  // -------------------------------------------------------------------------
  // BDD-1638: Zero-Copy Aligned Telemetry Framing & v128.xor Ring-Buffer Check
  // -------------------------------------------------------------------------
  it("BDD-1638: Stages zero-copy 16-byte aligned frames with v128.xor parity tag and backpressure", () => {
    const frame = EosWasmSimd128VectorArenaCore.enqueueAndVerifyZeroCopyArenaFrame(
      [11, 22, 33, 44, 55, 66, 77, 88],
      1090,
      1000,
      100,
    );

    assert.equal(frame.alignedOffsetBytes % 16, 0);
    assert.equal(frame.frameByteLength, 32);
    assert.equal(frame.xorParityTagHex.length, 8);
    assert.equal(frame.freeSlotsRemaining, 10);
    assert.equal(frame.utilizationRatio, 0.9);
    assert.equal(frame.zeroHeapCopyVerified, true);
  });

  // -------------------------------------------------------------------------
  // BDD-1639: Elastic Fleet Capacity Scaling Across EosUniversalFleetSyncCore
  // -------------------------------------------------------------------------
  it("BDD-1639: Validates elastic fleet capacity scaling (10..1000 projects) fail-closed", () => {
    const c10 = EosUniversalFleetSyncCore.evaluateElasticFleetCapacity(10);
    assert.equal(c10.withinBounds, true);
    assert.equal(c10.recommendedWorkerShards, 2);
    assert.equal(c10.vssThresholdGroupsRequired, 1);
    assert.equal(c10.vercelHobbyAccountFits, true);

    const c200 = EosUniversalFleetSyncCore.evaluateElasticFleetCapacity(200);
    assert.equal(c200.withinBounds, true);
    assert.equal(c200.vssThresholdGroupsRequired, 4);
    assert.equal(c200.vercelHobbyAccountFits, true);

    const c1000 = EosUniversalFleetSyncCore.evaluateElasticFleetCapacity(1000);
    assert.equal(c1000.withinBounds, true);
    assert.equal(c1000.recommendedWorkerShards, 16);
    assert.equal(c1000.antiEntropyRoundsLog2, 10);
    assert.equal(c1000.vercelHobbyAccountFits, false);

    assert.throws(() => EosUniversalFleetSyncCore.evaluateElasticFleetCapacity(9), /PRECONDITION_FAILED/);
    assert.throws(() => EosUniversalFleetSyncCore.evaluateElasticFleetCapacity(1001), /PRECONDITION_FAILED/);
  });

  // -------------------------------------------------------------------------
  // BDD-1640: SIMD128 Benchmark, Signed Receipt & Pure JSON CLI Execution
  // -------------------------------------------------------------------------
  it("BDD-1640: Benchmarks SIMD128 vs scalar, emits signed receipt, and emits pure JSON CLI output", async () => {
    const root = process.cwd();
    const benchmark = EosWasmSimd128VectorArenaCore.benchmarkSimd128VsScalar(128, 250);
    assert.equal(benchmark.deterministicMatch, true);
    assert.ok(benchmark.simdTotalNs >= 0);

    const receipt = await EosWasmSimd128VectorArenaCore.auditSimd128VectorArenaPipeline(root);
    assert.equal(receipt.specRef, "SPEC-310");
    assert.equal(receipt.changeRef, "CHANGE-172");
    assert.equal(receipt.status, "SIMD128_VECTOR_ARENA_VERIFIED");
    assert.equal(receipt.maxJoinVerified, true);
    assert.equal(receipt.dotProductVerified, true);
    assert.equal(receipt.zeroCopyArenaVerified, true);
    assert.equal(receipt.elasticFleetVerified, true);
    assert.equal(receipt.cryptographicSignature.length, 64);

    const receiptPath = resolveEvidencePath("WASM_SIMD128_ARENA_RECEIPT.json", root);
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.cryptographicSignature, receipt.cryptographicSignature);

    const cliStdout = execFileSync(process.execPath, ["bin/eos.mjs", "toolchain:simd:execute", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    const parsedCli = JSON.parse(cliStdout);
    assert.equal(parsedCli.maxJoin.sumMerged, 202);
    assert.equal(parsedCli.dotProduct.dotProduct, 400);
  });
});
