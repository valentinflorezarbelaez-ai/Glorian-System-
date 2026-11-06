import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Expected top-level fields per endpoint (from OpenAPI spec structure).
// `api/mcp.js` is a JSON-RPC 2.0 endpoint, so its contract field is `jsonrpc`
// (validated via a JSON-RPC `initialize` POST request). All other endpoints
// expose a REST status/contract field on a GET request.
const EXPECTED_FIELDS = {
  "api/health.js":     ["status"],
  "api/graph.js":      ["status"],
  "api/compile.js":    ["status"],
  "api/eval.js":       ["status"],
  "api/fleet.js":      ["status"],
  "api/cicd.js":       ["status"],
  "api/jarvis.js":     ["status"],
  "api/kernel.js":     ["status"],
  "api/memory.js":     ["status"],
  "api/spotify.js":    ["success"],
  "api/mcp.js":        ["jsonrpc"],
  "api/teurgia.js":    ["status"],
};

describe("API Contract Tests — Response Shape Validation", () => {
  for (const [endpoint, requiredFields] of Object.entries(EXPECTED_FIELDS)) {
    it(`${endpoint} returns 200 with required fields: ${requiredFields.join(", ")}`, async () => {
      const modUrl = pathToFileURL(path.join(root, endpoint)).href;
      const mod = await import(modUrl);
      assert.equal(typeof mod.default, "function", `${endpoint} must export a handler function`);

      // `api/mcp.js` speaks JSON-RPC 2.0: it only surfaces the `jsonrpc` field
      // for a real JSON-RPC request body, so send an `initialize` POST.
      const isJsonRpc = endpoint === "api/mcp.js";
      const mockReq = isJsonRpc
        ? { method: "POST", query: {}, body: { jsonrpc: "2.0", id: "contract-1", method: "initialize", params: {} }, headers: {} }
        : { method: "GET", query: {}, body: {}, headers: {} };

      let capturedStatus = 200;
      let capturedBody = null;
      const mockRes = {
        statusCode: 200,
        headers: {},
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; capturedStatus = code; return this; },
        json(payload) { capturedBody = payload; return this; },
        end(chunk) {
          if (typeof chunk === "string" && chunk.trim().startsWith("{")) {
            capturedBody = JSON.parse(chunk);
          }
          return this;
        }
      };

      await mod.default(mockReq, mockRes);
      assert.equal(capturedStatus, 200, `${endpoint} must return HTTP 200`);
      assert.ok(capturedBody && typeof capturedBody === "object", `${endpoint} must return JSON object`);

      for (const field of requiredFields) {
        assert.ok(
          field in capturedBody,
          `${endpoint} response missing required field "${field}". Got: ${Object.keys(capturedBody).join(", ")}`
        );
      }
    });
  }
});
