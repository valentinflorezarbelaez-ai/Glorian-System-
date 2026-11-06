/**
 * test/eosStreamWasmHardening.test.mjs
 *
 * SPEC-144 / CHANGE-079: MCP Streamable HTTP Lifecycle & Preemptive Wasm Worker Hardening
 * Comprehensive end-to-end regression and adversarial suite verifying BDD-398 to BDD-403.
 * ZERO runtime NPM dependencies — 100% Layer-0 Pure TypeScript / Node.js standard library.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { EosMcpStreamServer, StreamableSession } from "../src/mcp/eosMcpStreamServer.ts";
import { EosWasmSandboxEngine, WASM_BYTECODE_TEMPLATES } from "../src/core/eosWasmSandboxEngine.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const VALID_TEST_TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

async function startServer(options = {}) {
  const server = new EosMcpStreamServer(projectRoot, 0, {
    authToken: VALID_TEST_TOKEN,
    ...options
  });
  const listener = await server.listen(0, "127.0.0.1");
  const port = listener.address().port;
  return { server, port, close: () => server.close() };
}

function request(port, pathname, { method = "POST", token, origin, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const requestHeaders = { ...headers };
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
    if (origin) requestHeaders.Origin = origin;
    if (body !== undefined) {
      requestHeaders["Content-Type"] ||= "application/json";
      requestHeaders["Content-Length"] ||= Buffer.byteLength(body);
    }
    const req = http.request(`http://127.0.0.1:${port}${pathname}`, { method, headers: requestHeaders }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let parsed;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, text });
      });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

// =============================================================================
// BDD-398: Aislamiento Forzoso en Worker de Todo Bytecode Wasm Arbitrario (args.code)
// =============================================================================
test("BDD-398: Aislamiento Forzoso en Worker de Todo Bytecode Wasm Arbitrario (args.code)", async () => {
  const server = new EosMcpServer(projectRoot);

  // Custom Base64 encoded infinite loop bytecode (loop (br 0))
  const loopBase64 = Buffer.from(WASM_BYTECODE_TEMPLATES.LOOP).toString("base64");

  const t0 = Date.now();
  // Intentionally pass worker: false and omit template: "LOOP" to test strict enforcement
  const mcpRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: "req-untrusted-loop",
    method: "tools/call",
    params: {
      name: "eos_wasm_sandbox",
      arguments: {
        tier: "WASM",
        code: loopBase64,
        worker: false, // Must be ignored by mandatory isolation rule (FR-420 / ADR-0181)
        timeoutMs: 100
      }
    }
  });
  const elapsedMs = Date.now() - t0;

  assert.ok(mcpRes.result?.content?.[0]?.text, "Response must contain JSON output");
  const parsed = JSON.parse(mcpRes.result.content[0].text);

  assert.equal(parsed.status, "TIMEOUT_KILLED", "Infinite loop bytecode must be terminated with TIMEOUT_KILLED");
  assert.equal(parsed.exitCode, 1, "Exit code must be 1 on killed execution");
  // 3.5s bound: worker spawn+kill under parallel Stage-4 can land ~1.8s on Windows CI;
  // semantic gate remains TIMEOUT_KILLED + deadline stderr (not a fixed micro-SLA).
  assert.ok(elapsedMs < 3500, `Execution must return promptly without freezing event loop (took ${elapsedMs}ms)`);
  assert.ok(parsed.stderr.some((e) => e.includes("deadline") || e.includes("terminated")), "Stderr must record deadline termination");
});

// =============================================================================
// BDD-399: Cierre Grácil de Sockets, Emisión de session_closing e Idempotencia en close()
// =============================================================================
test("BDD-399: Cierre Grácil de Sockets, Emisión de session_closing e Idempotencia en close()", () => {
  const session = new StreamableSession("sess-test-399", "dummy-token-hash");

  const writtenChunks = [];
  let endCallCount = 0;

  const mockRes = {
    writable: true,
    writableEnded: false,
    destroyed: false,
    write(chunk) {
      writtenChunks.push(chunk);
      return true;
    },
    end() {
      endCallCount++;
      this.writableEnded = true;
    }
  };

  session.attachResponse(mockRes);
  assert.equal(session.activeResponse, mockRes);

  // First invocation
  session.close("TEST_TERMINATION");

  assert.equal(session.isClosing, true);
  assert.equal(session.isClosed, true);
  assert.equal(session.activeResponse, null, "activeResponse must be nullified after close");
  assert.equal(mockRes.writableEnded, true, "res.end() MUST be called");
  assert.equal(endCallCount, 1, "res.end() must be called exactly once");

  const combinedOutput = writtenChunks.join("");
  assert.match(combinedOutput, /event: session_closing/);
  assert.match(combinedOutput, /"reason":"TEST_TERMINATION"/);
  assert.match(combinedOutput, /"sessionId":"sess-test-399"/);

  // Subsequent concurrent/redundant invocations must be idempotent no-ops
  session.close("SECOND_CALL");
  session.close("THIRD_CALL");

  assert.equal(endCallCount, 1, "Subsequent calls to close() must NOT invoke res.end() again");
  assert.equal(writtenChunks.length, 1, "No additional frames must be written after initial close");
});

// =============================================================================
// BDD-400: Desconexión SSE Enlazada Estrictamente a res.on("close")
// =============================================================================
test("BDD-400: Desconexión SSE Enlazada Estrictamente a res.on('close')", async () => {
  const running = await startServer({ authToken: VALID_TEST_TOKEN });

  try {
    // 1. Initialize session via POST
    const initRes = await request(running.port, "/api/mcp", {
      method: "POST",
      token: VALID_TEST_TOKEN,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "init-400",
        method: "initialize",
        params: { protocolVersion: "2025-06-18" }
      })
    });

    const sessionId = initRes.headers["mcp-session-id"];
    assert.ok(sessionId, "Session must be initialized");

    const sessionObj = running.server.getOrCreateStreamableSession(VALID_TEST_TOKEN, sessionId).session;
    assert.ok(sessionObj, "Session object must exist in server");

    // 2. Connect GET /api/mcp SSE stream
    const req = http.request(`http://127.0.0.1:${running.port}/api/mcp`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${VALID_TEST_TOKEN}`,
        "MCP-Session-Id": sessionId
      }
    });

    await new Promise((resolve) => {
      req.on("response", (res) => {
        assert.equal(res.statusCode, 200);
        assert.match(res.headers["content-type"], /text\/event-stream/);
        // Verify activeResponse is attached
        assert.ok(sessionObj.activeResponse, "Server must have activeResponse attached");
        resolve();
      });
      req.end();
    });

    // Verify session remains attached after request headers are sent
    assert.ok(sessionObj.activeResponse, "Session must remain attached after request headers consume");

    // 3. Abort client connection and verify res.on('close') cleanly detaches response
    req.destroy();

    // Allow event loop to process TCP reset / close
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.equal(sessionObj.activeResponse, null, "activeResponse must be detached after socket disconnect");
  } finally {
    await running.close();
  }
});

// =============================================================================
// BDD-401: Preservación de Sesiones Solo-Lectura mediante Renovación de TTL en Heartbeats
// =============================================================================
test("BDD-401: Preservación de Sesiones Solo-Lectura mediante Renovación de TTL en Heartbeats", () => {
  const server = new EosMcpStreamServer(projectRoot, 0);
  const session = new StreamableSession("sess-heartbeat-401", "dummy-token-hash");
  server.streamableSessions.set(session.id, session);

  let wroteHeartbeat = false;
  const mockRes = {
    writable: true,
    writableEnded: false,
    destroyed: false,
    write(chunk) {
      if (chunk.includes(": keep-alive")) wroteHeartbeat = true;
      return true;
    },
    end() { this.writableEnded = true; }
  };

  session.attachResponse(mockRes);

  // Artificially age the session to 50 seconds in the past
  session.lastActivity = Date.now() - 50000;
  const oldActivity = session.lastActivity;

  // Send heartbeat
  session.sendHeartbeat();

  assert.equal(wroteHeartbeat, true, "Heartbeat comment must be written");
  assert.ok(session.lastActivity > oldActivity + 40000, "Heartbeat MUST touch lastActivity to current timestamp");

  // Verify that reaper with a 40-second window does NOT reap this active stream
  const reaped = server.reapIdleSessions(40000);
  assert.equal(reaped, 0, "Active session receiving heartbeats must NOT be reaped");
  assert.equal(server.streamableSessions.has(session.id), true, "Session must remain in server");
});

// =============================================================================
// BDD-402: Notificación Grácil de Cierre en Shutdown y Auditoría de Descarte de Eventos
// =============================================================================
test("BDD-402: Notificación Grácil de Cierre en Shutdown y Auditoría de Descarte de Eventos", async () => {
  // 1. Verify buffer overrun and droppedEventsCount
  const session = new StreamableSession("sess-buffer-402", "dummy-token", 5);
  for (let i = 1; i <= 8; i++) {
    session.addEvent("test", { seq: i });
  }

  assert.equal(session.ringBuffer.length, 5, "Ring buffer must not exceed max size of 5");
  assert.equal(session.droppedEventsCount, 3, "Exactly 3 oldest events must have been shifted");

  // 2. Verify server shutdown broadcasting session_closing
  const running = await startServer({ authToken: VALID_TEST_TOKEN });

  try {
    const initRes = await request(running.port, "/api/mcp", {
      method: "POST",
      token: VALID_TEST_TOKEN,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "init-402",
        method: "initialize",
        params: { protocolVersion: "2025-06-18" }
      })
    });
    const sessionId = initRes.headers["mcp-session-id"];

    // Connect SSE client
    const chunks = [];
    let onStreamEnded;
    const streamEndPromise = new Promise((resolve) => {
      onStreamEnded = resolve;
    });

    const req = http.request(`http://127.0.0.1:${running.port}/api/mcp`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${VALID_TEST_TOKEN}`,
        "MCP-Session-Id": sessionId
      }
    });

    await new Promise((resolve) => {
      req.on("response", (res) => {
        res.on("data", (chunk) => chunks.push(chunk.toString("utf8")));
        res.on("end", () => {
          onStreamEnded();
        });
        resolve();
      });
      req.end();
    });

    // Close server (simulating graceful SIGTERM shutdown)
    await running.close();
    await streamEndPromise;

    const fullSse = chunks.join("");
    assert.match(fullSse, /event: session_closing/, "Closing frame must be transmitted upon server shutdown");
    assert.match(fullSse, /"reason":"SERVER_SHUTDOWN"/, "Reason must indicate SERVER_SHUTDOWN");
  } finally {
    // Cleanup if not already closed
    try { await running.close(); } catch {}
  }
});

// =============================================================================
// BDD-403: Terminación Estricta de Workers y Rechazo de Bytecode Sobredimensionado
// =============================================================================
test("BDD-403: Terminación Estricta de Workers y Rechazo de Bytecode Sobredimensionado", async () => {
  const server = new EosMcpServer(projectRoot);

  // 1. Bytecode exceeding limits must be rejected before spawning worker
  const oversizedBase64 = Buffer.alloc(300 * 1024, 0x00).toString("base64");

  const oversizedRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: "req-oversized",
    method: "tools/call",
    params: {
      name: "eos_wasm_sandbox",
      arguments: {
        tier: "WASM",
        code: oversizedBase64
      }
    }
  });

  assert.ok(oversizedRes.error, "Oversized string argument must return JSON-RPC error");
  assert.match(oversizedRes.error.message, /exceeds/i);

  // 1b. Engine pre-spawn check on raw binary payload > 512 KiB
  const engine = new EosWasmSandboxEngine(projectRoot);
  const oversizedBytes = new Uint8Array(600 * 1024);
  const engineResult = await engine.executeWasmWorker(oversizedBytes);

  assert.equal(engineResult.status, "EXECUTION_FAILED");
  assert.ok(engineResult.stderr.some((e) => e.includes("exceeds maximum allowed size of 524288 bytes")));

  // 2. Verify active worker count remains bounded and resets after execution
  const addResult = await engine.executeWasmWorker(WASM_BYTECODE_TEMPLATES.ADD, {
    entryFunction: "add",
    functionArgs: [15, 27]
  });

  assert.equal(addResult.status, "COMPLETED");
  assert.equal(addResult.returnValue, 42);
  assert.equal(EosWasmSandboxEngine.activeWorkerCount, 0, "activeWorkerCount must return to 0 after worker completion");
});
