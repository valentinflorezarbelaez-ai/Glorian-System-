/**
 * Glorian System — Bayesian Dynamic Canary Evaluator Test Suite
 * Governed by SPEC-280 / CHANGE-142
 *
 * Verifies BDD-1455 through BDD-1460.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";

import { EosBayesianCanaryEvaluator } from "../src/core/eosBayesianCanaryEvaluator.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SAMPLE_CANARY_PATH = path.join(ROOT, "templates/canary/sample-canary-telemetry.json");

describe("SPEC-280: Bayesian Dynamic Canary Evaluation & Automated Rollback Gateway", () => {
  // -------------------------------------------------------------------------
  // BDD-1455: Conforming Baseline and Canary Telemetry Ingestion
  // -------------------------------------------------------------------------
  it("BDD-1455: parses and ingests valid paired baseline and canary telemetry datasets", () => {
    const rawJson = fs.readFileSync(SAMPLE_CANARY_PATH, "utf8");
    const report = EosBayesianCanaryEvaluator.evaluateCanary(rawJson);

    assert.equal(report.status, "COMPLETED");
    assert.equal(report.serviceName, "glorian-core-api");
    assert.ok(report.baselineMetrics.sampleCount > 0);
    assert.ok(report.canaryMetrics.sampleCount > 0);
    assert.equal(typeof report.compositeScore, "number");
    assert.equal(typeof report.sha256Receipt, "string");
  });

  // -------------------------------------------------------------------------
  // BDD-1456: Statistical Distribution Analysis & Percentile Shift Calculation
  // -------------------------------------------------------------------------
  it("BDD-1456: calculates monotonic percentiles and relative P99 shift", () => {
    const baseline = {
      requestCount: 100,
      errorCount: 1,
      latencySamplesMs: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    };
    const canary = {
      requestCount: 100,
      errorCount: 1,
      latencySamplesMs: [10, 20, 30, 40, 50, 60, 70, 80, 90, 105],
    };

    const bMetrics = EosBayesianCanaryEvaluator.computeDistributionMetrics(baseline);
    const cMetrics = EosBayesianCanaryEvaluator.computeDistributionMetrics(canary);

    assert.ok(bMetrics.p50Ms <= bMetrics.p90Ms);
    assert.ok(bMetrics.p90Ms <= bMetrics.p99Ms);
    assert.equal(bMetrics.p99Ms, 100);
    assert.equal(cMetrics.p99Ms, 105);

    const report = EosBayesianCanaryEvaluator.evaluateCanary({
      serviceName: "latency-test",
      baseline,
      canary,
    });

    assert.equal(report.deltaP99, 0.05); // (105 - 100) / 100 = 0.05 (5%)
  });

  // -------------------------------------------------------------------------
  // BDD-1457: PASS Verdict on Equivalent or Superior Canary Health
  // -------------------------------------------------------------------------
  it("BDD-1457: emits PASS and compositeScore >= 85 when canary matches or improves health", () => {
    const rawJson = fs.readFileSync(SAMPLE_CANARY_PATH, "utf8");
    const report = EosBayesianCanaryEvaluator.evaluateCanary(rawJson);

    assert.equal(report.verdict, "PASS");
    assert.ok(report.compositeScore >= 85);
    assert.equal(report.rollbackRequired, false);
    assert.equal(report.failureReasons.length, 0);
  });

  // -------------------------------------------------------------------------
  // BDD-1458: Automated ROLLBACK_TRIGGERED on Significant Error Rate Regression
  // -------------------------------------------------------------------------
  it("BDD-1458: triggers automated rollback when canary error rate increases by > 1.0%", () => {
    const dataset = {
      serviceName: "error-regression-service",
      baselineRevision: "git-commit-stable",
      canaryRevision: "git-commit-bad-canary",
      thresholds: { maxErrorRateDelta: 0.01 },
      baseline: {
        requestCount: 1000,
        errorCount: 5, // 0.5% error rate
        latencySamplesMs: [30, 35, 40],
      },
      canary: {
        requestCount: 1000,
        errorCount: 30, // 3.0% error rate -> delta = +2.5% > 1.0%
        latencySamplesMs: [30, 35, 40],
      },
    };

    const report = EosBayesianCanaryEvaluator.evaluateCanary(dataset);

    assert.equal(report.verdict, "ROLLBACK_TRIGGERED");
    assert.equal(report.rollbackRequired, true);
    assert.ok(report.failureReasons.includes("ERROR_RATE_REGRESSION"));
    assert.ok(report.rollbackManifest);
    assert.equal(report.rollbackManifest.targetRevision, "git-commit-stable");
  });

  // -------------------------------------------------------------------------
  // BDD-1459: Automated ROLLBACK_TRIGGERED on Severe P99 Latency Regression
  // -------------------------------------------------------------------------
  it("BDD-1459: triggers automated rollback when canary P99 latency degrades by > 20%", () => {
    const dataset = {
      serviceName: "latency-regression-service",
      baselineRevision: "stable-rev",
      canaryRevision: "regressed-rev",
      thresholds: { maxP99LatencyShift: 0.2 },
      baseline: {
        requestCount: 100,
        errorCount: 0,
        latencySamplesMs: [20, 30, 50, 100], // P99 = 100
      },
      canary: {
        requestCount: 100,
        errorCount: 0,
        latencySamplesMs: [20, 30, 50, 135], // P99 = 135 -> +35% > 20%
      },
    };

    const report = EosBayesianCanaryEvaluator.evaluateCanary(dataset);

    assert.equal(report.verdict, "ROLLBACK_TRIGGERED");
    assert.equal(report.rollbackRequired, true);
    assert.ok(report.failureReasons.includes("P99_LATENCY_REGRESSION"));
    assert.ok(report.rollbackManifest);
    assert.equal(report.rollbackManifest.action, "INSTANT_TRAFFIC_DRAIN_AND_REVERT");
  });

  // -------------------------------------------------------------------------
  // BDD-1460: Rollback Manifest Synthesis & Cryptographic SHA-256 Receipt
  // -------------------------------------------------------------------------
  it("BDD-1460: generates valid SHA-256 sealed receipt and rollback manifest on disk", () => {
    const testReceiptPath = resolveEvidencePath("CANARY_RECEIPT.json", ROOT);
    const dataset = {
      serviceName: "receipt-test-service",
      baselineRevision: "rev-1",
      canaryRevision: "rev-2",
      baseline: {
        requestCount: 100,
        errorCount: 1,
        latencySamplesMs: [20, 50, 100],
      },
      canary: {
        requestCount: 100,
        errorCount: 20, // Forces rollback
        latencySamplesMs: [20, 50, 250],
      },
    };

    const report = EosBayesianCanaryEvaluator.evaluateCanary(dataset, testReceiptPath);

    assert.ok(fs.existsSync(testReceiptPath));
    assert.equal(typeof report.sha256Receipt, "string");
    assert.equal(report.sha256Receipt.length, 64);
    assert.ok(report.rollbackManifest);

    const onDisk = JSON.parse(fs.readFileSync(testReceiptPath, "utf8"));
    assert.equal(onDisk.evidenceSha256, report.sha256Receipt);
  });

  // -------------------------------------------------------------------------
  // BDD-1460B: MARGINAL verdicts, edge distributions, custom dirs & error handling
  // -------------------------------------------------------------------------
  it("BDD-1460B: handles empty/zero groups, MARGINAL & critical composite verdicts, and error paths", () => {
    // Empty latency samples with requestCount > 0 and requestCount === 0, plus non-array samples
    const emptyWithReq = EosBayesianCanaryEvaluator.computeDistributionMetrics({
      requestCount: 50,
      errorCount: 2,
      latencySamplesMs: [],
    });
    assert.equal(emptyWithReq.sampleCount, 0);
    assert.equal(emptyWithReq.p99Ms, 0);
    assert.equal(emptyWithReq.errorRate, 0.04);

    const emptyNoReq = EosBayesianCanaryEvaluator.computeDistributionMetrics({
      requestCount: 0,
      errorCount: 0,
      latencySamplesMs: null,
    });
    assert.equal(emptyNoReq.errorRate, 0);

    const zeroReqWithSamples = EosBayesianCanaryEvaluator.computeDistributionMetrics({
      requestCount: 0,
      errorCount: 1,
      latencySamplesMs: [10, 20, 30],
    });
    assert.equal(zeroReqWithSamples.errorRate, 0);

    // MARGINAL verdict: deltaP99 = 0.18 <= 0.20 => score = 82 (between 70 and 85)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-canary-edge-"));
    try {
      const marginalPath = path.join(tmpDir, "marginal", "CANARY_RECEIPT.json");
      const marginalReport = EosBayesianCanaryEvaluator.evaluateCanary({
        serviceName: "marginal-svc",
        baseline: { requestCount: 100, errorCount: 1, latencySamplesMs: [10, 50, 100] },
        canary: { requestCount: 100, errorCount: 1, latencySamplesMs: [10, 50, 118] },
        evidencePath: marginalPath,
      });
      assert.equal(marginalReport.verdict, "MARGINAL");
      assert.equal(marginalReport.rollbackRequired, false);
      assert.ok(fs.existsSync(marginalPath));

      // Improved canary (negative deltas -> score stays 100)
      const improvedReport = EosBayesianCanaryEvaluator.evaluateCanary(
        {
          serviceName: "improved-svc",
          baseline: { requestCount: 100, errorCount: 5, latencySamplesMs: [50, 100] },
          canary: { requestCount: 100, errorCount: 1, latencySamplesMs: [20, 60] },
        },
        path.join(tmpDir, "improved", "CANARY_RECEIPT.json"),
      );
      assert.equal(improvedReport.verdict, "PASS");
      assert.equal(improvedReport.compositeScore, 100);

      // Composite score critical without exceeding individual maxErrorRateDelta or maxP99LatencyShift
      // deltaErrorRate = 0.01 (-20) and deltaP99 = 0.15 (-15) => score = 65 < 70, revisions omitted -> defaults
      const criticalReport = EosBayesianCanaryEvaluator.evaluateCanary(
        {
          serviceName: "critical-composite-svc",
          baseline: { requestCount: 1000, errorCount: 0, latencySamplesMs: [50, 100] },
          canary: { requestCount: 1000, errorCount: 10, latencySamplesMs: [50, 115] },
        },
        path.join(tmpDir, "critical", "CANARY_RECEIPT.json"),
      );
      assert.equal(criticalReport.verdict, "ROLLBACK_TRIGGERED");
      assert.deepEqual(criticalReport.failureReasons, ["COMPOSITE_SCORE_CRITICAL"]);
      assert.equal(criticalReport.rollbackManifest?.targetRevision, "previous-stable");
      assert.equal(criticalReport.rollbackManifest?.failedRevision, "current-canary");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // Ingestion error paths: malformed JSON, missing groups, and non-Error throw
    const badJsonReport = EosBayesianCanaryEvaluator.evaluateCanary("{bad-json");
    assert.equal(badJsonReport.status, "ERROR");
    assert.equal(badJsonReport.verdict, "ROLLBACK_TRIGGERED");
    assert.deepEqual(badJsonReport.failureReasons, ["INGESTION_ERROR"]);

    const missingGroupReport = EosBayesianCanaryEvaluator.evaluateCanary({
      serviceName: "broken",
      baseline: { requestCount: 1, errorCount: 0, latencySamplesMs: [1] },
    });
    assert.equal(missingGroupReport.status, "ERROR");
    assert.match(missingGroupReport.errors[0], /Invalid canary dataset/);

    const nonErrorThrowReport = EosBayesianCanaryEvaluator.evaluateCanary({
      serviceName: "throw-str",
      get baseline() {
        throw "non-error-throw";
      },
    });
    assert.equal(nonErrorThrowReport.status, "ERROR");
    assert.deepEqual(nonErrorThrowReport.errors, ["non-error-throw"]);
  });
});
