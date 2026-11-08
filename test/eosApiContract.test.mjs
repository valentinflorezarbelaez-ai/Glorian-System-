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

  describe("Suite 2: Consolidated Multi-Module Routing & Deep API Semantics (BDD-284)", () => {
    it("api/kernel.js routes to _bigtech, _specs, _omega, and _finops correctly", async () => {
      const kernelUrl = pathToFileURL(path.join(root, "api/kernel.js")).href;
      const kernelMod = await import(kernelUrl);

      function createMockRes() {
        let status = 200;
        let body = null;
        return {
          statusCode: 200,
          setHeader() {},
          status(c) {
            status = c;
            this.statusCode = c;
            return this;
          },
          json(p) {
            body = p;
            return this;
          },
          end() {
            return this;
          },
          getStatus: () => status,
          getBody: () => body,
        };
      }

      // 1. BigTech module
      const res1 = createMockRes();
      await kernelMod.default({ method: "GET", query: { module: "bigtech" }, headers: {} }, res1);
      assert.equal(res1.getStatus(), 200);
      assert.ok(res1.getBody()?.status);

      // 2. Specs catalog module
      const res2 = createMockRes();
      await kernelMod.default({ method: "GET", query: { module: "specs" }, headers: {} }, res2);
      assert.equal(res2.getStatus(), 200);
      assert.ok(res2.getBody()?.catalogSha256);

      // 3. Omega formal demonstration module
      const res3 = createMockRes();
      await kernelMod.default(
        { method: "GET", query: { module: "omega", statement: "Cosmic Omega Consensus Invariant" }, headers: {} },
        res3,
      );
      assert.equal(res3.getStatus(), 200);
      assert.equal(res3.getBody()?.status, "LOCAL_DEMONSTRATION");

      // 4. FinOps cost-receipt GET
      const res4 = createMockRes();
      await kernelMod.default({ method: "GET", query: { module: "finops" }, headers: {} }, res4);
      assert.equal(res4.getStatus(), 200);
      assert.equal(res4.getBody()?.ok, true);
      assert.ok(Array.isArray(res4.getBody()?.policyCard?.tiers));

      // 5. FinOps cost-receipt POST
      const res5 = createMockRes();
      await kernelMod.default(
        {
          method: "POST",
          url: "/api/finops",
          body: { directive: "Optimize distributed database indexes and audit queries", estimatedTokens: 4000 },
          headers: { "content-type": "application/json" },
        },
        res5,
      );
      assert.equal(res5.getStatus(), 200);
      assert.equal(res5.getBody()?.ok, true);
      assert.equal(res5.getBody()?.estimatedTokens, 4000);
      assert.ok(res5.getBody()?.tier);

      // 6. Unknown VFS path returns 404
      const res6 = createMockRes();
      await kernelMod.default({ method: "GET", query: { path: "/proc/nonexistent" }, headers: {} }, res6);
      assert.equal(res6.getStatus(), 404);

      // 7. Method not allowed returns 405
      const res7 = createMockRes();
      await kernelMod.default({ method: "DELETE", query: {}, headers: {} }, res7);
      assert.equal(res7.getStatus(), 405);
    });

    it("api/compile.js and api/eval.js execute specialized modes", async () => {
      const compileMod = await import(pathToFileURL(path.join(root, "api/compile.js")).href);
      const evalMod = await import(pathToFileURL(path.join(root, "api/eval.js")).href);

      function createMockRes() {
        let status = 200;
        let body = null;
        return {
          statusCode: 200,
          setHeader() {},
          status(c) {
            status = c;
            this.statusCode = c;
            return this;
          },
          json(p) {
            body = p;
            return this;
          },
          end() {
            return this;
          },
          getStatus: () => status,
          getBody: () => body,
        };
      }

      // compile amplify mode
      const res1 = createMockRes();
      await compileMod.default(
        { method: "GET", query: { mode: "amplify", prompt: "Explain BFT consensus" }, headers: {} },
        res1,
      );
      assert.equal(res1.getStatus(), 200);
      assert.ok(res1.getBody()?.status);

      // eval titans mode
      const res2 = createMockRes();
      await evalMod.default({ method: "GET", query: { mode: "titans", titan: "all" }, headers: {} }, res2);
      assert.equal(res2.getStatus(), 200);
      assert.ok(res2.getBody()?.status);
    });
  });
});
