/**
 * GLORIAN SYSTEM — WEB ASSEMBLY BYTECODE SYNTHESIZER TEST SUITE
 *
 * Verifies pure binary WebAssembly module synthesis, signed and unsigned LEB128
 * codecs, loop execution, hardware-enforced linear memory trapping,
 * vector dot-product computation, and cryptographic audit receipts.
 *
 * Governed by SPEC-306 (FR-306-01..FR-306-06, BDD-1611..BDD-1616).
 * Strict Law V: Zero third-party runtime dependencies. Uses node:test and node:assert/strict.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import {
  EosWasmBytecodeSynthesizerCore,
  encodeUleb128,
  decodeUleb128,
  encodeSleb128,
  decodeSleb128,
} from "../src/core/eosWasmBytecodeSynthesizer.ts";

describe("SPEC-306: Pure WebAssembly Binary Synthesis & Linear Memory Isolation Engine", () => {
  it("BDD-1611: Binary Synthesis of Valid WebAssembly Header and Minimal Module", () => {
    const addMod = EosWasmBytecodeSynthesizerCore.buildAddModule();

    // Verify magic header: 0x00, 0x61, 0x73, 0x6d ('\0asm')
    assert.strictEqual(addMod.bytecode[0], 0x00);
    assert.strictEqual(addMod.bytecode[1], 0x61);
    assert.strictEqual(addMod.bytecode[2], 0x73);
    assert.strictEqual(addMod.bytecode[3], 0x6d);

    // Verify version: 0x01, 0x00, 0x00, 0x00
    assert.strictEqual(addMod.bytecode[4], 0x01);
    assert.strictEqual(addMod.bytecode[5], 0x00);
    assert.strictEqual(addMod.bytecode[6], 0x00);
    assert.strictEqual(addMod.bytecode[7], 0x00);

    // Verify native V8 validation
    assert.ok(WebAssembly.validate(addMod.bytecode), "Bytecode must be valid W3C WebAssembly");

    // Execute add export
    const result = EosWasmBytecodeSynthesizerCore.executeModule(addMod, "add", [17, 25]);
    assert.strictEqual(result.status, "SUCCESS");
    assert.strictEqual(result.returnedValue, 42);
    assert.ok(result.executionTimeNs >= 0n);
  });

  it("BDD-1612: LEB128 Variable-Length Integer Encoding Fidelity", () => {
    // Unsigned LEB128 boundary test values
    const unsignedCases = [0, 1, 63, 127, 128, 255, 16384, 65535, 1000000];
    for (const val of unsignedCases) {
      const encoded = encodeUleb128(val);
      const decoded = decodeUleb128(encoded);
      assert.strictEqual(decoded.value, val, `ULEB128 round-trip failed for ${val}`);
      assert.strictEqual(decoded.bytesRead, encoded.length);
    }

    // Signed LEB128 boundary test values
    const signedCases = [0, 1, -1, 63, -64, 127, -128, 1024, -1024, 2147483647, -2147483648];
    for (const val of signedCases) {
      const encoded = encodeSleb128(val);
      const decoded = decodeSleb128(encoded);
      assert.strictEqual(decoded.value, val, `SLEB128 round-trip failed for ${val}`);
      assert.strictEqual(decoded.bytesRead, encoded.length);
    }
  });

  it("BDD-1613: Synthetic Dynamic Arithmetic & Loop Kernel Execution", () => {
    const factMod = EosWasmBytecodeSynthesizerCore.buildFactorialModule();
    assert.ok(WebAssembly.validate(factMod.bytecode), "Factorial module must pass WebAssembly validation");

    // Test factorial values
    const testCases = [
      { input: 0, expected: 1 },
      { input: 1, expected: 1 },
      { input: 4, expected: 24 },
      { input: 5, expected: 120 },
      { input: 6, expected: 720 },
      { input: 10, expected: 3628800 },
    ];

    for (const tc of testCases) {
      const res = EosWasmBytecodeSynthesizerCore.executeModule(factMod, "factorial", [tc.input]);
      assert.strictEqual(res.status, "SUCCESS");
      assert.strictEqual(res.returnedValue, tc.expected, `Factorial(${tc.input}) mismatch`);
    }
  });

  it("BDD-1614: Linear Memory Allocation and Hardware-Enforced Out-of-Bounds Traps", () => {
    const memMod = EosWasmBytecodeSynthesizerCore.buildMemoryTrapModule(1); // 1 page = 65536 bytes
    assert.ok(WebAssembly.validate(memMod.bytecode), "Memory trap module must validate");

    // Nominal in-bounds read
    const inBoundsRes = EosWasmBytecodeSynthesizerCore.executeModule(memMod, "read_byte", [1024], (mem) => {
      const u8 = new Uint8Array(mem.buffer);
      u8[1024] = 0xab;
    });
    assert.strictEqual(inBoundsRes.status, "SUCCESS");
    assert.strictEqual(inBoundsRes.returnedValue, 0xab);

    // Out-of-bounds trap attempt at offset 65536 (boundary violation)
    const outOfBoundsRes = EosWasmBytecodeSynthesizerCore.executeModule(memMod, "read_byte", [65536]);
    assert.strictEqual(outOfBoundsRes.status, "RUNTIME_TRAP");
    assert.ok(
      outOfBoundsRes.trapMessage?.toLowerCase().includes("out of bounds"),
      "Must capture native hardware memory trap",
    );
  });

  it("BDD-1615: Multi-Vector Dot Product Kernel Execution", () => {
    const dotMod = EosWasmBytecodeSynthesizerCore.buildVectorDotProductModule();
    assert.ok(WebAssembly.validate(dotMod.bytecode), "Vector dot product module must validate");

    const vecA = [3, -5, 8, 2, 10];
    const vecB = [4, 2, -1, 7, 3];
    // Expected: 3*4 + (-5)*2 + 8*(-1) + 2*7 + 10*3 = 12 - 10 - 8 + 14 + 30 = 38
    const expected = 38;

    const res = EosWasmBytecodeSynthesizerCore.executeModule(
      dotMod,
      "dot_product",
      [0, 20, 5], // offsetA=0, offsetB=20 (5 ints = 20 bytes), length=5
      (mem) => {
        const view = new Int32Array(mem.buffer);
        view.set(vecA, 0); // index 0..4
        view.set(vecB, 5); // index 5..9
      },
    );

    assert.strictEqual(res.status, "SUCCESS");
    assert.strictEqual(res.returnedValue, expected);
    assert.ok(res.executionTimeNs >= 0n);
  });

  it("BDD-1616: End-to-End Cryptographic Audit Receipt Generation", () => {
    const receipt = EosWasmBytecodeSynthesizerCore.auditWasmSynthesizerPipeline({
      projectRoot: process.cwd(),
    });

    assert.strictEqual(receipt.receiptType, "EOS_WASM_SYNTHESIZER_AUDIT");
    assert.strictEqual(receipt.specRef, "SPEC-306");
    assert.strictEqual(receipt.validWasmMagicVerified, true);
    assert.strictEqual(receipt.leb128FidelityVerified, true);
    assert.strictEqual(receipt.arithmeticKernelVerified, true);
    assert.strictEqual(receipt.loopFactorialKernelVerified, true);
    assert.strictEqual(receipt.linearMemoryTrapCaught, true);
    assert.strictEqual(receipt.vectorDotProductVerified, true);
    assert.strictEqual(receipt.modulesEvaluated, 4);
    assert.strictEqual(typeof receipt.sha256Signature, "string");
    assert.strictEqual(receipt.sha256Signature.length, 64);

    const receiptPath = resolveEvidencePath("WASM_SYNTHESIZER_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath), "Receipt file must exist on disk");

    const onDisk = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.strictEqual(onDisk.sha256Signature, receipt.sha256Signature);
  });

  it("Edge cases: invalid bytecode validation, non-Error traps, missing memory/exports, and defaults", () => {
    // 1. Default minPages on buildMemoryTrapModule() and default args on executeModule()
    const defaultMemMod = EosWasmBytecodeSynthesizerCore.buildMemoryTrapModule();
    assert.strictEqual(defaultMemMod.memoryDeclared, true);
    const defaultRead = EosWasmBytecodeSynthesizerCore.executeModule(defaultMemMod, "read_byte");
    assert.strictEqual(defaultRead.status, "SUCCESS");
    assert.strictEqual(defaultRead.returnedValue, 0);

    // 2. Corrupted WASM module fails WebAssembly.validate -> VALIDATION_FAILED
    const invalidModule = {
      bytecode: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
      sha256: "0".repeat(64),
      totalBytes: 4,
      exportedNames: [],
      memoryDeclared: false,
    };
    const invalidRes = EosWasmBytecodeSynthesizerCore.executeModule(invalidModule, "add", [1, 2]);
    assert.strictEqual(invalidRes.status, "VALIDATION_FAILED");
    assert.strictEqual(invalidRes.executionTimeNs, 0n);
    assert.strictEqual(invalidRes.executionTimeUs, 0);
    assert.match(invalidRes.trapMessage ?? "", /failed validation/);

    // 3. setupMemory provided for module without exported memory (false branch of instanceof check)
    const addMod = EosWasmBytecodeSynthesizerCore.buildAddModule();
    let setupCalled = false;
    const addWithSetup = EosWasmBytecodeSynthesizerCore.executeModule(addMod, "add", [3, 4], () => {
      setupCalled = true;
    });
    assert.strictEqual(addWithSetup.status, "SUCCESS");
    assert.strictEqual(addWithSetup.returnedValue, 7);
    assert.strictEqual(setupCalled, false);

    // 4. Missing export triggers precondition Error -> RUNTIME_TRAP
    const missingExport = EosWasmBytecodeSynthesizerCore.executeModule(addMod, "nonexistent", []);
    assert.strictEqual(missingExport.status, "RUNTIME_TRAP");
    assert.match(missingExport.trapMessage ?? "", /is not a function/);

    // 5. Non-Error thrown in setupMemory hits String(err) branch
    const stringTrap = EosWasmBytecodeSynthesizerCore.executeModule(defaultMemMod, "read_byte", [0], () => {
      throw "non-error-trap-value";
    });
    assert.strictEqual(stringTrap.status, "RUNTIME_TRAP");
    assert.strictEqual(stringTrap.trapMessage, "non-error-trap-value");

    // 6. LEB128 edge cases (negative ULEB128 error, non-zero offset, empty buffer)
    assert.throws(() => encodeUleb128(-1), /non-negative/);
    const decodedAtOffset = decodeUleb128([0xff, 0x80, 0x01], 1);
    assert.strictEqual(decodedAtOffset.value, 128);
    assert.strictEqual(decodedAtOffset.bytesRead, 2);
    assert.deepStrictEqual(decodeUleb128([]), { value: 0, bytesRead: 0 });

    // 7. Default benchmarkKernel() and default auditWasmSynthesizerPipeline()
    const bench = EosWasmBytecodeSynthesizerCore.benchmarkKernel();
    assert.strictEqual(bench.operationsCount, 20000);
    const defaultReceipt = EosWasmBytecodeSynthesizerCore.auditWasmSynthesizerPipeline();
    assert.strictEqual(defaultReceipt.specRef, "SPEC-306");
    const emptyOptsReceipt = EosWasmBytecodeSynthesizerCore.auditWasmSynthesizerPipeline({});
    assert.strictEqual(emptyOptsReceipt.specRef, "SPEC-306");
  });
});
