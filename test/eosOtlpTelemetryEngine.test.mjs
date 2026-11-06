import test from "node:test";
import assert from "node:assert/strict";
import { EosOtlpTelemetryEngine, OtlpStatusCode } from "../src/core/eosOtlpTelemetryEngine.ts";

test("BDD-273: Propagación y formato estricto de W3C TraceContext en spans OTLP (SPEC-099)", () => {
  const engine = new EosOtlpTelemetryEngine({ serviceName: "eos-test", serviceVersion: "75.0.0" });

  // 1. Root span creation
  const rootSpan = engine.startSpan("root-operation", {
    attributes: { "http.method": "GET", "http.status_code": 200 }
  });

  assert.equal(rootSpan.traceId.length, 32, "TraceId must be 32 hexadecimal characters");
  assert.equal(rootSpan.spanId.length, 16, "SpanId must be 16 hexadecimal characters");
  assert.equal(rootSpan.parentSpanId, undefined);

  // 2. Format and parse W3C traceparent header
  const traceparent = engine.formatW3cTraceparent(rootSpan.traceId, rootSpan.spanId, true);
  assert.match(traceparent, /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);

  const parsed = engine.parseW3cTraceparent(traceparent);
  assert.ok(parsed);
  assert.equal(parsed.traceId, rootSpan.traceId);
  assert.equal(parsed.spanId, rootSpan.spanId);
  assert.equal(parsed.sampled, true);

  // 3. Child span creation with context propagation
  const childSpan = engine.startSpan("child-operation", {
    parentTraceId: rootSpan.traceId,
    parentSpanId: rootSpan.spanId,
    attributes: { "db.system": "spanner", "db.statement": "SELECT 1" }
  });

  assert.equal(childSpan.traceId, rootSpan.traceId, "Child must inherit parent's traceId");
  assert.equal(childSpan.parentSpanId, rootSpan.spanId, "Child must reference parent's spanId");
  assert.notEqual(childSpan.spanId, rootSpan.spanId, "Child must have distinct spanId");

  engine.endSpan(childSpan.spanId, OtlpStatusCode.STATUS_CODE_OK);
  engine.endSpan(rootSpan.spanId, OtlpStatusCode.STATUS_CODE_OK);
});

test("BDD-274: Serialización conforme al protocolo OpenTelemetry OTLP v1 HTTP/JSON (SPEC-099)", () => {
  const engine = new EosOtlpTelemetryEngine({ maxBufferedSpans: 5 });

  // Create spans with various attribute types
  const span = engine.startSpan("verify-pipeline", {
    attributes: {
      "pipeline.stage": "Stage 4",
      "test.suites": 113,
      "test.passed": true,
      "latency.ms": 14.85
    }
  });

  const endedSpan = engine.endSpan(span.spanId, OtlpStatusCode.STATUS_CODE_OK);
  assert.ok(endedSpan);
  assert.ok(endedSpan.endTimeUnixNano);

  // Export OTLP payload
  const batch = engine.exportOtlpJsonBatch(false);
  assert.ok(Array.isArray(batch.resourceSpans));
  assert.equal(batch.resourceSpans.length, 1);

  const rs = batch.resourceSpans[0];
  const serviceNameAttr = rs.resource.attributes.find((a) => a.key === "service.name");
  assert.ok(serviceNameAttr);
  assert.equal(serviceNameAttr.value.stringValue, "eos-system");

  const scopeSpans = rs.scopeSpans[0];
  assert.equal(scopeSpans.scope.name, "eos-system-tracer");
  assert.equal(scopeSpans.spans.length, 1);

  const exportedSpan = scopeSpans.spans[0];
  assert.equal(exportedSpan.name, "verify-pipeline");
  assert.equal(exportedSpan.status.code, OtlpStatusCode.STATUS_CODE_OK);

  // Verify attribute type mappings
  const strAttr = exportedSpan.attributes.find((a) => a.key === "pipeline.stage");
  assert.equal(strAttr?.value.stringValue, "Stage 4");

  const intAttr = exportedSpan.attributes.find((a) => a.key === "test.suites");
  assert.equal(intAttr?.value.intValue, "113");

  const boolAttr = exportedSpan.attributes.find((a) => a.key === "test.passed");
  assert.equal(boolAttr?.value.boolValue, true);

  const doubleAttr = exportedSpan.attributes.find((a) => a.key === "latency.ms");
  assert.equal(doubleAttr?.value.doubleValue, 14.85);

  // Buffer clearing check
  const clearedBatch = engine.exportOtlpJsonBatch(true);
  assert.equal(clearedBatch.resourceSpans[0].scopeSpans[0].spans.length, 1);
  assert.equal(engine.getCompletedSpanCount(), 0);
});
