/**
 * @file eosAutonomousWasmJit.test.mjs
 * @description Automated test suite for SPEC-347 / CHANGE-209 (BDD-1861..BDD-1866).
 * Verifies binary WebAssembly synthesis, LEB128 encoding, pre-baked math and vector kernels,
 * dynamic arithmetic AST compilation, fail-safe validation barriers, execution throughput,
 * CLI dispatch, and Phase 8 MCP tool integration.
 *
 * Invariant: Pure Layer-0 testing, zero external runtime dependencies, hermetic receipts.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  encodeSignedLeb128,
  encodeUnsignedLeb128,
  EosAutonomousWasmJitCore,
  WASM_MAGIC,
  WASM_VERSION,
} from "../src/core/eosAutonomousWasmJit.ts";
import { handleAutonomousWasmJitCommand } from "../bin/commands/cliAutonomousWasmJit.mjs";
import { createPhase8AgiHandlers } from "../src/mcp/tools/eosMcpPhase8AgiHandlers.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

test("SPEC-347 / BDD-1861: Binary WebAssembly Header and Section Synthesis", () => {
  // Test LEB128 codecs
  assert.deepEqual(encodeUnsignedLeb128(0), [0]);
  assert.deepEqual(encodeUnsignedLeb128(1), [1]);
  assert.deepEqual(encodeUnsignedLeb128(624485), [0xe5, 0x8e, 0x26]);

  assert.deepEqual(encodeSignedLeb128(0), [0]);
  assert.deepEqual(encodeSignedLeb128(-1), [0x7f]);
  assert.deepEqual(encodeSignedLeb128(42), [42]);

  const mathMod = EosAutonomousWasmJitCore.compileSimpleMath();
  const bytes = mathMod.buffer;

  // Verify Magic Header \0asm
  assert.equal(bytes[0], WASM_MAGIC[0]);
  assert.equal(bytes[1], WASM_MAGIC[1]);
  assert.equal(bytes[2], WASM_MAGIC[2]);
  assert.equal(bytes[3], WASM_MAGIC[3]);

  // Verify Version 1
  assert.equal(bytes[4], WASM_VERSION[0]);
  assert.equal(bytes[5], WASM_VERSION[1]);
  assert.equal(bytes[6], WASM_VERSION[2]);
  assert.equal(bytes[7], WASM_VERSION[3]);

  // Verify WebAssembly.validate() passes
  const raw = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  assert.equal(WebAssembly.validate(raw), true);
  assert.ok(typeof mathMod.exports.compute === "function");
});

test("SPEC-347 / BDD-1862: Pre-baked Vector Dot Product Kernel Instantiation and Execution", () => {
  const dotMod = EosAutonomousWasmJitCore.compileVectorDotProduct();
  assert.ok(typeof dotMod.exports.dotProduct2D === "function");

  // (1.5, 2.0) . (3.0, 4.0) = 1.5*3.0 + 2.0*4.0 = 4.5 + 8.0 = 12.5
  const res1 = dotMod.exports.dotProduct2D(1.5, 2.0, 3.0, 4.0);
  assert.ok(Math.abs(res1 - 12.5) < 1e-5);

  // Orthogonal vectors: (1.0, 0.0) . (0.0, 1.0) = 0.0
  const res2 = dotMod.exports.dotProduct2D(1.0, 0.0, 0.0, 1.0);
  assert.ok(Math.abs(res2 - 0.0) < 1e-5);
});

test("SPEC-347 / BDD-1863: Dynamic Arithmetic AST Bytecode Compilation", () => {
  // ((a * b) + (c - d))
  const ast = {
    type: "BINARY_OP",
    op: "ADD",
    left: {
      type: "BINARY_OP",
      op: "MUL",
      left: { type: "PARAM", paramIndex: 0 },
      right: { type: "PARAM", paramIndex: 1 },
    },
    right: {
      type: "BINARY_OP",
      op: "SUB",
      left: { type: "PARAM", paramIndex: 2 },
      right: { type: "PARAM", paramIndex: 3 },
    },
  };

  const mod = EosAutonomousWasmJitCore.compileExpressionAST(ast, 4);
  assert.ok(typeof mod.exports.evalAST === "function");

  // (3 * 4) + (10 - 2) = 12 + 8 = 20
  const res = mod.exports.evalAST(3, 4, 10, 2);
  assert.equal(res, 20);

  // Simple XOR AST: (a ^ b)
  const xorAst = {
    type: "BINARY_OP",
    op: "XOR",
    left: { type: "PARAM", paramIndex: 0 },
    right: { type: "PARAM", paramIndex: 1 },
  };
  const xorMod = EosAutonomousWasmJitCore.compileExpressionAST(xorAst, 2);
  const xorRes = xorMod.exports.evalAST(0b1100, 0b1010);
  assert.equal(xorRes, 0b0110);
});

test("SPEC-347 / BDD-1864: Fast Bitwise XOR Step Kernel Synthesis", () => {
  const xorMod = EosAutonomousWasmJitCore.compileBitwiseXorStep();
  assert.ok(typeof xorMod.exports.xorStep === "function");

  const res = xorMod.exports.xorStep(0x1234, 0x4321);
  assert.equal(res, 0x1234 ^ 0x4321);
});

test("SPEC-347 / BDD-1865: Fail-Safe Validation and Bytecode Malformation Isolation", () => {
  // Truncated / invalid WASM buffer (only header, missing sections or bad opcode)
  const badBuffer = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0xff, 0xff]);

  assert.throws(
    () => {
      EosAutonomousWasmJitCore.instantiate(badBuffer);
    },
    {
      message: /WASM_JIT_VALIDATION_FAILED/,
    },
  );
});

test("SPEC-347 / BDD-1866: WASM Execution Throughput Benchmark and Cryptographic Audit Receipt", async () => {
  // 1. Audit receipt emission
  const receipt = EosAutonomousWasmJitCore.audit(ROOT);
  assert.equal(receipt.spec, "SPEC-347");
  assert.equal(receipt.validModuleEmitted, true);
  assert.equal(receipt.kernelsVerified, true);
  assert.ok(receipt.benchmarkOpsPerSec > 500_000);
  assert.equal(receipt.allPassed, true);
  assert.ok(receipt.sha256.length === 64);

  // 2. CLI Dispatch execution
  const cliEmit = await handleAutonomousWasmJitCommand({
    command: "toolchain:wasmjit:emit",
    args: ["--kernel=math", "--json"],
  });
  assert.equal(cliEmit, true);

  const cliExec = await handleAutonomousWasmJitCommand({
    command: "toolchain:wasmjit:exec",
    args: ["--a=10", "--b=5", "--json"],
  });
  assert.equal(cliExec, true);

  const cliBench = await handleAutonomousWasmJitCommand({
    command: "toolchain:wasmjit:bench",
    args: ["--iters=10000", "--json"],
  });
  assert.equal(cliBench, true);

  const cliAudit = await handleAutonomousWasmJitCommand({
    command: "toolchain:wasmjit:audit",
    args: ["--json"],
  });
  assert.equal(cliAudit, true);

  // 3. Phase 8 MCP Tool Execution
  const handlers = createPhase8AgiHandlers({ projectRoot: ROOT });
  assert.ok(typeof handlers.eos_wasmjit_compiler_audit === "function");
  const mcpReceipt = await handlers.eos_wasmjit_compiler_audit({});
  assert.equal(mcpReceipt.spec, "SPEC-347");
  assert.equal(mcpReceipt.allPassed, true);
});
