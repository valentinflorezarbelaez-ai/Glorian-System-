/**
 * EOS SYSTEM — LAYER-0 WASM BYTECODE DECOMPILER & FORMAL PROVER TEST SUITE
 * Governed by SPEC-203, CHANGE-088, ADR-088, BDD-1034..BDD-1038 (v73.0.0)
 *
 * Validates binary WASM header/section parsing, LEB128 decoding,
 * opcode instruction disassembly, canonical WAT decompilation, formal operand
 * stack underflow proving, memory bounds checking, purity analysis, and CLI receipts.
 * Strictly ZERO external dependencies. Pure JavaScript for Node 24 native runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EosWasmBytecodeDecompilerProver } from "../src/core/eosWasmBytecodeDecompilerProver.ts";
import { WASM_BYTECODE_TEMPLATES } from "../src/core/eosWasmSandboxEngine.ts";

describe("EosWasmBytecodeDecompilerProver (SPEC-203 / BDD-1034..BDD-1038)", () => {
  it("BDD-1034: WASM binary section parsing and LEB128 decoding", () => {
    // 1. LEB128 Unsigned decoding
    const uLebBytes = new Uint8Array([0xe5, 0x8e, 0x26]); // 624485
    const uResult = EosWasmBytecodeDecompilerProver.decodeLeb128Unsigned(uLebBytes, 0);
    assert.equal(uResult.value, 624485);
    assert.equal(uResult.bytesRead, 3);

    // 2. LEB128 Signed decoding
    const sLebBytes = new Uint8Array([0xc0, 0xbb, 0x78]); // -123456
    const sResult = EosWasmBytecodeDecompilerProver.decodeLeb128Signed(sLebBytes, 0);
    assert.equal(sResult.value, -123456);
    assert.equal(sResult.bytesRead, 3);

    // 3. Module header & section extraction on ADD template
    const parsed = EosWasmBytecodeDecompilerProver.parseModule(WASM_BYTECODE_TEMPLATES.ADD);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.types.length, 1);
    assert.deepEqual(parsed.types[0].params, ["i32", "i32"]);
    assert.deepEqual(parsed.types[0].results, ["i32"]);
    assert.equal(parsed.functions.length, 1);
    assert.equal(parsed.functions[0].exportName, "add");
    assert.equal(parsed.sha256Checksum.length, 64);
  });

  it("BDD-1035: Instruction disassembly and S-expression WAT decompilation", () => {
    const parsed = EosWasmBytecodeDecompilerProver.parseModule(WASM_BYTECODE_TEMPLATES.ADD);
    const fn = parsed.functions[0];

    // Check instructions disassembled
    const mnemonics = fn.instructions.map((i) => i.mnemonic);
    assert.ok(mnemonics.includes("local.get"));
    assert.ok(mnemonics.includes("i32.add"));
    assert.ok(mnemonics.includes("end"));

    // Decompile to WAT
    const wat = EosWasmBytecodeDecompilerProver.decompileToWat(parsed);
    assert.ok(wat.includes("(module"));
    assert.ok(wat.includes('(export "add")'));
    assert.ok(wat.includes("(param i32 i32)"));
    assert.ok(wat.includes("(result i32)"));
    assert.ok(wat.includes("local.get 0"));
    assert.ok(wat.includes("local.get 1"));
    assert.ok(wat.includes("i32.add"));
  });

  it("BDD-1036: Formal stack operand balance and underflow safety proof", () => {
    // 1. ADD template has balanced stack: local.get (+1), local.get (+1), i32.add (-2, +1), end -> 1 result
    const proofAdd = EosWasmBytecodeDecompilerProver.proveModuleSafety(WASM_BYTECODE_TEMPLATES.ADD);
    assert.equal(proofAdd.stackSafe, true);
    assert.equal(proofAdd.controlFlowSafe, true);
    assert.equal(proofAdd.memoryBoundsSafe, true);
    assert.equal(proofAdd.verified, true);
    assert.equal(proofAdd.isPure, true);
    assert.ok(proofAdd.maxOperandStackDepth >= 2);
    assert.equal(proofAdd.sha256Receipt.length, 64);

    // 2. Synthesize an invalid module that underflows stack (i32.add called on empty stack)
    // Create an invalid function body: [0x6a (i32.add), 0x0b (end)]
    const underflowBody = new Uint8Array([0x6a, 0x0b]);
    const instructions = EosWasmBytecodeDecompilerProver.disassembleFunction(underflowBody);

    assert.equal(instructions[0].mnemonic, "i32.add");
    assert.equal(instructions[0].pops, 2);

    // Simulate proof
    const mockModule = {
      version: 1,
      types: [{ params: [], results: ["i32"] }],
      functions: [
        {
          index: 0,
          typeIndex: 0,
          exportName: "bad",
          signature: { params: [], results: ["i32"] },
          locals: [],
          instructions,
        },
      ],
      exports: { bad: { kind: "func", index: 0 } },
      rawByteLength: 2,
      sha256Checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    };

    const badProof = EosWasmBytecodeDecompilerProver.proveModuleSafety(mockModule);
    assert.equal(badProof.stackSafe, false);
    assert.equal(badProof.verified, false);
    assert.ok(badProof.issues.some((iss) => iss.includes("Stack underflow")));
  });

  it("BDD-1037: Control-flow integrity, memory bounds checking, and purity classification", () => {
    // 1. OOB template loads from offset 100,000 when only 1 page (65,536 bytes) is allocated
    const parsedOob = EosWasmBytecodeDecompilerProver.parseModule(WASM_BYTECODE_TEMPLATES.OOB);
    assert.ok(parsedOob.memory !== undefined);
    assert.equal(parsedOob.memory.initialPages, 1);

    const proofOob = EosWasmBytecodeDecompilerProver.proveModuleSafety(parsedOob);
    // Should detect that 100,000 exceeds 65,536 bytes
    assert.equal(proofOob.isPure, false);
    assert.equal(proofOob.memoryBoundsSafe, false);
    assert.equal(proofOob.verified, false);
    assert.ok(proofOob.issues.some((iss) => iss.includes("exceeds memory allocation ceiling")));

    // 2. TRAP template contains unreachable opcode
    const proofTrap = EosWasmBytecodeDecompilerProver.proveModuleSafety(WASM_BYTECODE_TEMPLATES.TRAP);
    assert.ok(proofTrap.issues.some((iss) => iss.includes("Unreachable trap instruction")));
  });

  it("BDD-1038: End-to-end CLI decompilation and cryptographic proof receipt", () => {
    // 1. glorian wasm:decompile ADD --wat
    const decompileWat = execFileSync("node", ["bin/eos.mjs", "wasm:decompile", "ADD", "--wat"], { encoding: "utf8" });
    assert.ok(decompileWat.includes("(module"));
    assert.ok(decompileWat.includes("i32.add"));

    // 2. glorian wasm:decompile ADD --json
    const decompileJson = execFileSync("node", ["bin/eos.mjs", "wasm:decompile", "ADD", "--json"], {
      encoding: "utf8",
    });
    const parsedDecompile = JSON.parse(decompileJson);
    assert.equal(parsedDecompile.action, "wasm:decompile");
    assert.equal(parsedDecompile.target, "ADD");
    assert.ok(parsedDecompile.wat.includes("(module"));
    assert.equal(parsedDecompile.sha256Checksum.length, 64);

    // 3. glorian wasm:prove ADD --json
    const proveJson = execFileSync("node", ["bin/eos.mjs", "wasm:prove", "ADD", "--json"], { encoding: "utf8" });
    const parsedProve = JSON.parse(proveJson);
    assert.equal(parsedProve.action, "wasm:prove");
    assert.equal(parsedProve.verified, true);
    assert.equal(parsedProve.stackSafe, true);
    assert.equal(parsedProve.isPure, true);
    assert.equal(parsedProve.sha256Receipt.length, 64);
  });
});
