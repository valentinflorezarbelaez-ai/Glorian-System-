/**
 * Glorian System — OpenTelemetry Collector Gateway Test Suite
 * Governed by SPEC-278 / CHANGE-140
 *
 * Verifies BDD-1443 through BDD-1448.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EosOtlpCollectorGateway } from "../src/core/eosOtlpCollectorGateway.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SAMPLE_OTLP_PATH = path.join(ROOT, "templates/otel/sample-otlp-traces.json");

describe("SPEC-278: OpenTelemetry Distributed Tracing & High-Throughput OTLP Gateway", () => {
  // -------------------------------------------------------------------------
  // BDD-1443: Compliant OTLP Span Ingestion and Validation
  // -------------------------------------------------------------------------
  it("BDD-1443: parses and ingests compliant OTLP JSON trace payload into ring buffer", () => {
    const rawJson = fs.readFileSync(SAMPLE_OTLP_PATH, "utf8");
    const gateway = new EosOtlpCollectorGateway();

    const res = gateway.ingestSpans(rawJson, { sampleRate: 1.0 });

    assert.equal(res.status, "PASS");
    assert.equal(res.totalIngested, 3);
    assert.equal(res.retainedCount, 3);
    assert.equal(res.errors.length, 0);

    const spans = gateway.getSpans();
    assert.equal(spans.length, 3);
    assert.equal(spans[0].traceId, "4bf92f3577b34da6a3ce929d0e0e4736");
    assert.equal(spans[0].durationMs, 25);
  });

  // -------------------------------------------------------------------------
  // BDD-1444: 100% Tail-Based Sampling Retention for Error Spans
  // -------------------------------------------------------------------------
  it("BDD-1444: unconditionally retains 100% of error spans even with sampleRate set to 0", () => {
    const gateway = new EosOtlpCollectorGateway({ sampleRate: 0.0, latencyThresholdMs: 10000 });
    const rawJson = fs.readFileSync(SAMPLE_OTLP_PATH, "utf8");

    gateway.ingestSpans(rawJson, { sampleRate: 0.0, latencyThresholdMs: 10000 });
    const decisions = gateway.getSamplingDecisions();

    const errorDecision = decisions.find((d) => d.span.status.code === 2);
    assert.ok(errorDecision, "Error span decision should exist");
    assert.equal(errorDecision.retained, true);
    assert.equal(errorDecision.reason, "ERROR_STATUS");

    const retainedSpans = gateway.getSpans();
    assert.equal(retainedSpans.length, 1);
    assert.equal(retainedSpans[0].name, "POST /api/v1/payment/checkout");
  });

  // -------------------------------------------------------------------------
  // BDD-1445: 100% Tail-Based Retention for High Latency Outliers
  // -------------------------------------------------------------------------
  it("BDD-1445: unconditionally retains latency outliers exceeding threshold even with sampleRate set to 0", () => {
    const gateway = new EosOtlpCollectorGateway({ sampleRate: 0.0, latencyThresholdMs: 250 });
    const rawJson = fs.readFileSync(SAMPLE_OTLP_PATH, "utf8");

    gateway.ingestSpans(rawJson, { sampleRate: 0.0, latencyThresholdMs: 250 });
    const decisions = gateway.getSamplingDecisions();

    const outlierDecision = decisions.find((d) => d.span.name === "GET /api/v1/analytics/aggregations");
    assert.ok(outlierDecision, "Outlier decision should exist");
    assert.equal(outlierDecision.retained, true);
    assert.equal(outlierDecision.reason, "LATENCY_OUTLIER");
    assert.equal(outlierDecision.span.durationMs, 480);
  });

  // -------------------------------------------------------------------------
  // BDD-1446: Uniform Down-Sampling for Nominal Happy-Path Spans
  // -------------------------------------------------------------------------
  it("BDD-1446: uniformly down-samples nominal happy-path spans and records drops", () => {
    const nominalSpans = [];
    for (let i = 0; i < 100; i++) {
      nominalSpans.push({
        traceId: `trace-batch-${i.toString().padStart(4, "0")}`,
        spanId: `span-${i.toString().padStart(4, "0")}`,
        name: `GET /api/v1/resource/${i}`,
        durationMs: 10 + (i % 20),
        status: { code: 1 },
      });
    }

    const gateway = new EosOtlpCollectorGateway();
    const decisions = gateway.evaluateSampling(nominalSpans, 0.1, 500);

    const retained = decisions.filter((d) => d.retained);
    const dropped = decisions.filter((d) => !d.retained);

    assert.ok(retained.length >= 3 && retained.length <= 25, `Retained count was ${retained.length}`);
    assert.ok(dropped.length >= 75 && dropped.length <= 97, `Dropped count was ${dropped.length}`);
    assert.equal(retained.length + dropped.length, 100);

    for (const d of dropped) {
      assert.equal(d.reason, "DROPPED_NOMINAL");
    }
  });

  // -------------------------------------------------------------------------
  // BDD-1447: P50/P90/P99 Percentile Latency Calculation
  // -------------------------------------------------------------------------
  it("BDD-1447: calculates non-negative, ordered latency percentiles across span batch", () => {
    const spans = [
      { traceId: "t1", spanId: "s1", name: "s1", durationMs: 10, status: { code: 1 } },
      { traceId: "t2", spanId: "s2", name: "s2", durationMs: 20, status: { code: 1 } },
      { traceId: "t3", spanId: "s3", name: "s3", durationMs: 30, status: { code: 1 } },
      { traceId: "t4", spanId: "s4", name: "s4", durationMs: 50, status: { code: 1 } },
      { traceId: "t5", spanId: "s5", name: "s5", durationMs: 100, status: { code: 1 } },
      { traceId: "t6", spanId: "s6", name: "s6", durationMs: 250, status: { code: 1 } },
      { traceId: "t7", spanId: "s7", name: "s7", durationMs: 500, status: { code: 1 } },
    ];

    const gateway = new EosOtlpCollectorGateway();
    gateway.ingestSpans(spans, { sampleRate: 1.0 });
    const metrics = gateway.computeMetrics();

    assert.equal(metrics.totalIngested, 7);
    assert.ok(metrics.p50Ms > 0);
    assert.ok(metrics.p90Ms >= metrics.p50Ms);
    assert.ok(metrics.p95Ms >= metrics.p90Ms);
    assert.ok(metrics.p99Ms >= metrics.p95Ms);
    assert.equal(metrics.minDurationMs, 10);
    assert.equal(metrics.maxDurationMs, 500);
  });

  // -------------------------------------------------------------------------
  // BDD-1448: Cryptographic SHA-256 Observability Receipt Generation
  // -------------------------------------------------------------------------
  it("BDD-1448: generates cryptographic receipt sealed with valid SHA-256 signature", () => {
    const testReceiptPath = path.join(ROOT, "docs/evidence/OTEL_RECEIPT.json");
    const gateway = new EosOtlpCollectorGateway({ evidencePath: testReceiptPath });
    const rawJson = fs.readFileSync(SAMPLE_OTLP_PATH, "utf8");

    gateway.ingestSpans(rawJson);
    const receipt = gateway.generateReceipt();

    assert.ok(fs.existsSync(testReceiptPath));
    assert.equal(typeof receipt.sha256, "string");
    assert.equal(receipt.sha256.length, 64);
    assert.equal(receipt.metrics.totalIngested, 3);

    const onDisk = JSON.parse(fs.readFileSync(testReceiptPath, "utf8"));
    assert.equal(onDisk.evidenceSha256, receipt.sha256);
  });
});
