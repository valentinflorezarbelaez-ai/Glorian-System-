/**
 * Test Suite: /api/metrics endpoint
 * Verifies OpenMetrics / Prometheus text exposition format over HTTP handler.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/metrics.js";

describe("API: /api/metrics", () => {
  it("serves Prometheus text exposition format with correct headers", async () => {
    const headers = {};
    let statusCode = 0;
    let responseBody = "";

    const req = {
      method: "GET",
      headers: {},
      url: "/api/metrics",
    };

    const res = {
      setHeader(name, val) {
        headers[name.toLowerCase()] = val;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      send(body) {
        responseBody = body;
        return this;
      },
      end(body) {
        if (body) responseBody = body;
        return this;
      },
    };

    await handler(req, res);

    assert.equal(statusCode, 200);
    assert.ok(headers["content-type"].includes("text/plain"));
    assert.ok(headers["content-type"].includes("version=0.0.4"));
    assert.ok(headers["cache-control"].includes("no-cache"));
    assert.ok(responseBody.includes("# HELP glorian_requests_total"));
    assert.ok(responseBody.includes("# TYPE glorian_requests_total counter"));
    assert.ok(responseBody.includes("glorian_process_memory_bytes"));
  });

  it("rejects non-GET/HEAD methods with 405", async () => {
    let statusCode = 0;
    let jsonPayload = null;

    const req = {
      method: "POST",
      headers: {},
      url: "/api/metrics",
    };

    const res = {
      setHeader() {},
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        jsonPayload = payload;
        return this;
      },
      end() {},
    };

    await handler(req, res);

    assert.equal(statusCode, 405);
    assert.equal(jsonPayload?.error, "Method Not Allowed");
  });
});
