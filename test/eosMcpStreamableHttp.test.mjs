import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { EosMcpStreamServer, StreamableSession } from "../src/mcp/eosMcpStreamServer.ts";
import serverlessHandler from "../api/mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

async function startServer(options = {}) {
  const server = new EosMcpStreamServer(projectRoot, 0, options);
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

function mockServerless(method, { headers = {}, body } = {}) {
  const req = {
    method,
    headers: { ...headers },
    body
  };
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, val) {
      this.headers[name.toLowerCase()] = val;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.ended = true;
      return this;
    },
    end(data) {
      if (data) this.body = data;
      this.ended = true;
      return this;
    }
  };
  return { req, res };
}

// =============================================================================
// BDD-372: Dual Negotiation on Unified /api/mcp Endpoint
// =============================================================================
test("BDD-372: Dual negotiation on unified /api/mcp endpoint (application/json vs text/event-stream)", async () => {
  const running = await startServer();
  try {
    // 1. JSON Request for eos_slsa_provenance_sbom
    const jsonReqBody = JSON.stringify({
      jsonrpc: "2.0",
      id: "req-verify-1",
      method: "tools/call",
      params: {
        name: "eos_slsa_provenance_sbom",
        arguments: { mode: "verify" }
      }
    });

    const jsonRes = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: {
        Accept: "application/json",
        "MCP-Protocol-Version": "2025-06-18"
      },
      body: jsonReqBody
    });

    assert.equal(jsonRes.status, 200);
    assert.match(jsonRes.headers["content-type"], /^application\/json/);
    const assignedSessionId = jsonRes.headers["mcp-session-id"];
    assert.ok(assignedSessionId, "MCP-Session-Id must be set in response headers");
    assert.equal(jsonRes.body.jsonrpc, "2.0");
    assert.equal(jsonRes.body.id, "req-verify-1");
    assert.ok(jsonRes.body.result?.content?.[0]?.text, "Result must contain content");
    const parsedVerification = JSON.parse(jsonRes.body.result.content[0].text);
    assert.equal(parsedVerification.verification?.valid, true);

    // 2. Streamable SSE Request on same session
    const sseReqBody = JSON.stringify({
      jsonrpc: "2.0",
      id: "req-tools-2",
      method: "tools/list"
    });

    const sseRes = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: {
        Accept: "text/event-stream",
        "MCP-Session-Id": assignedSessionId,
        "MCP-Protocol-Version": "2025-06-18"
      },
      body: sseReqBody
    });

    assert.equal(sseRes.status, 200);
    assert.match(sseRes.headers["content-type"], /^text\/event-stream/);
    assert.equal(sseRes.headers["mcp-session-id"], assignedSessionId);
    assert.match(sseRes.text, /^id: \d+\nevent: message\ndata: /);

    // Extract tool names from SSE data
    const sseDataMatch = sseRes.text.match(/data: (\{.*\})\n\n/);
    assert.ok(sseDataMatch, "SSE frame must contain data payload");
    const parsedSse = JSON.parse(sseDataMatch[1]);
    assert.equal(parsedSse.id, "req-tools-2");
    const tools = parsedSse.result.tools;
    assert.equal(tools.length, 7);
    assert.ok(tools.some((t) => t.name === "eos_slsa_provenance_sbom"));

    // 3. Client notification (notifications/initialized) returns 202 Accepted without body
    const notifyBody = JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    });
    const notifyRes = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: {
        "MCP-Session-Id": assignedSessionId,
        "MCP-Protocol-Version": "2025-06-18"
      },
      body: notifyBody
    });
    assert.equal(notifyRes.status, 202);

    // 4. DELETE session termination
    const deleteRes = await request(running.port, "/api/mcp", {
      method: "DELETE",
      token: running.server.authToken,
      headers: { "MCP-Session-Id": assignedSessionId }
    });
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.body.status, "SESSION_TERMINATED");

    // Subsequent request with terminated session must fail with 404
    const reuseRes = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: {
        "MCP-Session-Id": assignedSessionId,
        "MCP-Protocol-Version": "2025-06-18"
      },
      body: jsonReqBody
    });
    assert.equal(reuseRes.status, 404);
  } finally {
    await running.close();
  }
});

