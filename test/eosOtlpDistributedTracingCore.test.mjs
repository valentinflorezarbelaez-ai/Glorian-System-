/**
 * SPEC-226 / CHANGE-111: Layer-0 High-Throughput OTLP Distributed Tracing & W3C Context Propagation Engine
 * Test Suite verifying BDD-1149 through BDD-1153.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosOtlpDistributedTracingCore, ActiveSpan } from "../src/core/eosOtlpDistributedTracingCore.ts";

test("BDD-1149: W3C TraceContext Header Generation and Parsing", () => {
  const traceId = EosOtlpDistributedTracingCore.generateTraceId();
  const spanId = EosOtlpDistributedTracingCore.generateSpanId();

  assert.equal(traceId.length, 32);
  assert.equal(spanId.length, 16);
  assert.match(traceId, /^[0-9a-f]{32}$/);
  assert.match(spanId, /^[0-9a-f]{16}$/);

  // Format valid traceparent
  const formatted = EosOtlpDistributedTracingCore.formatTraceparent({
    traceId,
    spanId,
    traceFlags: "01",
  });
  assert.equal(formatted, `00-${traceId}-${spanId}-01`);

  // Parse valid traceparent
  const parsed = EosOtlpDistributedTracingCore.parseTraceparent(formatted);
  assert.ok(parsed !== null);
  assert.equal(parsed?.traceId, traceId);
  assert.equal(parsed?.spanId, spanId);
  assert.equal(parsed?.traceFlags, "01");

  // Fail-closed rejection of malformed headers
  assert.equal(EosOtlpDistributedTracingCore.parseTraceparent(""), null);
  assert.equal(EosOtlpDistributedTracingCore.parseTraceparent(null), null);
  assert.equal(EosOtlpDistributedTracingCore.parseTraceparent("invalid-header"), null);
  assert.equal(
    EosOtlpDistributedTracingCore.parseTraceparent("01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"),
    null,
    "Non-00 version should be rejected",
  );
  assert.equal(
    EosOtlpDistributedTracingCore.parseTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01"),
    null,
    "All-zero traceId must be rejected",
  );
  assert.equal(
    EosOtlpDistributedTracingCore.parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01"),
    null,
    "All-zero spanId must be rejected",
  );
});

test("BDD-1150: Hierarchical Active Span Creation and Attribute Binding", () => {
  const tracer = new EosOtlpDistributedTracingCore();

  const parentSpan = tracer.startSpan("http.server.request", {
    kind: "SERVER",
    attributes: {
      "http.method": "GET",
      "http.route": "/api/metrics",
      "http.status_code": 200,
      "http.secure": true,
    },
  });

  assert.equal(parentSpan.name, "http.server.request");
  assert.ok(parentSpan instanceof ActiveSpan);
  assert.ok(parentSpan.traceId.length === 32);
  assert.ok(parentSpan.spanId.length === 16);
  assert.equal(parentSpan.parentSpanId, undefined);

  // Child span bound to parent context
  const childSpan = tracer.startSpan("database.query", {
    parent: {
      traceId: parentSpan.traceId,
      spanId: parentSpan.spanId,
      traceFlags: "01",
    },
    kind: "CLIENT",
    attributes: {
      "db.system": "sqlite",
      "db.statement": "SELECT * FROM ledger WHERE seq > 1000",
      "db.rows_affected": 42,
    },
  });

  assert.equal(childSpan.traceId, parentSpan.traceId);
  assert.equal(childSpan.parentSpanId, parentSpan.spanId);
  assert.notEqual(childSpan.spanId, parentSpan.spanId);

  // Add event
  childSpan.addEvent("db.cache.hit", { "cache.latency_us": 12.5 });

  // Verify ActiveSpan contract invariants
  assert.throws(() => {
    parentSpan.setAttribute("", "invalid");
  }, /PRECONDITION_FAILED/);
});

test("BDD-1151: Span Timing and Status Transitions", () => {
  const tracer = new EosOtlpDistributedTracingCore();
  const span = tracer.startSpan("auth.validate_token", { kind: "INTERNAL" });

  span.setAttribute("token.type", "bearer");
  span.setStatus("ERROR", "Token has expired");

  const completed = span.end();
  assert.equal(span.isEnded, true);
  assert.equal(completed.status.code, "ERROR");
  assert.equal(completed.status.description, "Token has expired");
  assert.equal(completed.attributes["token.type"], "bearer");

  // Monotonic time invariant
  const startNano = BigInt(completed.startTimeUnixNano);
  const endNano = BigInt(completed.endTimeUnixNano);
  assert.ok(endNano >= startNano, "End time must be >= start time");

  // Cannot modify or end span after ended
  assert.throws(() => {
    span.setAttribute("another", "val");
  }, /PRECONDITION_FAILED/);
  assert.throws(() => {
    span.end();
  }, /PRECONDITION_FAILED/);
});

test("BDD-1152: Canonical OTLP JSON Wire Serialization", () => {
  const tracer = new EosOtlpDistributedTracingCore({
    serviceName: "custom-glorian-node",
    serviceVersion: "1.0.0",
  });

  const span1 = tracer.startSpan("operation-1", { kind: "INTERNAL" });
  span1.setStatus("OK");
  tracer.recordSpan(span1);

  const span2 = tracer.startSpan("operation-2", { kind: "PRODUCER" });
  span2.setAttribute("queue.name", "telemetry-queue");
  span2.setAttribute("batch.size", 256);
  span2.setStatus("OK");
  tracer.recordSpan(span2);

  const report = tracer.exportToOtlpJson();

  assert.equal(report.spansExported, 2);
  assert.equal(report.overflowCount, 0);
  assert.ok(report.receipt.length === 64);
  assert.ok(typeof report.serializedJson === "string");

  const payload = report.payload;
  assert.ok(Array.isArray(payload.resourceSpans));
  assert.equal(payload.resourceSpans.length, 1);

  const res = payload.resourceSpans[0];
  const serviceAttr = res.resource.attributes.find((a) => a.key === "service.name");
  assert.equal(serviceAttr?.value.stringValue, "custom-glorian-node");

  const scopeSpans = res.scopeSpans[0];
  assert.equal(scopeSpans.scope.name, "eos.core.tracer");
  assert.equal(scopeSpans.spans.length, 2);

  const wireSpan2 = scopeSpans.spans.find((s) => s.name === "operation-2");
  assert.ok(wireSpan2);
  assert.equal(wireSpan2.kind, 4); // PRODUCER = 4
  const queueAttr = wireSpan2.attributes.find((a) => a.key === "queue.name");
  assert.equal(queueAttr?.value.stringValue, "telemetry-queue");
  const batchAttr = wireSpan2.attributes.find((a) => a.key === "batch.size");
  assert.equal(batchAttr?.value.intValue, "256");
});

test("BDD-1153: Bounded Buffer Overflow Handling and SHA-256 Receipt", () => {
  const tracer = new EosOtlpDistributedTracingCore({
    maxCapacity: 5,
  });

  for (let i = 0; i < 8; i++) {
    const s = tracer.startSpan(`span-${i}`);
    s.setStatus("OK");
    tracer.recordSpan(s);
  }

  const stats = tracer.stats;
  assert.equal(stats.bufferedSpans, 5);
  assert.equal(stats.maxCapacity, 5);
  assert.equal(stats.overflowCount, 3);

  const report = tracer.exportToOtlpJson();
  assert.equal(report.spansExported, 5);
  assert.equal(report.overflowCount, 3);
  assert.ok(report.receipt.length === 64);

  tracer.clear();
  assert.equal(tracer.stats.bufferedSpans, 0);
  assert.equal(tracer.stats.overflowCount, 0);
});
