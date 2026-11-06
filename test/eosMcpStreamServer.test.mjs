import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosMcpStreamServer } from "../src/mcp/eosMcpStreamServer.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

async function startServer(options = {}) {
  const server = new EosMcpStreamServer(projectRoot, 0, options);
  const listener = await server.listen(0, "127.0.0.1");
  const port = listener.address().port;
  return { server, port, close: () => server.close() };
}

function request(port, pathname, { method = "GET", token, origin, body, headers = {} } = {}) {
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

async function connectSse(port, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}/sse`, {
      method: "GET",
      headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` }
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`SSE connection failed with HTTP ${res.statusCode}`));
        return;
      }
      let buffer = "";
      const messages = [];
      res.on("data", (chunk) => {
        const text = chunk.toString();
        messages.push(text);
        buffer += text;
        const match = buffer.match(/event: endpoint\ndata: \/message\?sessionId=([a-f0-9-]+)/);
        if (match) resolve({ req, sessionId: match[1], messages });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

test("local MCP HTTP transport requires bearer auth and reports the package version", async () => {
  const running = await startServer();
  try {
    const unauthorized = await request(running.port, "/health");
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers["www-authenticate"], "Bearer");
    assert.equal(JSON.stringify(unauthorized.body).includes(running.server.authToken), false);

    const health = await request(running.port, "/health", { token: running.server.authToken });
    assert.equal(health.status, 200);
    assert.equal(health.body.server, "eos-system-mcp-stream");
    assert.equal(health.body.version, JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(new URL("../package.json", import.meta.url), "utf8"))).version);
    assert.equal(health.body.protocolVersion, "2024-11-05");
    assert.deepEqual(health.body.transports, ["stdio", "sse"]);
  } finally {
    await running.close();
  }
});

test("CORS accepts only configured exact origins and preflight does not grant access", async () => {
  const allowedOrigin = "https://ide.example.test";
  const running = await startServer({ allowedOrigins: [allowedOrigin] });
  try {
    const preflight = await request(running.port, "/sse", { method: "OPTIONS", origin: allowedOrigin });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], allowedOrigin);
    assert.equal(preflight.headers.vary, "Origin");

    const denied = await request(running.port, "/health", { token: running.server.authToken, origin: "https://attacker.example" });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers["access-control-allow-origin"], undefined);

    const noOriginPreflight = await request(running.port, "/health", { method: "OPTIONS" });
    assert.equal(noOriginPreflight.status, 403);

    const allowed = await request(running.port, "/health", { token: running.server.authToken, origin: allowedOrigin });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers["access-control-allow-origin"], allowedOrigin);
  } finally {
    await running.close();
  }
});

test("SSE sessions are authenticated, bounded, and cleaned up when clients disconnect", async () => {
  const running = await startServer({ maxSessions: 1 });
  try {
    const noToken = await request(running.port, "/sse");
    assert.equal(noToken.status, 401);

    const first = await connectSse(running.port, running.server.authToken);
    assert.match(first.sessionId, /^[a-f0-9-]{36}$/);
    assert.equal(running.server.sessionManager.getActiveSessions().length, 1);
    const capacity = await request(running.port, "/sse", { token: running.server.authToken });
    assert.equal(capacity.status, 503);

    first.req.destroy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(running.server.sessionManager.getActiveSessions().length, 0);
  } finally {
    await running.close();
  }
});

test("HTTP MCP lists and dispatches only the bounded read-only tool surface", async () => {
  const running = await startServer();
  try {
    const sse = await connectSse(running.port, running.server.authToken);
    const call = (payload) => request(running.port, `/message?sessionId=${sse.sessionId}`, {
      method: "POST",
      token: running.server.authToken,
      body: JSON.stringify(payload)
    });

    const list = await call({ jsonrpc: "2.0", id: "list", method: "tools/list", params: {} });
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.result.tools.map((tool) => tool.name).sort(), [
      "eos_amplify_prompt",
      "eos_check_architecture",
      "eos_evaluate_decision",
      "eos_health_check",
      "eos_optimize_context",
      "eos_spotify_shuffle"
    ].sort());
    const optimizeSchema = list.body.result.tools.find((tool) => tool.name === "eos_optimize_context").inputSchema;
    assert.deepEqual(optimizeSchema.required, ["content"]);
    assert.equal(Object.hasOwn(optimizeSchema.properties, "filePath"), false);
    const architectureSchema = list.body.result.tools.find((tool) => tool.name === "eos_check_architecture").inputSchema;
    assert.deepEqual(architectureSchema.properties.targetDir.enum, ["src"]);

    const health = await call({ jsonrpc: "2.0", id: "health", method: "tools/call", params: { name: "eos_health_check", arguments: {} } });
    assert.equal(health.status, 200);
    assert.equal(health.body.id, "health");
    {
      const healthPayload = JSON.parse(health.body.result.content[0].text);
      assert.ok(["HEALTHY", "DEGRADED", "CRITICAL"].includes(healthPayload.status));
      assert.equal(healthPayload.subsystemProbes, "RUN");
      assert.equal(healthPayload.epistemicState, "CONTROL_PLANE_HEALTH_WITHIN_TESTED_SCOPE");
      assert.ok(healthPayload.probesTotal >= 6);
      assert.ok(healthPayload.probesPassing >= 1);
    }

    const mutation = await call({ jsonrpc: "2.0", id: "mutate", method: "tools/call", params: { name: "eos_autonomous_heal", arguments: { apply: true } } });
    assert.equal(mutation.body.error.code, -32601);
    const arbitraryRead = await call({ jsonrpc: "2.0", id: "topology", method: "tools/call", params: { name: "eos_query_topology", arguments: {} } });
    assert.equal(arbitraryRead.body.error.code, -32601);
    const fileRead = await call({ jsonrpc: "2.0", id: "file", method: "tools/call", params: { name: "eos_optimize_context", arguments: { filePath: "README.md" } } });
    assert.equal(fileRead.body.error.code, -32602);

    sse.req.destroy();
  } finally {
    await running.close();
  }
});

test("HTTP MCP enforces request size, content type, session presence, and generic parse errors", async () => {
  const running = await startServer({ maxRequestBytes: 128 });
  try {
    const missingSession = await request(running.port, "/message?sessionId=missing", {
      method: "POST", token: running.server.authToken, body: "{}"
    });
    assert.equal(missingSession.status, 404);

    const sse = await connectSse(running.port, running.server.authToken);
    const wrongType = await request(running.port, `/message?sessionId=${sse.sessionId}`, {
      method: "POST", token: running.server.authToken, headers: { "Content-Type": "text/plain" }, body: "{}"
    });
    assert.equal(wrongType.status, 415);

    const malformed = await request(running.port, `/message?sessionId=${sse.sessionId}`, {
      method: "POST", token: running.server.authToken, body: "{ malformed json ... "
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error.code, -32700);
    assert.doesNotMatch(JSON.stringify(malformed.body), /SyntaxError|stack|at .*\.mjs/);

    const tooLarge = await request(running.port, `/message?sessionId=${sse.sessionId}`, {
      method: "POST", token: running.server.authToken, body: "x".repeat(129)
    });
    assert.equal(tooLarge.status, 413);

    sse.req.destroy();
  } finally {
    await running.close();
  }
});

test("invalid tokens and wildcard CORS origins are rejected at construction", () => {
  assert.throws(() => new EosMcpStreamServer(projectRoot, 0, { authToken: "short" }), /at least 32 bytes/);
  assert.throws(() => new EosMcpStreamServer(projectRoot, 0, { allowedOrigins: ["*"] }), /Invalid EOS MCP allowed origin/);
});