// =============================================================================
// BDD-373: Cryptographic Session Binding & LRU Eviction
// =============================================================================
test("BDD-373: Session cryptographic binding to token hash and LRU eviction", async () => {
  const tokenA = crypto.randomBytes(32).toString("base64url");
  const tokenB = crypto.randomBytes(32).toString("base64url");

  const server = new EosMcpStreamServer(projectRoot, 0, {
    authToken: tokenA,
    maxSessions: 3
  });

  try {
    // 1. Session created with Token A
    const sessionResA = server.getOrCreateStreamableSession(tokenA);
    assert.ok(sessionResA.session);
    const sessionAId = sessionResA.session.id;

    // 2. Token B attempting to access Session A must be rejected with 404
    const stolenAttempt = server.getOrCreateStreamableSession(tokenB, sessionAId);
    assert.equal(stolenAttempt.session, null);
    assert.equal(stolenAttempt.error?.statusCode, 404);
    assert.match(stolenAttempt.error?.message, /mismatch/);

    // 3. LRU eviction with maxSessions = 3
    const sessionRes2 = server.getOrCreateStreamableSession(tokenA);
    const sessionRes3 = server.getOrCreateStreamableSession(tokenA);
    assert.ok(sessionRes2.session);
    assert.ok(sessionRes3.session);

    // Open 4th session -> should evict the oldest session (sessionAId)
    const sessionRes4 = server.getOrCreateStreamableSession(tokenA);
    assert.ok(sessionRes4.session);

    // Verify sessionAId is evicted and returns 404
    const evictedLookup = server.getOrCreateStreamableSession(tokenA, sessionAId);
    assert.equal(evictedLookup.session, null);
    assert.equal(evictedLookup.error?.statusCode, 404);
    assert.match(evictedLookup.error?.message, /not found/);

    // Verify sessions 2, 3, and 4 are still active
    assert.ok(server.getOrCreateStreamableSession(tokenA, sessionRes2.session.id).session);
    assert.ok(server.getOrCreateStreamableSession(tokenA, sessionRes3.session.id).session);
    assert.ok(server.getOrCreateStreamableSession(tokenA, sessionRes4.session.id).session);
  } finally {
    await server.close();
  }
});

// =============================================================================
// BDD-374: Resilient Replay via Last-Event-ID & Protocol Negotiation
// =============================================================================
test("BDD-374: Resilient replay via Last-Event-ID and protocol version negotiation", async () => {
  const running = await startServer();
  try {
    // 1. Create a session and send 2 messages to populate ring buffer
    const msg1 = JSON.stringify({ jsonrpc: "2.0", id: 101, method: "ping" });
    const res1 = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: { Accept: "text/event-stream", "MCP-Protocol-Version": "2025-06-18" },
      body: msg1
    });
    const sessionId = res1.headers["mcp-session-id"];
    assert.ok(sessionId);
    assert.match(res1.text, /id: 1\n/);

    const msg2 = JSON.stringify({ jsonrpc: "2.0", id: 102, method: "ping" });
    const res2 = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: {
        Accept: "text/event-stream",
        "MCP-Session-Id": sessionId,
        "MCP-Protocol-Version": "2025-06-18"
      },
      body: msg2
    });
    assert.match(res2.text, /id: 2\n/);

    // 2. Replay with Last-Event-ID: 1
    const msg3 = JSON.stringify({ jsonrpc: "2.0", id: 103, method: "ping" });
    const resReplay = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: {
        Accept: "text/event-stream",
        "MCP-Session-Id": sessionId,
        "Last-Event-ID": "1",
        "MCP-Protocol-Version": "2025-06-18"
      },
      body: msg3
    });
    assert.equal(resReplay.status, 200);
    // Must replay id 2, followed by new event id 3
    assert.ok(resReplay.text.includes("id: 2\n"));
    assert.ok(resReplay.text.includes("id: 3\n"));

    // 3. Out-of-bounds Last-Event-ID returns 400
    const resBadId = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: {
        Accept: "text/event-stream",
        "MCP-Session-Id": sessionId,
        "Last-Event-ID": "999",
        "MCP-Protocol-Version": "2025-06-18"
      },
      body: msg3
    });
    assert.equal(resBadId.status, 400);
    assert.match(resBadId.body.error, /not found/i);

    // 4. Non-integer Last-Event-ID returns 400
    const resNonInt = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: {
        Accept: "text/event-stream",
        "MCP-Session-Id": sessionId,
        "Last-Event-ID": "invalid-str",
        "MCP-Protocol-Version": "2025-06-18"
      },
      body: msg3
    });
    assert.equal(resNonInt.status, 400);
    assert.match(resNonInt.body.error, /integer/i);

    // 5. Unsupported Protocol Version returns 400
    const resBadProto = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: { "MCP-Protocol-Version": "1999-01-01" },
      body: msg1
    });
    assert.equal(resBadProto.status, 400);
    assert.match(resBadProto.body.error.message, /Unsupported MCP-Protocol-Version/);

    // 6. Supported Baseline 2025-03-26 returns 200
    const resProto2025 = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: { "MCP-Protocol-Version": "2025-03-26" },
      body: msg1
    });
    assert.equal(resProto2025.status, 200);

    // 7. Supported Compat 2024-11-05 returns 200
    const resProtoCompat = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: { "MCP-Protocol-Version": "2024-11-05" },
      body: msg1
    });
    assert.equal(resProtoCompat.status, 200);
  } finally {
    await running.close();
  }
});

