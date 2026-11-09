/**
 * WHATWG query helper — DEP0169 hygiene for serverless handlers.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { getQueryObject, getQueryParam, getSearchParams } from "../api/_safeQuery.js";

test("BDD-SAFE-QUERY-001: parses probe from req.url without touching req.query", () => {
  const req = { url: "/api/fleet?probe=1&x=y" };
  assert.equal(getQueryParam(req, "probe"), "1");
  assert.equal(getQueryParam(req, "missing"), null);
  assert.deepEqual(getQueryObject(req), { probe: "1", x: "y" });
  assert.equal(getSearchParams(req).get("x"), "y");
});

test("BDD-SAFE-QUERY-002: malformed url yields empty params (fail-closed soft)", () => {
  const req = { url: "" };
  assert.equal(getQueryParam(req, "probe"), null);
  assert.deepEqual(getQueryObject(req), {});
});

test("BDD-SAFE-QUERY-003: plain injected query object works; getters are ignored", () => {
  const plain = { method: "GET", query: { action: "summary" } };
  assert.equal(getQueryParam(plain, "action"), "summary");

  const withGetter = { url: "/api/x" };
  Object.defineProperty(withGetter, "query", {
    configurable: true,
    get() {
      throw new Error("must-not-touch-lazy-query");
    },
  });
  assert.equal(getQueryParam(withGetter, "action"), null);
  assert.deepEqual(getQueryObject(withGetter), {});
});
