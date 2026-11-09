/**
 * EOS SYSTEM — OPENTELEMETRY DISTRIBUTED TRACING TEST SUITE (SPEC-149, LADDER-17)
 *
 * Verifies the Big Tech Distributed Tracing Doctrine:
 * 1. W3C Trace Context level 1 format, generation, and strict parsing.
 * 2. EosOtelSpan lifecycle (attributes, events, exceptions, immutability after end).
 * 3. EosOtelTraceEngine SQLite WAL storage and queries (trace query, filtering).
 * 4. Trace waterfall calculation with hierarchical depth and bottleneck isolation.
 * 5. Canonical OTLP/JSON schema v1.3.0 export with type-mapped attributes.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateTraceId,
  generateSpanId,
  formatW3cTraceparent,
  parseW3cTraceparent,
  EosOtelSpan,
  EosOtelTraceEngine,
} from "../src/core/eosOtelDistributedTracing.ts";

describe("SPEC-149: Sovereign OpenTelemetry Distributed Tracing", () => {
  describe("1. W3C Trace Context Utilities", () => {
    it("generates valid non-zero 128-bit trace IDs and 64-bit span IDs", () => {
      const traceId = generateTraceId();
      assert.equal(typeof traceId, "string");
      assert.equal(traceId.length, 32);
      assert.match(traceId, /^[0-9a-f]{32}$/);
      assert.notEqual(traceId, "00000000000000000000000000000000");

      const spanId = generateSpanId();
      assert.equal(typeof spanId, "string");
      assert.equal(spanId.length, 16);
      assert.match(spanId, /^[0-9a-f]{16}$/);
      assert.notEqual(spanId, "0000000000000000");
    });

    it("formats and parses valid W3C traceparent headers", () => {
      const context = {
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        traceFlags: 1,
      };

      const header = formatW3cTraceparent(context);
      assert.equal(header, "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");

      const parsed = parseW3cTraceparent(header);
      assert.ok(parsed);
      assert.equal(parsed.traceId, context.traceId);
      assert.equal(parsed.spanId, context.spanId);
      assert.equal(parsed.traceFlags, 1);
    });

    it("rejects malformed W3C traceparent headers", () => {
      assert.equal(parseW3cTraceparent(null), null);
      assert.equal(parseW3cTraceparent(undefined), null);
      assert.equal(parseW3cTraceparent(""), null);
      assert.equal(parseW3cTraceparent("invalid-header"), null);
      assert.equal(parseW3cTraceparent("01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"), null); // version != 00
      assert.equal(parseW3cTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01"), null); // zero traceId
      assert.equal(parseW3cTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01"), null); // zero spanId
      assert.equal(parseW3cTraceparent("00-short-00f067aa0ba902b7-01"), null);
      assert.equal(parseW3cTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-short-01"), null);
      assert.equal(parseW3cTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-ZZ"), null); // invalid hex flags
    });
  });

  describe("2. EosOtelSpan Lifecycle", () => {
    it("handles span creation, mutation, exception recording, and immutability after end", () => {
      let endedData = null;
      const context = {
        traceId: generateTraceId(),
        spanId: generateSpanId(),
        traceFlags: 1,
      };

      const span = new EosOtelSpan({
        name: "test-operation",
        context,
        kind: "CLIENT",
        attributes: { "initial.attr": "value1" },
        onEnd: (data) => {
          endedData = data;
        },
      });

      assert.equal(span.isEnded(), false);
      span.setAttribute("user.id", "usr_123");
      span.setAttributes({ "http.status": 200, "cache.hit": true });
      span.addEvent("cache_lookup", { hit: true });

      // Record exception with Error object
      span.recordException(new Error("Simulated failure"));
      assert.equal(span.toData().status.code, "ERROR");

      // Record exception with string
      span.recordException("String error message");

      // End span
      const finalData = span.end();
      assert.equal(span.isEnded(), true);
      assert.ok(endedData);
      assert.equal(finalData.name, "test-operation");
      assert.equal(finalData.kind, "CLIENT");
      assert.equal(finalData.status.code, "ERROR");
      assert.ok(finalData.events.length >= 3);

      // Mutations after end are no-ops
      span.setAttribute("mutated.after.end", "ignored");
      span.setAttributes({ another: 99 });
      span.addEvent("ignored_event");
      span.setStatus("OK");
      span.recordException("ignored_exception");

      const afterMutateData = span.toData();
      assert.equal(afterMutateData.attributes["mutated.after.end"], undefined);
      assert.equal(afterMutateData.status.code, "ERROR");

      // Calling end again returns cached data
      assert.deepEqual(span.end(), finalData);
    });

    it("defaults status to OK on clean span end", () => {
      const span = new EosOtelSpan({
        name: "clean-span",
        context: { traceId: generateTraceId(), spanId: generateSpanId(), traceFlags: 1 },
      });
      const data = span.end();
      assert.equal(data.status.code, "OK");
    });
  });

  describe("3. EosOtelTraceEngine Core Operations", () => {
    it("supports startSpan across parent context variations and persists into SQLite", () => {
      const engine = new EosOtelTraceEngine({ dbPath: ":memory:" });

      // Root span with no parent
      const rootSpan = engine.startSpan("root-http-request", { kind: "SERVER" });
      const traceId = rootSpan.context.traceId;
      assert.ok(!rootSpan.parentSpanId);

      // Child span with string W3C parent
      const traceparentHeader = formatW3cTraceparent(rootSpan.context);
      const childSpan1 = engine.startSpan("db-query", {
        parentContext: traceparentHeader,
        kind: "CLIENT",
        attributes: { "db.system": "postgresql", "db.statement": "SELECT 1" },
      });
      assert.equal(childSpan1.context.traceId, traceId);
      assert.equal(childSpan1.parentSpanId, rootSpan.context.spanId);

      // Child span with SpanContext object
      const childSpan2 = engine.startSpan("redis-cache", {
        parentContext: rootSpan.context,
        kind: "CLIENT",
        attributes: { "redis.key": "user:1", latency: 5 },
      });
      assert.equal(childSpan2.context.traceId, traceId);
      assert.equal(childSpan2.parentSpanId, rootSpan.context.spanId);

      // Child span with invalid traceparent string (generates new traceId)
      const orphanSpan = engine.startSpan("orphan-op", {
        parentContext: "invalid-traceparent",
      });
      assert.notEqual(orphanSpan.context.traceId, traceId);

      // End all spans
      childSpan1.end();
      childSpan2.end();
      orphanSpan.end();
      rootSpan.end();

      // Retrieve full trace
      const traceSpans = engine.getTrace(traceId);
      assert.equal(traceSpans.length, 3);
      assert.ok(traceSpans.some((s) => s.name === "root-http-request"));
      assert.ok(traceSpans.some((s) => s.name === "db-query"));
      assert.ok(traceSpans.some((s) => s.name === "redis-cache"));

      // Non-existent trace returns empty
      assert.deepEqual(engine.getTrace("non-existent-trace-id"), []);
    });

    it("queries traces with name, status, minDuration, and limit filters", () => {
      const engine = new EosOtelTraceEngine({ dbPath: ":memory:" });

      const span1 = engine.startSpan("auth-service-login", { kind: "SERVER" });
      span1.setStatus("OK");
      span1.end();

      const span2 = engine.startSpan("payment-charge", { kind: "SERVER" });
      span2.setStatus("ERROR", "Card declined");
      span2.end();

      // Filter by name
      const qName = engine.queryTraces({ name: "auth" });
      assert.ok(qName.traceCount >= 1);
      assert.ok(qName.traces.some((t) => t.rootSpanName.includes("auth")));

      // Filter by status
      const qStatus = engine.queryTraces({ statusCode: "ERROR" });
      assert.ok(qStatus.traceCount >= 1);

      // Filter by minDurationMs
      const qDuration = engine.queryTraces({ minDurationMs: 0 });
      assert.ok(qDuration.traceCount >= 2);

      // Filter by limit
      const qLimit = engine.queryTraces({ limit: 1 });
      assert.equal(qLimit.traces.length, 1);
    });

    it("computes hierarchical trace waterfall with bottleneck isolation", () => {
      const engine = new EosOtelTraceEngine({ dbPath: ":memory:" });

      // Non-existent trace waterfall
      assert.equal(engine.computeTraceWaterfall("404-trace"), null);

      // Single-span trace (root is bottleneck)
      const singleSpan = engine.startSpan("single-task");
      singleSpan.end();
      const singleWaterfall = engine.computeTraceWaterfall(singleSpan.context.traceId);
      assert.ok(singleWaterfall);
      assert.equal(singleWaterfall.spanCount, 1);
      assert.equal(singleWaterfall.bottleneckSpanId, singleSpan.context.spanId);

      // Multi-span hierarchical trace
      const root = engine.startSpan("api-gateway", { kind: "SERVER" });
      const child1 = engine.startSpan("fast-check", { parentContext: root.context, kind: "INTERNAL" });
      child1.end();

      const child2 = engine.startSpan("slow-computation", { parentContext: root.context, kind: "INTERNAL" });
      // Simulate duration
      child2.end();
      root.end();

      const waterfall = engine.computeTraceWaterfall(root.context.traceId);
      assert.ok(waterfall);
      assert.equal(waterfall.rootSpanName, "api-gateway");
      assert.equal(waterfall.spanCount, 3);
      assert.ok(waterfall.bottleneckSpanId);
      assert.ok(waterfall.spans.some((s) => s.isBottleneck));
      assert.ok(waterfall.spans.some((s) => s.depth === 0));
      assert.ok(waterfall.spans.some((s) => s.depth === 1));
    });

    it("exports canonical OTLP/JSON schema v1.3.0 across all attribute and status types", () => {
      const engine = new EosOtelTraceEngine({ dbPath: ":memory:" });

      const kinds = ["INTERNAL", "SERVER", "CLIENT", "PRODUCER", "CONSUMER"];
      const statuses = ["UNSET", "OK", "ERROR"];

      for (let i = 0; i < kinds.length; i++) {
        const span = engine.startSpan(`span-kind-${kinds[i]}`, {
          kind: kinds[i],
          attributes: {
            "str.val": "sample",
            "num.val": 42,
            "bool.val": true,
            "arr.val": ["a", "b"],
          },
        });
        span.addEvent("test_event", { "event.key": "value" });
        span.setStatus(statuses[i % statuses.length]);
        span.end();
      }

      // Export all from DB
      const otlpFromDb = engine.exportOtlpJson();
      assert.ok(otlpFromDb.resourceSpans.length > 0);
      assert.ok(otlpFromDb.resourceSpans[0].scopeSpans[0].spans.length >= 5);

      // Export explicit spans array with unknown kind/status fallback
      const customSpans = [
        {
          traceId: generateTraceId(),
          spanId: generateSpanId(),
          name: "custom-fallback",
          kind: "UNKNOWN_KIND",
          startTimeUnixNano: "1000",
          endTimeUnixNano: "2000",
          durationMs: 1.0,
          status: { code: "UNKNOWN_STATUS" },
          attributes: { custom: "val" },
          events: [],
        },
      ];
      const customOtlp = engine.exportOtlpJson(customSpans);
      assert.equal(customOtlp.resourceSpans[0].scopeSpans[0].spans[0].kind, 0);
      assert.equal(customOtlp.resourceSpans[0].scopeSpans[0].spans[0].status.code, 0);
    });

    it("manages singleton instance lifecycle cleanly", () => {
      EosOtelTraceEngine.resetInstance();
      const inst1 = EosOtelTraceEngine.getInstance({ dbPath: ":memory:" });
      const inst2 = EosOtelTraceEngine.getInstance();
      assert.equal(inst1, inst2);
      EosOtelTraceEngine.resetInstance();
    });
  });
});
