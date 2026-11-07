import { test } from "node:test";
import assert from "node:assert/strict";
import { EosTailBasedTraceSampler } from "../src/core/eosTailBasedTraceSampler.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

test("BDD-291: 100% Preservation of Error and Exception Traces (Tail-Based)", () => {
  const sampler = new EosTailBasedTraceSampler({
    nominalSampleRate: 0.0, // Drop all nominal traces
    latencyThresholdMs: 500,
  });

  const traceId = "trace-err-101";

  // Ingest child span 1 (fast, healthy)
  sampler.recordSpan({
    traceId,
    spanId: "span-1",
    name: "GET /api/v1/checkout",
    startTimeMs: 1000,
    durationMs: 15,
    statusCode: 200,
  });

  // Ingest child span 2 (downstream database error HTTP 500)
  sampler.recordSpan({
    traceId,
    spanId: "span-2",
    parentSpanId: "span-1",
    name: "POST /db/charge",
    startTimeMs: 1015,
    durationMs: 40,
    statusCode: 500,
    hasError: true,
  });

  // Evaluate the trace on completion
  const decision = sampler.evaluateTrace(traceId);

  assert.strictEqual(decision.traceId, traceId);
  assert.strictEqual(decision.sampled, true, "Error trace must be 100% sampled");
  assert.strictEqual(decision.reason, "SAMPLE_REASON_ERROR");
  assert.strictEqual(decision.spanCount, 2);
  assert.ok(decision.sha256Receipt.length === 64, "Must generate valid SHA-256 receipt");

  const status = sampler.getStatus();
  assert.strictEqual(status.tracesSampled, 1);
  assert.strictEqual(status.sampledByReason.SAMPLE_REASON_ERROR, 1);
  assert.strictEqual(status.activeTraces, 0, "Buffer must be flushed after decision");
});

test("BDD-292: 100% Preservation of Tail Latency Stragglers and Resilience Events", () => {
  const sampler = new EosTailBasedTraceSampler({
    latencyThresholdMs: 300,
    nominalSampleRate: 0.0,
  });

  // 1. Latency straggler test
  const latencyTraceId = "trace-lag-202";
  sampler.recordSpan({
    traceId: latencyTraceId,
    spanId: "span-lag-root",
    name: "GET /heavy/computation",
    startTimeMs: 2000,
    durationMs: 450, // Exceeds 300ms threshold
    statusCode: 200,
  });

  const latencyDecision = sampler.evaluateTrace(latencyTraceId);
  assert.strictEqual(latencyDecision.sampled, true, "Tail latency straggler must be sampled");
  assert.strictEqual(latencyDecision.reason, "SAMPLE_REASON_HIGH_LATENCY");

  // 2. Resilience intervention event test
  const resilienceTraceId = "trace-res-303";
  sampler.recordSpan({
    traceId: resilienceTraceId,
    spanId: "span-hedge-child",
    name: "GET /downstream/replicated",
    startTimeMs: 3000,
    durationMs: 25,
    isResilienceEvent: true, // Marked as hedged request
  });

  const resilienceDecision = sampler.evaluateTrace(resilienceTraceId);
  assert.strictEqual(resilienceDecision.sampled, true, "Resilience event must be preserved");
  assert.strictEqual(resilienceDecision.reason, "SAMPLE_REASON_RESILIENCE_EVENT");
});

test("BDD-293: Nominal Baseline Sampling and Sub-Linear Memory Footprint with Eviction", () => {
  const sampler = new EosTailBasedTraceSampler({
    latencyThresholdMs: 500,
    nominalSampleRate: 0.0, // 0 nominal sample rate ensures all nominals drop
    retentionWindowMs: 50, // Fast TTL for test
  });

  // Test nominal drop
  const fastTraceId = "trace-fast-001";
  const { decision } = sampler.recordAndEvaluate(
    {
      traceId: fastTraceId,
      spanId: "span-fast",
      name: "GET /healthz",
      startTimeMs: 1000,
      durationMs: 5,
      statusCode: 200,
    },
    true, // isEndSpan
  );

  assert.ok(decision);
  assert.strictEqual(decision.sampled, false, "Nominal fast trace should be dropped");
  assert.strictEqual(decision.reason, "DROPPED_NOMINAL_TRACE");

  // Test TTL Eviction of abandoned/zombie trace
  const abandonedTraceId = "trace-abandoned-999";
  sampler.recordSpan({
    traceId: abandonedTraceId,
    spanId: "span-orphan",
    name: "GET /stalled",
    startTimeMs: 500,
    durationMs: 10,
  });

  assert.strictEqual(sampler.getStatus().activeTraces, 1);

  // Evict stale traces older than 0ms
  const evictedCount = sampler.evictStaleTraces(-1);
  assert.strictEqual(evictedCount, 1);
  assert.strictEqual(sampler.getStatus().activeTraces, 0);
  assert.strictEqual(sampler.getStatus().tracesEvicted, 1);
});

test("BDD-294: EosMcpServer Integration for Trace Sampling Tools", async () => {
  const server = new EosMcpServer(process.cwd());

  // Test eos_trace_span_record with root span completion
  const recordReq = {
    jsonrpc: "2.0",
    id: "req-trace-1",
    method: "tools/call",
    params: {
      name: "eos_trace_span_record",
      arguments: {
        traceId: "mcp-trace-500",
        spanId: "mcp-span-1",
        name: "MCP_CRITICAL_DISPATCH",
        durationMs: 620, // High latency trigger
        statusCode: 200,
        isEndSpan: true,
      },
    },
  };

  const recordRes = await server.handleRequest(recordReq);
  assert.strictEqual(recordRes.error, undefined);
  assert.ok(recordRes.result);
  const content = JSON.parse(recordRes.result.content[0].text);
  assert.strictEqual(content.spanRecorded, true);
  assert.ok(content.decision);
  assert.strictEqual(content.decision.sampled, true);
  assert.strictEqual(content.decision.reason, "SAMPLE_REASON_HIGH_LATENCY");

  // Test eos_trace_sampler_status
  const statusReq = {
    jsonrpc: "2.0",
    id: "req-trace-2",
    method: "tools/call",
    params: {
      name: "eos_trace_sampler_status",
      arguments: {},
    },
  };

  const statusRes = await server.handleRequest(statusReq);
  assert.strictEqual(statusRes.error, undefined);
  const statusContent = JSON.parse(statusRes.result.content[0].text);
  assert.ok(statusContent.totalSpansRecorded >= 1);
  assert.ok(statusContent.sha256Receipt.length === 64);
});