// =============================================================================
// BDD-375: Fail-Closed DNS Rebinding, Origin Protection, & 1 MiB Cutoff
// =============================================================================
test("BDD-375: Fail-closed DNS rebinding, origin validation, and 1 MiB payload cutoff", async () => {
  const allowedOrigin = "https://ide.eos.internal";
  const running = await startServer({
    allowedOrigins: [allowedOrigin],
    maxRequestBytes: 1024 * 1024
  });

  try {
    const validBody = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" });

    // 1. Unauthorized Origin is rejected with 403 Forbidden
    const resBadOrigin = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      origin: "https://evil-attacker.com",
      body: validBody
    });
    assert.equal(resBadOrigin.status, 403);
    assert.equal(resBadOrigin.body.error, "Origin is not allowed.");

    // 2. DNS Rebinding via malformed Host header is rejected with 403
    const resBadHost = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      headers: { Host: "evil.com@127.0.0.1" },
      body: validBody
    });
    assert.equal(resBadHost.status, 403);

    // 3. Payload > 1 MiB is rejected with 413 Payload Too Large
    const oversizedBody = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "ping",
      padding: "X".repeat(1024 * 1024 + 100)
    });
    const resOversized = await request(running.port, "/api/mcp", {
      method: "POST",
      token: running.server.authToken,
      body: oversizedBody
    });
    assert.equal(resOversized.status, 413);
  } finally {
    await running.close();
  }
});

// =============================================================================
// BDD-376: Serverless Stateless Execution in api/mcp.js
// =============================================================================
test("BDD-376: Serverless stateless edge execution in api/mcp.js", async () => {
  // 1. GET requests must return 405 Method Not Allowed (stateless POST only)
  const { req: getReq, res: getRes } = mockServerless("GET");
  await serverlessHandler(getReq, getRes);
  assert.equal(getRes.statusCode, 405);
  assert.equal(getRes.body?.status, "METHOD_NOT_ALLOWED");

  // 2. Accept: text/event-stream without application/json must return 406
  const { req: sseReq, res: sseRes } = mockServerless("POST", {
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream"
    },
    body: { jsonrpc: "2.0", id: 1, method: "ping" }
  });
  await serverlessHandler(sseReq, sseRes);
  assert.equal(sseRes.statusCode, 406);
  assert.equal(sseRes.body?.status, "NOT_ACCEPTABLE");
  assert.match(sseRes.body?.message, /stateless JSON-RPC mode only \(ADR-0172\)/);

  // 3. Valid tool call for eos_slsa_provenance_sbom in mode: verify returns 200 with local scope
  const { req: toolReq, res: toolRes } = mockServerless("POST", {
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: {
      jsonrpc: "2.0",
      id: "slsa-test-1",
      method: "tools/call",
      params: {
        name: "eos_slsa_provenance_sbom",
        arguments: { mode: "verify" }
      }
    }
  });
  await serverlessHandler(toolReq, toolRes);
  assert.equal(toolRes.statusCode, 200);
  assert.equal(toolRes.body.id, "slsa-test-1");
  assert.ok(toolRes.body.result?.content?.[0]?.text);
  const parsedScopeResult = JSON.parse(toolRes.body.result.content[0].text);
  assert.equal(parsedScopeResult.scope, "LOCAL_ONLY");
  assert.equal(parsedScopeResult.tool, "eos_slsa_provenance_sbom");
  assert.equal(parsedScopeResult.result.verification?.valid, true);

  // 4. Safe dynamic Origin reflection in CORS
  const testOrigin = "https://my-dashboard.vercel.app";
  const { req: corsReq, res: corsRes } = mockServerless("OPTIONS", {
    headers: { origin: testOrigin }
  });
  await serverlessHandler(corsReq, corsRes);
  assert.equal(corsRes.statusCode, 204);
  assert.equal(corsRes.headers["access-control-allow-origin"], testOrigin);
  assert.equal(corsRes.headers["access-control-allow-credentials"], "true");
  assert.equal(corsRes.headers.vary, "Origin");

  // 5. Unauthorized Origin is strictly rejected on preflight with 403
  const { req: evilReq, res: evilRes } = mockServerless("OPTIONS", {
    headers: { origin: "https://evil-unauthorized-attacker.com" }
  });
  await serverlessHandler(evilReq, evilRes);
  assert.equal(evilRes.statusCode, 403);
  assert.equal(evilRes.headers["access-control-allow-origin"], undefined);
});
