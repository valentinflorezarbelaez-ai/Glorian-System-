/**
 * GLORIAN SYSTEM — OPENTELEMETRY DISTRIBUTED TRACING TEST SUITE
 * Governed by SPEC-149, LADDER-17, BDD-440..BDD-445
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import {
  EosOtelTraceEngine,
  EosOtelSpan,
  generateTraceId,
  generateSpanId,
  formatW3cTraceparent,
  parseW3cTraceparent
} from "../src/core/eosOtelDistributedTracing.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.join(__dirname, "test_telemetry.db");

function cleanupTestDb() {
  for (const ext of ["", "-wal", "-shm"]) {
    const p = testDbPath + ext;
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {
        // Ignore file lock on Windows
      }
    }
  }
}

test("BDD-440: W3C Traceparent injection and extraction roundtrip", () => {
  const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
  const spanId = "00f067aa0ba902b7";

  // 1. Valid injection
  const formattedSampled = formatW3cTraceparent({ traceId, spanId, traceFlags: 1 });
  assert.equal(formattedSampled, "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");

  const formattedUnsampled = formatW3cTraceparent({ traceId, spanId, traceFlags: 0 });
  assert.equal(formattedUnsampled, "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00");

  // 2. Extraction roundtrip
  const parsed = parseW3cTraceparent(formattedSampled);
  assert.ok(parsed);
  assert.equal(parsed.traceId, traceId);
  assert.equal(parsed.spanId, spanId);
  assert.equal(parsed.traceFlags, 1);

  // 3. Edge-cases & Malformed inputs
  assert.equal(parseW3cTraceparent(null), null);
  assert.equal(parseW3cTraceparent(""), null);
  assert.equal(parseW3cTraceparent("invalid-header"), null);
  assert.equal(parseW3cTraceparent("01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"), null); // version !== 00
  assert.equal(parseW3cTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01"), null); // all-zero traceId
  assert.equal(parseW3cTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01"), null); // all-zero spanId
  assert.equal(parseW3cTraceparent("00-shorttrace-00f067aa0ba902b7-01"), null); // non-32 hex
});

test("BDD-441: Span lifecycle, nanosecond precision, attributes, and events", async () => {
  const engine = new EosOtelTraceEngine({ dbPath: ":memory:" });
  try {
    const span = engine.startSpan("core.computation", {
      kind: "INTERNAL",
      attributes: { "tier": 0, "module": "eosNeuralVector" }
    });

    assert.equal(span.name, "core.computation");
    assert.equal(span.kind, "INTERNAL");
    assert.match(span.context.traceId, /^[0-9a-f]{32}$/);
    assert.match(span.context.spanId, /^[0-9a-f]{16}$/);

    // Mutation & events
    span.setAttribute("cache.hit", true);
    span.addEvent("cache_lookup_done", { entries: 42 });

    // Simulate microsecond duration
    await new Promise((r) => setTimeout(r, 10));

    // End span
    const data = span.end();
    assert.equal(span.isEnded(), true);
    assert.equal(data.status.code, "OK");
    assert.ok(data.durationMs >= 5, `Expected durationMs >= 5, got ${data.durationMs}`);
    assert.equal(data.attributes["tier"], 0);
    assert.equal(data.attributes["cache.hit"], true);
    assert.equal(data.events.length, 1);
    assert.equal(data.events[0].name, "cache_lookup_done");
    assert.equal(data.events[0].attributes?.entries, 42);

    // Exception handling
    const errorSpan = engine.startSpan("failing.operation");
    errorSpan.recordException(new Error("Simulated transient timeout"));
    const errorData = errorSpan.end();
    assert.equal(errorData.status.code, "ERROR");
    assert.equal(errorData.status.message, "Simulated transient timeout");
    assert.ok(errorData.events.some((e) => e.name === "exception"));
  } finally {
    engine.close();
  }
});

test("BDD-442: Durable SQLite WAL trace storage and querying", () => {
  cleanupTestDb();
  const engine = new EosOtelTraceEngine({ dbPath: testDbPath });

  try {
    // 1. Root span
    const rootSpan = engine.startSpan("http.request", { kind: "SERVER" });
    const traceId = rootSpan.context.traceId;

    // 2. Child spans linked by context
    const childSpanA = engine.startSpan("db.query", {
      parentContext: rootSpan.context,
      kind: "CLIENT",
      attributes: { "db.statement": "SELECT * FROM specs" }
    });
    childSpanA.end();

    const childSpanB = engine.startSpan("auth.verify", {
      parentContext: rootSpan.context,
      kind: "INTERNAL"
    });
    childSpanB.end();

    rootSpan.end();

    // 3. Query back by traceId
    const storedSpans = engine.getTrace(traceId);
    assert.equal(storedSpans.length, 3);

    const root = storedSpans.find((s) => s.name === "http.request");
    assert.ok(root);
    assert.equal(root.parentSpanId, undefined);

    const dbQuery = storedSpans.find((s) => s.name === "db.query");
    assert.ok(dbQuery);
    assert.equal(dbQuery.parentSpanId, root.spanId);
    assert.equal(dbQuery.attributes["db.statement"], "SELECT * FROM specs");

    // 4. Query traces list
    const queryResult = engine.queryTraces({ name: "http.request" });
    assert.ok(queryResult.traceCount >= 1);
    assert.ok(queryResult.traces.some((t) => t.traceId === traceId));

    // 5. Engine stats
    const stats = engine.getStats();
    assert.ok(stats.totalSpans >= 3);
    assert.ok(stats.uniqueTraces >= 1);
    assert.equal(stats.isInMemory, false);
  } finally {
    engine.close();
    cleanupTestDb();
  }
});

test("BDD-443: Hierarchical trace waterfall and critical path bottleneck", async () => {
  const engine = new EosOtelTraceEngine({ dbPath: ":memory:" });

  try {
    // Create a trace with known relative latencies
    const root = engine.startSpan("pipeline.master");

    const quickStep = engine.startSpan("quick.lint", { parentContext: root.context });
    await new Promise((r) => setTimeout(r, 5));
    quickStep.end();

    const slowStep = engine.startSpan("heavy.compilation", { parentContext: root.context });
    await new Promise((r) => setTimeout(r, 20));
    slowStep.end();

    root.end();

    // Waterfall evaluation
    const waterfall = engine.computeTraceWaterfall(root.context.traceId);
    assert.ok(waterfall);
    assert.equal(waterfall.traceId, root.context.traceId);
    assert.equal(waterfall.spanCount, 3);
    assert.equal(waterfall.rootSpanName, "pipeline.master");
    assert.ok(waterfall.totalDurationMs >= 20);

    // Bottleneck detection
    assert.equal(waterfall.bottleneckSpanId, slowStep.context.spanId);
    assert.ok(waterfall.bottleneckDurationMs >= 15);

    // Spans waterfall items
    const rootItem = waterfall.spans.find((s) => s.spanId === root.context.spanId);
    assert.ok(rootItem);
    assert.equal(rootItem.depth, 0);
    assert.equal(rootItem.offsetPercent, 0);

    const slowItem = waterfall.spans.find((s) => s.spanId === slowStep.context.spanId);
    assert.ok(slowItem);
    assert.equal(slowItem.depth, 1);
    assert.equal(slowItem.isBottleneck, true);
    assert.ok(slowItem.widthPercent > 0);
  } finally {
    engine.close();
  }
});

test("BDD-444: Automated MCP tool invocation instrumentation", () => {
  const engine = new EosOtelTraceEngine({ dbPath: ":memory:" });

  try {
    // Simulate MCP request wrapper
    const traceparentHeader = "00-11223344556677889900aabbccddeeff-a1b2c3d4e5f60718-01";
    const span = engine.startSpan("mcp.tool.eos_query_knowledge_graph", {
      parentContext: traceparentHeader,
      kind: "SERVER",
      attributes: {
        "mcp.tool_name": "eos_query_knowledge_graph",
        "mcp.request_id": "req-999"
      }
    });

    span.setAttribute("mcp.action", "blast_radius");
    span.addEvent("target_evaluated", { "target": "src/core/eosNeuralVectorCore.ts" });
    span.end();

    const stored = engine.getTrace("11223344556677889900aabbccddeeff");
    assert.equal(stored.length, 1);
    assert.equal(stored[0].parentSpanId, "a1b2c3d4e5f60718");
    assert.equal(stored[0].name, "mcp.tool.eos_query_knowledge_graph");
    assert.equal(stored[0].attributes["mcp.tool_name"], "eos_query_knowledge_graph");
    assert.equal(stored[0].status.code, "OK");
  } finally {
    engine.close();
  }
});

test("BDD-445: Canonical OpenTelemetry OTLP/JSON export", () => {
  const engine = new EosOtelTraceEngine({ dbPath: ":memory:" });

  try {
    const span = engine.startSpan("service.worker", {
      kind: "PRODUCER",
      attributes: {
        "worker.id": "worker-01",
        "worker.concurrency": 8,
        "worker.active": true
      }
    });
    span.addEvent("task_queued", { "queue.name": "high_priority" });
    span.end();

    // Export to OTLP JSON v1.3.0
    const otlp = engine.exportOtlpJson(span.context.traceId);
    assert.ok(otlp);
    assert.ok(Array.isArray(otlp.resourceSpans));
    assert.equal(otlp.resourceSpans.length, 1);

    const res = otlp.resourceSpans[0];
    assert.ok(res.resource.attributes.some((a) => a.key === "service.name" && a.value.stringValue === "glorian-system-control-plane"));

    const scopeSpans = res.scopeSpans[0];
    assert.equal(scopeSpans.scope.name, "glorian.system.core");
    assert.equal(scopeSpans.spans.length, 1);

    const exportedSpan = scopeSpans.spans[0];
    assert.equal(exportedSpan.name, "service.worker");
    assert.equal(exportedSpan.traceId, span.context.traceId);
    assert.equal(exportedSpan.kind, 4); // PRODUCER
    assert.equal(exportedSpan.status.code, 1); // OK
    assert.ok(exportedSpan.attributes.some((a) => a.key === "worker.id" && a.value.stringValue === "worker-01"));
    assert.ok(exportedSpan.attributes.some((a) => a.key === "worker.concurrency" && a.value.intValue === 8));
    assert.ok(exportedSpan.attributes.some((a) => a.key === "worker.active" && a.value.boolValue === true));
  } finally {
    engine.close();
  }
});
