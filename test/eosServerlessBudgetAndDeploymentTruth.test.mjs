/**
 * GLORIAN SYSTEM — SPEC-269 SERVERLESS FUNCTION BUDGET & DEPLOYMENT TRUTH SUITE
 *
 * Verifies BDD-1391 through BDD-1395:
 * - BDD-1391: Active serverless functions stay within Hobby budget (≤12) with headroom
 * - BDD-1392: Fail-closed rejection when active functions exceed budget
 * - BDD-1393: Routed Prometheus metrics endpoint preserves content type and RED telemetry
 * - BDD-1394: Package.json engines bounds Node below major version 25
 * - BDD-1395: Ship remote status evaluation preserves epistemic honesty
 *
 * Zero external runtime dependencies (EOS Law V).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listActiveServerlessFunctions,
  evaluateVercelFunctionBudget,
} from "../scripts/verify-vercel-function-budget.mjs";
import kernelHandler from "../api/kernel.js";
import metricsHandler from "../api/_metrics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

describe("SPEC-269 — Serverless Function Budget Gate & Deployment Truth Engine (BDD-1391..BDD-1395)", () => {
  it("BDD-1391: Active serverless functions stay within Hobby budget with headroom", () => {
    const active = listActiveServerlessFunctions(root);
    assert.ok(active.length <= 12, `Must stay ≤12 active serverless functions, got ${active.length}`);
    assert.ok(active.length >= 1, "Must expose at least one public api entrypoint");
    // Teurgia + Spotify under kernel; + scorecard bridge → 11 public entrypoints (headroom ≥ 1).
    assert.equal(active.length, 11, "Expected 11 after scorecard bridge (+ teurgia/spotify under kernel)");
    assert.ok(active.includes("api/scorecard.js"), "scorecard bridge must be a public serverless entrypoint");
    assert.ok(!active.includes("api/teurgia.js"), "teurgia must not be a public serverless entrypoint");
    assert.ok(!active.includes("api/spotify.js"), "spotify must not be a public serverless entrypoint");

    // All active entrypoints must be non-private (no segment starting with _)
    for (const file of active) {
      assert.equal(file.startsWith("api/"), true);
      const segments = file.replace(/^api\//, "").split("/");
      assert.equal(
        segments.some((s) => s.startsWith("_")),
        false,
      );
    }

    const evaluation = evaluateVercelFunctionBudget(root);
    assert.equal(evaluation.specId, "SPEC-269");
    assert.equal(evaluation.passed, true);
    assert.equal(evaluation.verdict, "PASS");
    assert.equal(evaluation.activeCount, 11);
    assert.equal(evaluation.budget, 12);
    assert.equal(evaluation.hardLimit, 12);
    assert.equal(evaluation.headroom, 1);
  });

  it("BDD-1392: Fail-closed rejection when active functions exceed budget", () => {
    // Simulate exceeding Hobby hard limit (12) via override — pad to exactly 13 public entrypoints.
    const current = listActiveServerlessFunctions(root);
    const padCount = Math.max(0, 13 - current.length);
    const excessFunctions = [...current, ...Array.from({ length: padCount }, (_, i) => `api/temp_fictional_${i}.js`)];

    const evaluation = evaluateVercelFunctionBudget(root, {
      activeFunctionsOverride: excessFunctions,
    });

    assert.equal(evaluation.passed, false);
    assert.equal(evaluation.verdict, "FAIL_BUDGET_EXCEEDED");
    assert.equal(evaluation.activeCount, 13);
    assert.equal(evaluation.headroom, -1);
  });

  it("BDD-1393: Routed Prometheus metrics endpoint preserves content type and RED telemetry", async () => {
    const headers = {};
    let statusCode = 0;
    let responseBody = "";

    const req = {
      method: "GET",
      headers: {},
      url: "/api/metrics",
      query: { module: "metrics" },
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

    await kernelHandler(req, res);

    assert.equal(statusCode, 200);
    assert.ok(headers["content-type"].includes("text/plain"));
    assert.ok(headers["content-type"].includes("version=0.0.4"));
    assert.ok(responseBody.includes("# HELP glorian_requests_total"));
    assert.ok(responseBody.includes("# TYPE glorian_requests_total counter"));
    assert.ok(responseBody.includes("glorian_process_memory_bytes"));
  });

  it("BDD-1394: Package.json engines bounds Node below major version 25", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.ok(pkg.engines?.node, "engines.node must be declared");
    assert.equal(pkg.engines.node, ">=22.18.0 <25");

    // Vercel project configuration rewrite must exist
    const vercelJson = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
    const metricsRewrite = vercelJson.rewrites?.find((r) => r.source === "/api/metrics");
    assert.ok(metricsRewrite, "vercel.json must declare rewrite for /api/metrics");
    assert.equal(metricsRewrite.destination, "/api/kernel?module=metrics");
  });

  it("BDD-1395: _metrics.js directly maintains 405 Method Not Allowed guards", async () => {
    let statusCode = 0;
    let jsonPayload = null;

    const req = {
      method: "DELETE",
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

    await metricsHandler(req, res);

    assert.equal(statusCode, 405);
    assert.equal(jsonPayload?.error, "Method Not Allowed");
  });
});
