/**
 * Glorian System — Polyglot Rust & Zig Native WebAssembly Linear-Memory Kernel Test Suite
 * Governed by SPEC-309 / CHANGE-171 / BDD-1629..1634
 *
 * Verifies hermetic Rust/Zig WASM kernel compilation, WebAssembly.Memory vector joins,
 * canonical 32-bit FNV-1a hashing, lock-free ring-buffer backpressure arithmetic,
 * deterministic benchmarking, CLI execution, SPEC-308 integration, and signed receipts.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { EosPolyglotRustZigWasmKernelCore } from "../src/core/eosPolyglotRustZigWasmKernel.ts";
import { EosCrdtStateReplicatorCore } from "../src/core/eosCrdtStateReplicator.ts";

describe("SPEC-309: Polyglot Rust & Zig Native WebAssembly Linear-Memory Kernel Engine", () => {
  // -------------------------------------------------------------------------
  // BDD-1629: Polyglot Rust & Zig Kernel Compilation and W3C Header Integrity
  // -------------------------------------------------------------------------
  it("BDD-1629: Compiles or hermetically synthesizes Rust & Zig WASM kernels with W3C magic headers", () => {
    const root = process.cwd();
    const rustReport = EosPolyglotRustZigWasmKernelCore.compilePolyglotKernel("RUST", root);
    const zigReport = EosPolyglotRustZigWasmKernelCore.compilePolyglotKernel("ZIG", root);

    assert.equal(rustReport.language, "RUST");
    assert.equal(rustReport.wasmMagicValid, true);
    assert.ok(rustReport.wasmByteLength >= 8);
    assert.equal(rustReport.sha256Digest.length, 64);

    assert.equal(zigReport.language, "ZIG");
    assert.equal(zigReport.wasmMagicValid, true);
    assert.ok(zigReport.wasmByteLength >= 8);
    assert.equal(zigReport.sha256Digest.length, 64);
  });

  // -------------------------------------------------------------------------
  // BDD-1630: Hardware-Isolated Rust CRDT Vector Join Over WebAssembly.Memory
  // -------------------------------------------------------------------------
  it("BDD-1630: Executes element-wise CRDT vector join inside isolated WebAssembly.Memory", () => {
    const result = EosPolyglotRustZigWasmKernelCore.executeRustVectorJoinWasm([10, 40, 5, 100], [20, 15, 30, 80]);

    assert.equal(result.dimension, 4);
    assert.deepEqual(result.mergedElements, [20, 40, 30, 100]);
    assert.equal(result.sumMerged, 190);
    assert.equal(result.executionEngine, "WASM_LINEAR_MEMORY");
    assert.ok(result.memoryBytesUsed >= 16);
  });

  // -------------------------------------------------------------------------
  // BDD-1631: Canonical Zig FNV-1a 32-Bit Linear-Memory Hash
  // -------------------------------------------------------------------------
  it("BDD-1631: Computes canonical 32-bit FNV-1a digest over WASM linear memory bytes", () => {
    const foobar = EosPolyglotRustZigWasmKernelCore.executeZigFnv1aHashWasm("foobar");
    assert.equal(foobar.hashHex, "bf9cf968");
    assert.equal(foobar.hashUint32, 0xbf9cf968);
    assert.equal(foobar.inputByteLength, 6);

    const run1 = EosPolyglotRustZigWasmKernelCore.executeZigFnv1aHashWasm("glorian-wasm");
    const run2 = EosPolyglotRustZigWasmKernelCore.executeZigFnv1aHashWasm("glorian-wasm");
    assert.equal(run1.hashHex, run2.hashHex);
    assert.equal(run1.hashUint32, run2.hashUint32);
  });

  // -------------------------------------------------------------------------
  // BDD-1632: Zig Lock-Free Ring-Buffer Backpressure Arithmetic
  // -------------------------------------------------------------------------
  it("BDD-1632: Evaluates bounded ring-buffer free slots and backpressure inside WASM", () => {
    const highLoad = EosPolyglotRustZigWasmKernelCore.executeZigRingBufferCheckWasm(1090, 1000, 100);
    assert.equal(highLoad.freeSlots, 10);
    assert.equal(highLoad.utilizationRatio, 0.9);
    assert.equal(highLoad.backpressureActive, true);

    const nominal = EosPolyglotRustZigWasmKernelCore.executeZigRingBufferCheckWasm(1020, 1000, 100);
    assert.equal(nominal.freeSlots, 80);
    assert.equal(nominal.utilizationRatio, 0.2);
    assert.equal(nominal.backpressureActive, false);

    const invalidCap = EosPolyglotRustZigWasmKernelCore.executeZigRingBufferCheckWasm(10, 0, 0);
    assert.equal(invalidCap.freeSlots, 0);
    assert.equal(invalidCap.backpressureActive, true);
  });

  // -------------------------------------------------------------------------
  // BDD-1633: Deterministic Equivalence Benchmark (WASM Linear Memory vs JS)
  // -------------------------------------------------------------------------
  it("BDD-1633: Benchmarks WASM linear memory vs JS heap arrays with 100% deterministic match", () => {
    const benchmark = EosPolyglotRustZigWasmKernelCore.benchmarkPolyglotWasm(128, 250);

    assert.equal(benchmark.vectorDimension, 128);
    assert.equal(benchmark.iterations, 250);
    assert.equal(benchmark.deterministicMatch, true);
    assert.ok(benchmark.wasmTotalNs >= 0);
    assert.ok(benchmark.jsTotalNs >= 0);
  });

  // -------------------------------------------------------------------------
  // BDD-1634: Cross-Module Consumption (SPEC-308) & Cryptographic Receipt
  // -------------------------------------------------------------------------
  it("BDD-1634: Emits signed audit receipt and verifies active SPEC-308 CRDT consumption", async () => {
    const root = process.cwd();
    const receipt = await EosPolyglotRustZigWasmKernelCore.auditPolyglotRustZigPipeline(root);

    assert.equal(receipt.specRef, "SPEC-309");
    assert.equal(receipt.changeRef, "CHANGE-171");
    assert.equal(receipt.status, "POLYGLOT_WASM_VERIFIED");
    assert.equal(receipt.vectorJoinVerified, true);
    assert.equal(receipt.fnv1aVerified, true);
    assert.equal(receipt.ringBufferVerified, true);
    assert.equal(receipt.cryptographicSignature.length, 64);

    const receiptPath = path.join(root, "docs", "evidence", "POLYGLOT_RUST_ZIG_WASM_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath));
    const disk = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(disk.cryptographicSignature, receipt.cryptographicSignature);

    // Active consumer verification via SPEC-308 EosCrdtStateReplicatorCore
    const crdtMerge = EosCrdtStateReplicatorCore.mergeLinearMemoryVectors([3, 7, 1], [5, 2, 9]);
    assert.deepEqual(crdtMerge.mergedElements, [5, 7, 9]);
    assert.equal(crdtMerge.memoryBytesUsed, 12);
  });
});
