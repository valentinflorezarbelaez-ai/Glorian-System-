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
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
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

    const receiptPath = resolveEvidencePath("POLYGLOT_RUST_ZIG_WASM_RECEIPT.json", root);
    assert.ok(fs.existsSync(receiptPath));
    const disk = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(disk.cryptographicSignature, receipt.cryptographicSignature);

    // Active consumer verification via SPEC-308 EosCrdtStateReplicatorCore
    const crdtMerge = EosCrdtStateReplicatorCore.mergeLinearMemoryVectors([3, 7, 1], [5, 2, 9]);
    assert.deepEqual(crdtMerge.mergedElements, [5, 7, 9]);
    assert.equal(crdtMerge.memoryBytesUsed, 12);
  });

  it("Edge cases: linear memory growth, unequal vectors, Uint8Array hashing, ring bounds, defaults, and mkdir", async () => {
    // 1. Default projectRoot and missing source precondition
    const defaultCompile = EosPolyglotRustZigWasmKernelCore.compilePolyglotKernel("RUST");
    assert.equal(defaultCompile.language, "RUST");
    assert.equal(defaultCompile.wasmMagicValid, true);

    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "glorian-polyglot-empty-"));
    try {
      assert.throws(
        () => EosPolyglotRustZigWasmKernelCore.compilePolyglotKernel("RUST", emptyRoot),
        /Missing polyglot kernel source/,
      );
    } finally {
      fs.rmSync(emptyRoot, { recursive: true, force: true });
    }

    // 2. Unequal vector lengths, empty vectors, and large vector triggering memory.grow (> 65536 bytes)
    const joinLeftLonger = EosPolyglotRustZigWasmKernelCore.executeRustVectorJoinWasm([10, 20, 30], [5]);
    assert.deepEqual(joinLeftLonger.mergedElements, [10, 20, 30]);
    const joinRightLonger = EosPolyglotRustZigWasmKernelCore.executeRustVectorJoinWasm([5], [10, 20, 30]);
    assert.deepEqual(joinRightLonger.mergedElements, [10, 20, 30]);
    const joinEmpty = EosPolyglotRustZigWasmKernelCore.executeRustVectorJoinWasm([], []);
    assert.equal(joinEmpty.dimension, 0);
    assert.equal(joinEmpty.sumMerged, 0);

    const largeVecA = new Int32Array(6000).fill(3);
    const largeVecB = new Int32Array(6000).fill(7);
    const largeJoin = EosPolyglotRustZigWasmKernelCore.executeRustVectorJoinWasm(largeVecA, largeVecB);
    assert.equal(largeJoin.dimension, 6000);
    assert.equal(largeJoin.sumMerged, 6000 * 7);
    assert.ok(largeJoin.memoryBytesUsed > 65536);

    // 3. Uint8Array input to FNV-1a (including > 1 page payload)
    const bufHash = EosPolyglotRustZigWasmKernelCore.executeZigFnv1aHashWasm(Buffer.from("foobar", "utf8"));
    assert.equal(bufHash.hashHex, "bf9cf968");
    const bigHash = EosPolyglotRustZigWasmKernelCore.executeZigFnv1aHashWasm(new Uint8Array(70000).fill(0x41));
    assert.equal(bigHash.inputByteLength, 70000);
    assert.equal(bigHash.hashHex.length, 8);

    // 4. Ring buffer underflow (producer < consumer) and overflow (inFlight >= capacity)
    const underflow = EosPolyglotRustZigWasmKernelCore.executeZigRingBufferCheckWasm(100, 200, 64);
    assert.equal(underflow.freeSlots, 64);
    assert.equal(underflow.utilizationRatio, 0);
    assert.equal(underflow.backpressureActive, false);

    const overflow = EosPolyglotRustZigWasmKernelCore.executeZigRingBufferCheckWasm(200, 100, 64);
    assert.equal(overflow.freeSlots, 0);
    assert.equal(overflow.utilizationRatio, 1);
    assert.equal(overflow.backpressureActive, true);

    // 5. Benchmark defaults and precondition checks
    assert.throws(() => EosPolyglotRustZigWasmKernelCore.benchmarkPolyglotWasm(0, 10), /positive/);
    assert.throws(() => EosPolyglotRustZigWasmKernelCore.benchmarkPolyglotWasm(10, 0), /positive/);
    const defaultBench = EosPolyglotRustZigWasmKernelCore.benchmarkPolyglotWasm();
    assert.equal(defaultBench.vectorDimension, 128);
    assert.equal(defaultBench.iterations, 250);

    // 6. auditPolyglotRustZigPipeline defaults + creating missing evidenceDir in temp dir
    const defaultAudit = await EosPolyglotRustZigWasmKernelCore.auditPolyglotRustZigPipeline();
    assert.equal(defaultAudit.status, "POLYGLOT_WASM_VERIFIED");

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "glorian-polyglot-mkdir-"));
    const prevEvidenceDir = process.env.EOS_EVIDENCE_DIR;
    try {
      const tplDir = path.join(tmpRoot, "templates", "polyglot-wasm");
      fs.mkdirSync(tplDir, { recursive: true });
      fs.copyFileSync(
        path.join(process.cwd(), "templates", "polyglot-wasm", "kernel.rs"),
        path.join(tplDir, "kernel.rs"),
      );
      fs.copyFileSync(
        path.join(process.cwd(), "templates", "polyglot-wasm", "kernel.zig"),
        path.join(tplDir, "kernel.zig"),
      );
      delete process.env.EOS_EVIDENCE_DIR;
      const isolatedReceipt = await EosPolyglotRustZigWasmKernelCore.auditPolyglotRustZigPipeline(tmpRoot);
      assert.equal(isolatedReceipt.status, "POLYGLOT_WASM_VERIFIED");
      assert.ok(fs.existsSync(path.join(tmpRoot, "docs", "evidence", "POLYGLOT_RUST_ZIG_WASM_RECEIPT.json")));
    } finally {
      if (prevEvidenceDir !== undefined) {
        process.env.EOS_EVIDENCE_DIR = prevEvidenceDir;
      } else {
        delete process.env.EOS_EVIDENCE_DIR;
      }
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
