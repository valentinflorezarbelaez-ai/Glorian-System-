import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function mockRes() {
  const state = { statusCode: 200, headers: {}, body: null };
  return {
    state,
    setHeader(k, v) {
      state.headers[k] = v;
    },
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(payload) {
      state.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

test("POST /api/jarvis without Idempotency-Key fails closed", async () => {
  const handler = (await import("../api/jarvis.js")).default;
  const res = mockRes();
  handler({ method: "POST", headers: {}, body: { directive: "audita la flota" } }, res);
  assert.equal(res.state.statusCode, 400);
  assert.equal(res.state.body.status, "IDEMPOTENCY_KEY_REQUIRED");
});

test("POST /api/jarvis with Idempotency-Key classifies intent", async () => {
  const handler = (await import("../api/jarvis.js")).default;
  const res = mockRes();
  handler(
    {
      method: "POST",
      url: "/api/jarvis",
      headers: { "idempotency-key": "test-key-jarvis-001" },
      body: { directive: "audita la flota" },
    },
    res,
  );
  assert.equal(res.state.statusCode, 200);
  assert.equal(res.state.body.status, "INTENT_CLASSIFIED");
  assert.equal(res.state.headers["X-Idempotency"], "STORED");
});

test("requireIdempotencyKeyForPost is exported from shield", async () => {
  const shield = await import("../api/_shield.js");
  assert.equal(typeof shield.requireIdempotencyKeyForPost, "function");
  assert.equal(typeof shield.extractIdempotencyKey, "function");
  // silence unused require helper in environments that tree-shake
  assert.ok(require);
});
