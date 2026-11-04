/**
 * test/eosGroundTruthHardening.test.mjs
 *
 * SPEC-143 / CHANGE-078: Engineering Ground Truth, Preemptive Sandbox Isolation & Attack Surface Hardening
 * Verification of BDD-393 through BDD-397.
 * ZERO runtime NPM dependencies — 100% Layer-0 Pure TypeScript / Node.js.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EventEmitter } from "node:events";

import serverlessHandler from "../api/mcp.js";
import { EosWasmSandboxEngine, WASM_BYTECODE_TEMPLATES } from "../src/core/eosWasmSandboxEngine.ts";
import { EosHybridKnowledgeEngine } from "../src/core/eosHybridKnowledgeEngine.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { EosMcpStreamServer, StreamableSession } from "../src/mcp/eosMcpStreamServer.ts";

function mockServerless(method, options = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = options.url || "/api/mcp";
  req.headers = {
    host: "127.0.0.1:3000",
    "content-type": "application/json",
    accept: "application/json",
    ...options.headers
  };
  req.body = options.body;

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      for (const [k, v] of Object.entries(headers)) {
        this.headers[k.toLowerCase()] = v;
      }
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end(data) {
      if (data) {
        try {
          this.body = JSON.parse(data);
        } catch {
          this.body = data;
        }
      }
      return this;
    }
  };

  return { req, res };
}

// =============================================================================
// BDD-393: Eliminación de Superficie de Ataque Público en api/mcp.js
// =============================================================================
test("BDD-393: Eliminación de Superficie de Ataque Público en api/mcp.js", async (t) => {
  // 1. Attempt to invoke eos_wasm_sandbox on public serverless edge
  const { req: callReq, res: callRes } = mockServerless("POST", {
    body: {
      jsonrpc: "2.0",
      id: "attack-wasm-01",
      method: "tools/call",
      params: {
        name: "eos_wasm_sandbox",
        arguments: {
          tier: "ISOLATE",
          code: "1 + 1"
        }
      }
    }
  });

  await serverlessHandler(callReq, callRes);

  assert.equal(callRes.statusCode, 200);
  assert.equal(callRes.body.id, "attack-wasm-01");
  assert.ok(callRes.body.error, "Call to unexposed sandbox tool must return JSON-RPC error");
  assert.equal(callRes.body.error.code, -32601, "Error code must be -32601 (Method/Tool not exposed)");
  assert.match(callRes.body.error.message, /not exposed by the read-only HTTP MCP endpoint/);

  // 2. Verify tools/list omits eos_wasm_sandbox
  const { req: listReq, res: listRes } = mockServerless("POST", {
    body: {
      jsonrpc: "2.0",
      id: "tools-list-01",
      method: "tools/list"
    }
  });

  await serverlessHandler(listReq, listRes);

  assert.equal(listRes.statusCode, 200);
  assert.ok(Array.isArray(listRes.body.result?.tools));
  const toolNames = listRes.body.result.tools.map((t) => t.name);
  assert.equal(toolNames.includes("eos_wasm_sandbox"), false, "Public tools/list MUST NOT expose eos_wasm_sandbox");
  assert.ok(toolNames.includes("eos_semantic_search"), "Public tools/list must still expose read-only tools");
});

// =============================================================================
// BDD-394: Aislamiento Preemptivo de Wasm en Worker con Interrupción por Timeout
// =============================================================================
test("BDD-394: Aislamiento Preemptivo de Bytecode WebAssembly en Hilos Worker con Interrupción por Timeout", async (t) => {
  const engine = new EosWasmSandboxEngine(process.cwd());

  const t0 = Date.now();
  // Execute infinite loop bytecode (loop (br 0)) with hard 80ms timeout
  const result = await engine.executeWasmWorker(WASM_BYTECODE_TEMPLATES.LOOP, {
    entryFunction: "loop",
    timeoutMs: 80
  });
  const elapsedMs = Date.now() - t0;

  assert.equal(result.status, "TIMEOUT_KILLED", "Infinite Wasm loop must be terminated with TIMEOUT_KILLED");
  assert.equal(result.exitCode, 1, "Exit code must be 1 on killed execution");
  assert.ok(elapsedMs < 1200, `Execution must return promptly without freezing event loop (took ${elapsedMs}ms)`);
  assert.ok(result.stderr.some((e) => e.includes("deadline") || e.includes("terminated")), "Stderr must record deadline termination");
  assert.ok(result.receiptSha256.length === 64, "Killed execution must generate valid 64-char SHA-256 receipt");

  // Verify dispatch via MCP tool call
  const server = new EosMcpServer(process.cwd());
  const mcpRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: "req-loop-mcp",
    method: "tools/call",
    params: {
      name: "eos_wasm_sandbox",
      arguments: {
        tier: "WASM",
        template: "LOOP",
        timeoutMs: 80
      }
    }
  });

  assert.ok(mcpRes.result?.content?.[0]?.text);
  const parsedMcp = JSON.parse(mcpRes.result.content[0].text);
  assert.equal(parsedMcp.status, "TIMEOUT_KILLED");
  assert.equal(parsedMcp.exitCode, 1);
});

// =============================================================================
// BDD-395: Veracidad Epistémica y Honestidad Nominal en Búsqueda Híbrida
// =============================================================================
test("BDD-395: Veracidad Epistémica y Honestidad Nominal en Búsqueda Híbrida Lexical-Hash", async (t) => {
  const server = new EosMcpServer(process.cwd());

  const listRes = server.handleRequest({
    jsonrpc: "2.0",
    id: "req-tools-list",
    method: "tools/list"
  });

  const searchTool = listRes.result.tools.find((tool) => tool.name === "eos_semantic_search");
  assert.ok(searchTool, "eos_semantic_search tool must be registered");
  assert.match(
    searchTool.description,
    /hybrid lexical-vector search/i,
    "Description must explicitly declare hybrid lexical-vector nature"
  );
  assert.match(
    searchTool.description,
    /zero neural weights/i,
    "Description must explicitly disclose absence of external neural weights"
  );

  // Check package.json for Layer-0 runtime dependency purity
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.deepEqual(pkg.dependencies || {}, {}, "package.json dependencies MUST be empty ({})");
});

// =============================================================================
// BDD-396: Indexación Automática y Perezosa del Corpus Arquitectónico
// =============================================================================
test("BDD-396: Indexación Automática y Perezosa del Corpus Arquitectónico en el Arranque del Servidor MCP", async (t) => {
  // Create an in-memory engine (starts with zero documents)
  const engine = new EosHybridKnowledgeEngine(process.cwd(), ":memory:");

  // First search should automatically trigger lazy indexing
  const matches = engine.search("SLSA Level 3", { topK: 5, mode: "hybrid" });

  assert.ok(Array.isArray(matches), "Search must return an array");
  assert.ok(matches.length > 0, "Lazy indexing must populate corpus so search returns matches immediately");
  const first = matches[0];
  assert.ok(first.id, "Match must have an ID");
  assert.ok(first.title, "Match must have a title");
  assert.ok(first.score > 0, "Match score must be positive");
  assert.ok(first.filePath, "Match must have a relative filePath");
});

// =============================================================================
// BDD-397: Robustecimiento de Transporte MCP Streamable HTTP
// =============================================================================
test("BDD-397: Robustecimiento de Transporte MCP Streamable HTTP (Cosecha TTL y Latidos Heartbeat)", async (t) => {
  const streamServer = new EosMcpStreamServer(process.cwd(), 20); // 20ms heartbeat for testing

  try {
    // 1. Test idle session TTL reaping
    const token = "mock-bearer-token-with-at-least-32-bytes-of-entropy!!";
    const sessionRes = streamServer.getOrCreateStreamableSession(token);
    assert.ok(sessionRes.session, "Session must be created");
    const sessionId = sessionRes.session.id;

    // Simulate session idle aging by 20 minutes
    sessionRes.session.lastActivity = Date.now() - 20 * 60 * 1000;

    const reaped = streamServer.reapIdleSessions(15 * 60 * 1000);
    assert.equal(reaped, 1, "Idle session exceeding 15 minutes must be reaped");

    // Session should no longer exist
    const fetchAfterReap = streamServer.getOrCreateStreamableSession(token, sessionId);
    assert.equal(fetchAfterReap.session, null, "Reaped session must not be retrievable");
    assert.equal(fetchAfterReap.error?.statusCode, 404);

    // 2. Test active SSE stream heartbeat attachment and teardown
    const newSession = new StreamableSession("test-sse-session", "mock-token-hash");
    const heartbeats = [];
    const mockRes = {
      writable: true,
      writableEnded: false,
      write(chunk) {
        heartbeats.push(chunk);
      },
      end() {
        this.writableEnded = true;
      }
    };

    newSession.attachResponse(mockRes, 15); // 15ms heartbeat

    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.ok(heartbeats.length >= 2, `Expected at least 2 heartbeats, got ${heartbeats.length}`);
    assert.ok(heartbeats.every((h) => h === ": keep-alive\n\n"), "Heartbeats must match SSE comment protocol");

    // Detach on client disconnect
    newSession.detachResponse();
    const countAfterDetach = heartbeats.length;
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(heartbeats.length, countAfterDetach, "No more heartbeats should be sent after detach");
  } finally {
    await streamServer.close();
  }
});
