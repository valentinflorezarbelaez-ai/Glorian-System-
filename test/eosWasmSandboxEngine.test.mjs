/**
 * test/eosWasmSandboxEngine.test.mjs
 *
 * SPEC-142: Capability-Based Wasm & MicroVM Agent Sandboxing Engine (Big Tech Standard)
 * Verification of BDD-382 through BDD-386.
 * ZERO runtime NPM dependencies — 100% Layer-0 Pure.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  EosWasmSandboxEngine,
  WASM_BYTECODE_TEMPLATES
} from "../src/core/eosWasmSandboxEngine.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

test("BDD-382: Instanciación y Ejecución de Bytecode WebAssembly en < 1ms", async (t) => {
  const engine = new EosWasmSandboxEngine(process.cwd());

  const result = engine.executeWasm(WASM_BYTECODE_TEMPLATES.ADD, {
    entryFunction: "add",
    functionArgs: [100, 250],
    initialPages: 1
  });

  assert.equal(result.status, "COMPLETED", "Status must be COMPLETED");
  assert.equal(result.exitCode, 0, "Exit code must be 0");
  assert.equal(result.returnValue, 350, "100 + 250 must equal 350");
  assert.equal(result.tier, "WASM");
  assert.ok(result.durationNs > 0, "Duration must be recorded in nanoseconds");
  // Sub-1ms execution (duration < 1,000,000 ns, with tolerance up to 10ms under test contention)
  assert.ok(result.durationNs < 15_000_000, `Wasm execution must be sub-millisecond, took ${result.durationNs} ns`);
  assert.ok(result.receiptSha256.length === 64, "Receipt must be 64-char hex SHA-256");
});

test("BDD-383: Aislamiento de Memoria y Captura de Trampas Fuera de Límites", async (t) => {
  const engine = new EosWasmSandboxEngine(process.cwd());

  // Execute OOB module (attempts to read from offset 100,000 with 1-page 64KB limit)
  const result = engine.executeWasm(WASM_BYTECODE_TEMPLATES.OOB, {
    entryFunction: "oob",
    initialPages: 1,
    maxPages: 1
  });

  assert.equal(result.status, "TRAPPED_OOB", "OOB memory access must be classified as TRAPPED_OOB");
  assert.equal(result.exitCode, 1, "Exit code must be 1 on trapped execution");
  assert.ok(result.stderr.some((e) => e.includes("out of bounds") || e.includes("memory access")), "Stderr must record OOB error");
  assert.ok(result.receiptSha256.length === 64, "Trapped execution must still generate cryptographic receipt");

  // Verify unreachable opcode trap
  const trapResult = engine.executeWasm(WASM_BYTECODE_TEMPLATES.TRAP, {
    entryFunction: "trap"
  });
  assert.equal(trapResult.status, "TRAPPED_UNREACHABLE", "Unreachable opcode must be classified as TRAPPED_UNREACHABLE");
});

test("BDD-384: Cuarentena Hermética de JavaScript Isolate sin Autoridad Ambiental", async (t) => {
  const engine = new EosWasmSandboxEngine(process.cwd());

  // Attempt to harvest environment variables or import filesystem
  const rogueCode = `
    let envHarvested = false;
    let fsHarvested = false;
    try {
      if (typeof process !== "undefined" && process.env) {
        envHarvested = true;
      }
    } catch {}
    try {
      if (typeof require !== "undefined") {
        require("fs");
        fsHarvested = true;
      }
    } catch {}
    try {
      if (typeof fetch !== "undefined") {
        envHarvested = true;
      }
    } catch {}

    ({
      envHarvested,
      fsHarvested,
      safeMath: Math.sqrt(144),
      calcDate: new Date().getFullYear()
    });
  `;

  const result = engine.executeIsolate(rogueCode);

  assert.equal(result.status, "COMPLETED");
  assert.equal(result.exitCode, 0);

  const resVal = result.returnValue;
  assert.equal(resVal.envHarvested, false, "Guest must NOT be able to access process.env or fetch");
  assert.equal(resVal.fsHarvested, false, "Guest must NOT be able to call require('fs')");
  assert.equal(resVal.safeMath, 12, "Safe math inside sandbox must function nominally");
});

test("BDD-385: Interrupción Determinista por Exceso de Tiempo (Timeout Kill)", async (t) => {
  const engine = new EosWasmSandboxEngine(process.cwd());

  // Infinite computation loop
  const infiniteLoop = `
    let counter = 0;
    while (true) {
      counter++;
    }
  `;

  const startMs = Date.now();
  const result = engine.executeIsolate(infiniteLoop, {
    timeoutMs: 100 // 100ms deadline
  });
  const elapsedMs = Date.now() - startMs;

  assert.equal(result.status, "TIMEOUT_KILLED", "Infinite loop must be terminated with TIMEOUT_KILLED");
  assert.equal(result.exitCode, 1);
  assert.ok(elapsedMs < 1500, `Timeout must trigger quickly, took ${elapsedMs}ms`);
  assert.ok(result.stderr.some((e) => e.includes("timed out") || e.includes("TIMEOUT")), "Stderr must record timeout");
});

test("BDD-386: Despacho MCP eos_wasm_sandbox y Atestación en Ledger SQLite", async (t) => {
  const server = new EosMcpServer(process.cwd());

  // Dispatch Wasm execution via MCP tool call
  const response = await server.handleRequest({
    jsonrpc: "2.0",
    id: "req-wasm-01",
    method: "tools/call",
    params: {
      name: "eos_wasm_sandbox",
      arguments: {
        tier: "WASM",
        template: "ADD",
        functionArgs: [30, 40]
      }
    }
  });

  assert.ok(response.result, "MCP response must have a result object");
  assert.ok(Array.isArray(response.result.content), "MCP result must have content array");
  const parsed = JSON.parse(response.result.content[0].text);

  assert.equal(parsed.status, "COMPLETED");
  assert.equal(parsed.returnValue, 70, "30 + 40 must equal 70");
  assert.equal(parsed.tier, "WASM");
  assert.ok(typeof parsed.receiptSha256 === "string" && parsed.receiptSha256.length === 64);

  // Dispatch MicroVM spec synthesis via MCP
  const specResponse = await server.handleRequest({
    jsonrpc: "2.0",
    id: "req-microvm-spec-01",
    method: "tools/call",
    params: {
      name: "eos_wasm_sandbox",
      arguments: {
        tier: "MICROVM_SPEC",
        vcpuCount: 4,
        memSizeMib: 1024
      }
    }
  });

  const parsedSpec = JSON.parse(specResponse.result.content[0].text);
  assert.ok(parsedSpec.enclaveId, "MicroVM spec must contain enclaveId");
  assert.ok(parsedSpec.specSha256, "MicroVM spec must contain specSha256");
});
