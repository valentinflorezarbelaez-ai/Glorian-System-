import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Per-endpoint HTTP contract, mirroring openspec/openapi.yaml. POST-only
// endpoints (jarvis, mcp) must be exercised with their real method and media
// type; a GET probe there would only prove the 405 guard works.
const ENDPOINT_CONTRACTS = {
  "api/health.js": { method: "GET", fields: ["status"] },
  "api/graph.js": { method: "GET", fields: ["status"] },
  "api/compile.js": { method: "GET", fields: ["status"] },
  "api/eval.js": { method: "GET", fields: ["status"] },
  "api/fleet.js": { method: "GET", fields: ["status"] },
  "api/cicd.js": { method: "GET", fields: ["status"] },
  "api/jarvis.js": {
    method: "POST",
    fields: ["status", "intent", "execution"],
    body: { directive: "estado general del sistema" },
    headers: { "content-type": "application/json" },
  },
  "api/kernel.js": { method: "GET", fields: ["status"] },
  "api/memory.js": { method: "GET", fields: ["status"] },
  "api/spotify.js": { method: "GET", fields: ["status"] },
  "api/mcp.js": {
    method: "POST",
    fields: ["jsonrpc"],
    body: { jsonrpc: "2.0", id: "contract-1", method: "initialize", params: {} },
    headers: { "content-type": "application/json", accept: "application/json" },
  },
  "api/teurgia.js": { method: "GET", fields: ["status"] },
};

describe("API Contract Tests — Response Shape Validation", () => {
  for (const [endpoint, contract] of Object.entries(ENDPOINT_CONTRACTS)) {
    it(`${endpoint} returns 200 with required fields: ${contract.fields.join(", ")}`, async () => {
      const modUrl = pathToFileURL(path.join(root, endpoint)).href;
      const mod = await import(modUrl);
      assert.equal(typeof mod.default, "function", `${endpoint} must export a handler function`);

      const mockReq = {
        method: contract.method,
        query: {},
        body: contract.body ?? {},
        headers: contract.headers ?? {},
      };

      let capturedStatus = 200;
      let capturedBody = null;
      const mockRes = {
        statusCode: 200,
        headers: {},
        setHeader(k, v) {
          this.headers[k] = v;
        },
        status(code) {
          this.statusCode = code;
          capturedStatus = code;
          return this;
        },
        json(payload) {
          capturedBody = payload;
          return this;
        },
        end(chunk) {
          if (typeof chunk === "string" && chunk.trim().startsWith("{")) {
            capturedBody = JSON.parse(chunk);
          }
          return this;
        },
      };

      await mod.default(mockReq, mockRes);
      assert.equal(capturedStatus, 200, `${endpoint} must return HTTP 200`);
      assert.ok(capturedBody && typeof capturedBody === "object", `${endpoint} must return JSON object`);

      for (const field of contract.fields) {
        assert.ok(
          field in capturedBody,
          `${endpoint} response missing required field "${field}". Got: ${Object.keys(capturedBody).join(", ")}`,
        );
      }
    });
  }
});
