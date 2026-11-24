/**
 * Glorian System — OpenTelemetry Collector Gateway Test Suite
 * Governed by SPEC-278 / CHANGE-140
 *
 * Verifies BDD-1443 through BDD-1448.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";

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
    const testReceiptPath = resolveEvidencePath("OTEL_RECEIPT.json", ROOT);
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

  // -------------------------------------------------------------------------
  // BDD-1449: Flat spans payloads, attribute variants, filtering, buffer eviction & errors
  // -------------------------------------------------------------------------
  it("BDD-1449: handles {spans}, malformed inputs, error attributes, ring buffer eviction, and filters", () => {
    const gateway = new EosOtlpCollectorGateway({ maxBufferSize: 2, sampleRate: 1.0, latencyThresholdMs: 100 });

    // Empty gateway metrics
    const emptyMetrics = gateway.computeMetrics();
    assert.equal(emptyMetrics.totalIngested, 0);
    assert.equal(emptyMetrics.retentionRatio, 0);

    // Unrecognized & empty payloads
    assert.deepEqual(gateway.parsePayload({ unknown: true }), []);
    assert.deepEqual(gateway.parsePayload(null), []);
    const emptyIngest = gateway.ingestSpans([]);
    assert.equal(emptyIngest.status, "PASS");
    assert.equal(emptyIngest.totalIngested, 0);

    // Malformed JSON and non-Error throw capture
    const badJsonRes = gateway.ingestSpans("{invalid-json");
    assert.equal(badJsonRes.status, "ERROR");
    assert.equal(badJsonRes.errors.length, 1);

    const nonErrorThrowRes = gateway.ingestSpans({
      get resourceSpans() {
        throw "string-payload-failure";
      },
    });
    assert.equal(nonErrorThrowRes.status, "ERROR");
    assert.deepEqual(nonErrorThrowRes.errors, ["string-payload-failure"]);

    // resourceSpans with missing nested fields and diverse attribute types
    const edgeResourceSpans = gateway.parsePayload({
      resourceSpans: [
        {
          resource: {
            attributes: [
              null,
              { key: "score", value: { doubleValue: 0.98 } },
              { key: "rawVal", value: { bytesValue: "AQID" } },
            ],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: "t-edge-1",
                  spanId: "s-edge-1",
                  parentSpanId: "p-001",
                  startTimeUnixNano: "1000",
                  endTimeUnixNano: "1000",
                },
              ],
            },
            { spans: "not-an-array" },
          ],
        },
        { scopeSpans: "not-an-array" },
      ],
    });
    assert.equal(edgeResourceSpans.length, 1);
    assert.equal(edgeResourceSpans[0].parentSpanId, "p-001");
    assert.equal(edgeResourceSpans[0].name, "unnamed_span");
    assert.equal(edgeResourceSpans[0].attributes.score, 0.98);
    assert.deepEqual(edgeResourceSpans[0].attributes.rawVal, { bytesValue: "AQID" });

    // { spans: [...] } wrapper with valid + invalid spans, plain object attributes, and error attributes
    const flatRes = gateway.ingestSpans({
      spans: [
        null,
        { traceId: 123, spanId: "bad" },
        {
          traceId: "t-1",
          spanId: "s-1",
          name: "nominal-ok",
          durationMs: 12,
          attributes: { "http.status_code": 200 },
          status: { code: 1 },
        },
        {
          traceId: "t-2",
          spanId: "s-2",
          name: "http-502-error",
          durationMs: 20,
          attributes: { "http.status_code": 502 },
          status: { code: "not-a-num" },
        },
        {
          traceId: "t-3",
          spanId: "s-3",
          name: "attr-error-flag",
          durationMs: 150,
          attributes: { error: true },
          status: { code: 1 },
        },
      ],
    });
    assert.equal(flatRes.status, "PASS");
    assert.equal(flatRes.totalIngested, 3);
    assert.equal(flatRes.retainedCount, 3);

    // Ring buffer maxBufferSize=2 evicted oldest (s-1), keeping s-2 and s-3
    const retained = gateway.getSpans();
    assert.equal(retained.length, 2);
    assert.equal(retained[0].spanId, "s-2");
    assert.equal(retained[1].spanId, "s-3");

    // Filters: errorsOnly + limit
    assert.equal(gateway.getSpans({ errorsOnly: true }).length, 2);
    assert.equal(gateway.getSpans({ limit: 1 }).length, 1);
    assert.equal(gateway.getSpans({ limit: 1 })[0].spanId, "s-3");
    assert.equal(gateway.getSpans({ limit: 0 }).length, 2);

    // Direct evaluateSampling with default parameters and explicit spans in computeMetrics after clear
    const directDecisions = gateway.evaluateSampling([
      ...edgeResourceSpans,
      {
        traceId: "t-err",
        spanId: "s-err",
        name: "err",
        durationMs: 5,
        attributes: { error: true },
        status: { code: 1 },
      },
      {
        traceId: "t-500",
        spanId: "s-500",
        name: "500",
        durationMs: 5,
        attributes: { "http.status_code": 500 },
        status: { code: 1 },
      },
    ]);
    assert.equal(directDecisions.length, 3);

    gateway.clear();
    assert.equal(gateway.getSpans().length, 0);
    assert.equal(gateway.getSamplingDecisions().length, 0);

    const directMetrics = gateway.computeMetrics([
      {
        traceId: "m-1",
        spanId: "ms-1",
        name: "m1",
        durationMs: 10,
        attributes: { "http.status_code": 503 },
        status: { code: 1 },
      },
      { traceId: "m-2", spanId: "ms-2", name: "m2", durationMs: 300, attributes: { error: true }, status: { code: 1 } },
    ]);
    assert.equal(directMetrics.totalIngested, 2);
    assert.equal(directMetrics.totalRetained, 2);
    assert.equal(directMetrics.errorCount, 2);
    assert.equal(directMetrics.latencyOutlierCount, 1);

    // generateReceipt creating non-existent nested temp directory
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-otlp-rcpt-"));
    try {
      const nestedReceipt = path.join(tmpDir, "nested", "OTEL_RECEIPT.json");
      const r = gateway.generateReceipt(nestedReceipt);
      assert.ok(fs.existsSync(r.receiptPath));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
