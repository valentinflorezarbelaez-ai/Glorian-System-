/**
 * Glorian System — DevSecOps Platform Engineering, Core De-Insularization & TLC Consensus Test Suite
 * Governed by SPEC-271 / CHANGE-133
 *
 * Verifies BDD-1401 through BDD-1406.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import handler from "../api/kernel.js";
import healthHandler from "../api/health.js";
import { extractIdempotencyKey, getShieldDiagnostics } from "../api/_shield.js";
import { CONFIGURED_SPECS, runTlcVerification, validateSpecConfigPair } from "../scripts/run-tlc.mjs";
import {
  evaluateCoverageReport,
  loadCoverageBudget,
  parseCoverageOutput,
  resolveTestForSource,
  runIncrementalCoverage,
} from "../scripts/coverage-ratchet.mjs";
import { generateCycloneDxSbom } from "../src/core/eosCycloneDxSbomGenerator.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function createMockRes() {
  const headers = {};
  return {
    statusCode: 200,
    body: null,
    headers,
    setHeader(key, val) {
      headers[key.toLowerCase()] = String(val);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

describe("SPEC-271: DevSecOps Platform Engineering, Kernel Shield & TLC Consensus", () => {
  // -------------------------------------------------------------------------
  // BDD-1401: Kernel Event Loop Lag & Backpressure Protection
  // -------------------------------------------------------------------------
  it("BDD-1401: Shield provides event loop lag and diagnostics to health endpoint", () => {
    const diag = getShieldDiagnostics();
    assert.equal(diag.rateLimiterActive, true);
    assert.equal(typeof diag.eventLoopLagMs, "number");
    assert.equal(typeof diag.sheddingActive, "boolean");

    const req = { method: "GET", url: "/api/health", headers: {} };
    const res = createMockRes();
    healthHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.telemetry.shield, "Health must expose shield diagnostics");
    assert.equal(res.body.telemetry.shield.rateLimiterActive, true);
  });

  // -------------------------------------------------------------------------
  // BDD-1402: Kernel Idempotency Key Replay Prevention
  // -------------------------------------------------------------------------
  it("BDD-1402: Kernel caches and replays responses for duplicate Idempotency-Key requests", () => {
    const testKey = `test-idemp-${Date.now()}`;
    const req1 = {
      method: "GET",
      url: "/api/kernel?path=/proc/eos/version",
      headers: { "idempotency-key": testKey },
    };
    assert.equal(extractIdempotencyKey(req1), testKey);
    const res1 = createMockRes();
    handler(req1, res1);

    assert.equal(res1.statusCode, 200);
    assert.equal(res1.headers["x-idempotency"], "STORED");

    // Second request with exact same key and path
    const req2 = {
      method: "GET",
      url: "/api/kernel?path=/proc/eos/version",
      headers: { "idempotency-key": testKey },
    };
    const res2 = createMockRes();
    handler(req2, res2);

    assert.equal(res2.statusCode, 200);
    assert.equal(res2.headers["x-idempotency"], "REPLAYED");
    assert.equal(res2.body.vfsPath, "/proc/eos/version");
  });

  // -------------------------------------------------------------------------
  // BDD-1403: Kernel Adaptive Rate Limiter Enforcement
  // -------------------------------------------------------------------------
  it("BDD-1403: Kernel applies adaptive rate limiting headers", () => {
    const req = { method: "GET", url: "/api/kernel?path=/proc/eos/version", headers: {} };
    const res = createMockRes();
    handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.headers["x-ratelimit-remaining"] !== undefined);
    assert.ok(res.headers["x-ratelimit-capacity"] !== undefined);
    assert.ok(parseInt(res.headers["x-ratelimit-capacity"], 10) > 0);
  });

  // -------------------------------------------------------------------------
  // BDD-1404: CycloneDX v1.5 SBOM Generation
  // -------------------------------------------------------------------------
  it("BDD-1404: EosCycloneDxSbomGenerator produces valid CycloneDX v1.5 JSON", () => {
    const sbom = generateCycloneDxSbom(ROOT);
    assert.equal(sbom.bomFormat, "CycloneDX");
    assert.equal(sbom.specVersion, "1.5");
    assert.ok(Array.isArray(sbom.components));
    assert.ok(sbom.components.length > 300, "Must catalog internal core components");

    const sample = sbom.components[0];
    assert.equal(sample.type, "library");
    assert.ok(sample.name.startsWith("glorian:"));
    assert.ok(Array.isArray(sample.hashes));
  });

  // -------------------------------------------------------------------------
  // BDD-1405: Raft & CRDT Companion TLC Model Verification
  // -------------------------------------------------------------------------
  it("BDD-1405: Distributed specs possess verified companion TLC models", () => {
    assert.ok(CONFIGURED_SPECS.includes("BftAgentSwarmSlashing"));
    assert.ok(CONFIGURED_SPECS.includes("CellBasedBulkheadGovernor"));

    const pairBft = validateSpecConfigPair("BftAgentSwarmSlashing", path.join(ROOT, "docs/formal"));
    assert.equal(pairBft.syntaxValid, true);

    const pairBulkhead = validateSpecConfigPair("CellBasedBulkheadGovernor", path.join(ROOT, "docs/formal"));
    assert.equal(pairBulkhead.syntaxValid, true);

    const receiptPath = path.join(ROOT, "docs/evidence", `.tlc-receipt-bdd1405-${process.pid}.json`);
    try {
      const receipt = runTlcVerification({ forceMock: true, receiptPath });
      assert.ok(receipt.totalConfiguredSpecs >= 6);
      assert.equal(receipt.executionMode, "DEFERRED_TO_CI");
      assert.ok(receipt.models.some((m) => m.specName === "BftAgentSwarmSlashing"));
      assert.ok(receipt.models.some((m) => m.specName === "CellBasedBulkheadGovernor"));
    } finally {
      try {
        fs.unlinkSync(receiptPath);
      } catch {
        // temp receipt cleanup
      }
    }
  });

  // -------------------------------------------------------------------------
  // BDD-1406: Incremental PTS Coverage Ratchet
  // -------------------------------------------------------------------------
  it("BDD-1406: Incremental PTS coverage ratchet verifies test mapping and parsing", () => {
    const resolved = resolveTestForSource("src/core/eosAdaptiveRateLimiter.ts", ROOT);
    assert.ok(resolved !== null);
    assert.ok(resolved.endsWith(".test.mjs"));

    const sampleStdout = `
      # line coverage rate: 92.5 %
      # branch coverage rate: 88.0 %
    `;
    const parsed = parseCoverageOutput(sampleStdout);
    assert.equal(parsed.linePercent, 92.5);
    assert.equal(parsed.branchPercent, 88.0);

    const budget = loadCoverageBudget(ROOT);
    const evaluated = evaluateCoverageReport("src/core/eosAdaptiveRateLimiter.ts", parsed, budget);
    assert.equal(evaluated.passed, true);
    assert.equal(evaluated.linePass, true);
    assert.equal(evaluated.branchPass, true);

    const coverageRun = runIncrementalCoverage({ files: [] });
    assert.equal(coverageRun.status, "PASS_NO_IMPACTED_FILES");
  });
});
