import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosApolloHermesMesh, EosCircuitBreaker, EosTokenBucketRateLimiter } from "../src/core/eosApolloHermesMesh.ts";

describe("EOS Sovereign Spotify Apollo / Hermes RPC & Event Mesh Suite (SPEC-015, BDD-046)", () => {
  describe("Suite 1: FNV-1a 32-bit Deterministic Partition Hashing", () => {
    it("computes deterministic positive 32-bit unsigned integers", () => {
      const hash1 = EosApolloHermesMesh.fnv1a32("spotify:track:4cOdK2wGLETKBW3PvgPWqT");
      const hash2 = EosApolloHermesMesh.fnv1a32("spotify:track:4cOdK2wGLETKBW3PvgPWqT");
      const hash3 = EosApolloHermesMesh.fnv1a32("spotify:track:other");

      assert.equal(typeof hash1, "number");
      assert.equal(hash1, hash2);
      assert.notEqual(hash1, hash3);
      assert.ok(hash1 >= 0 && hash1 <= 0xffffffff);
    });

    it("distributes keys across partitions evenly", () => {
      const mesh = new EosApolloHermesMesh();
      const partitions = new Set();
      for (let i = 0; i < 50; i++) {
        partitions.add(mesh.computePartition(`stream-key-${i}`, 16));
      }
      assert.ok(partitions.size > 8, `Expected good partition spread, got ${partitions.size}`);
    });
  });

  describe("Suite 2: W3C Distributed Tracing Header Propagation", () => {
    it("generates valid W3C traceparent (00-{traceId}-{spanId}-01)", () => {
      const mesh = new EosApolloHermesMesh();
      const trace = mesh.generateTraceContext();

      assert.equal(trace.version, "00");
      assert.equal(trace.traceId.length, 32);
      assert.equal(trace.spanId.length, 16);
      assert.equal(trace.traceFlags, "01");
      assert.match(trace.headerString, /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    });

    it("propagates parent traceId when creating child span", () => {
      const mesh = new EosApolloHermesMesh();
      const parent = mesh.generateTraceContext();
      const child = mesh.generateTraceContext(parent);

      assert.equal(child.traceId, parent.traceId);
      assert.notEqual(child.spanId, parent.spanId);
      assert.equal(child.parentId, parent.spanId);
    });

    it("parses inbound traceparent header string cleanly", () => {
      const mesh = new EosApolloHermesMesh();
      const rawHeader = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
      const parsed = mesh.parseTraceparent(rawHeader);

      assert.ok(parsed !== null);
      assert.equal(parsed.traceId, "4bf92f3577b34da6a3ce929d0e0e4736");
      assert.equal(parsed.spanId, "00f067aa0ba902b7");
    });
  });

  describe("Suite 3: 3-State Circuit Breaker Resilience", () => {
    it("transitions from CLOSED to OPEN upon reaching failure threshold", () => {
      const cb = new EosCircuitBreaker({
        slidingWindowSize: 4,
        failureThresholdPercentage: 50,
        resetTimeoutMs: 100,
      });

      assert.equal(cb.getState(), "CLOSED");
      assert.equal(cb.canExecute(), true);

      // Record 2 failures out of 4 (50%)
      cb.recordSuccess();
      cb.recordSuccess();
      cb.recordFailure();
      cb.recordFailure();

      assert.equal(cb.getState(), "OPEN");
      assert.equal(cb.canExecute(), false);
    });

    it("recovers from OPEN through HALF_OPEN to CLOSED", async () => {
      const cb = new EosCircuitBreaker({
        slidingWindowSize: 2,
        failureThresholdPercentage: 50,
        resetTimeoutMs: 50,
        halfOpenTrialSuccesses: 2,
      });

      cb.recordFailure();
      cb.recordFailure();
      assert.equal(cb.getState(), "OPEN");

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      assert.equal(cb.getState(), "HALF_OPEN");
      assert.equal(cb.canExecute(), true);

      // Record trial successes
      cb.recordSuccess();
      assert.equal(cb.getState(), "HALF_OPEN");
      cb.recordSuccess();
      assert.equal(cb.getState(), "CLOSED");
    });
  });

  describe("Suite 4: Token Bucket Rate Limiting", () => {
    it("permits burst up to capacity and blocks when empty", () => {
      const limiter = new EosTokenBucketRateLimiter(5, 100);
      for (let i = 0; i < 5; i++) {
        assert.equal(limiter.tryAcquire(1), true);
      }
      // 6th acquire must fail
      assert.equal(limiter.tryAcquire(1), false);
    });
  });

  describe("Suite 5: Apollo RPC Invocation & Hermes Event Pub/Sub", () => {
    it("executes successful RPC call with microsecond telemetry", async () => {
      const mesh = new EosApolloHermesMesh();
      const res = await mesh.invokeRpc("audio-service", "normalize", { lufs: -14.0 }, (payload) => {
        return { normalized: true, targetLufs: payload.lufs };
      });

      assert.equal(res.success, true);
      assert.equal(res.serviceName, "audio-service");
      assert.equal(res.circuitState, "CLOSED");
      assert.ok(res.durationUs > 0);
      assert.deepEqual(res.data, { normalized: true, targetLufs: -14.0 });
      assert.ok(res.traceContext.headerString.length > 0);
    });

    it("publishes and subscribes to events across partitions", () => {
      const mesh = new EosApolloHermesMesh();
      const received = [];
      const unsubscribe = mesh.subscribe("spotify.track.played", (evt) => {
        received.push(evt);
      });

      const event = mesh.publishEvent("spotify.track.played", "user-123", {
        trackId: "spotify:track:alpha",
        durationMs: 210000,
      });

      assert.equal(received.length, 1);
      assert.equal(received[0].eventId, event.eventId);
      assert.equal(received[0].payload.trackId, "spotify:track:alpha");
      assert.ok(received[0].partitionId >= 0);

      unsubscribe();
      mesh.publishEvent("spotify.track.played", "user-123", { trackId: "spotify:track:beta" });
      assert.equal(received.length, 1); // Unsubscribed, count unchanged
    });

    it("reports mesh health telemetry", () => {
      const mesh = new EosApolloHermesMesh();
      mesh.publishEvent("test.topic", "key-1", { ping: true });
      const report = mesh.getMeshReport();

      assert.equal(report.totalEventsPublished, 1);
      assert.equal(typeof report.rateLimiterAvailableTokens, "number");
    });
  });

  describe("Suite 6: MCP Integration for Apollo, DSP & Fleet Elevator", () => {
    it("advertises eos_apollo_rpc, eos_audio_dsp_benchmark, and eos_fleet_elevate in tools/list", async () => {
      const { EosMcpServer } = await import("../src/mcp/eosMcpServer.ts");
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "mcp-test-list",
        method: "tools/list",
        params: {},
      });

      const toolNames = res.result.tools.map((t) => t.name);
      assert.ok(toolNames.includes("eos_apollo_rpc"));
      assert.ok(toolNames.includes("eos_audio_dsp_benchmark"));
      assert.ok(toolNames.includes("eos_fleet_elevate"));
    });

    it("dispatches eos_apollo_rpc via MCP", async () => {
      const { EosMcpServer } = await import("../src/mcp/eosMcpServer.ts");
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "mcp-test-call-rpc",
        method: "tools/call",
        params: {
          name: "eos_apollo_rpc",
          arguments: {
            serviceName: "audio-stream-service",
            endpoint: "get-track-stream",
            payload: { trackId: "spotify:track:xyz" },
          },
        },
      });

      assert.equal(res.id, "mcp-test-call-rpc");
      const content = JSON.parse(res.result.content[0].text);
      assert.equal(content.serviceName, "audio-stream-service");
      assert.equal(content.circuitState, "CLOSED");
      assert.ok(content.traceparent.startsWith("00-"));
    });

    it("dispatches eos_audio_dsp_benchmark via MCP", async () => {
      const { EosMcpServer } = await import("../src/mcp/eosMcpServer.ts");
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "mcp-test-call-dsp",
        method: "tools/call",
        params: {
          name: "eos_audio_dsp_benchmark",
          arguments: { frames: 4096, iterations: 5 },
        },
      });

      const content = JSON.parse(res.result.content[0].text);
      assert.equal(content.sampleRateHz, 44100);
      assert.ok(content.throughputSamplesSec > 0);
    });
  });

  describe("Suite 7: Deep Resilience, Edge Cases & Error Boundaries", () => {
    it("handles HALF_OPEN failure regression back to OPEN immediately", async () => {
      const cb = new EosCircuitBreaker({
        slidingWindowSize: 2,
        failureThresholdPercentage: 50,
        resetTimeoutMs: 10,
        halfOpenTrialSuccesses: 2,
      });

      // Trip to OPEN (requires 2 failures for slidingWindowSize: 2)
      cb.recordFailure();
      cb.recordFailure();
      assert.equal(cb.getState(), "OPEN");

      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(cb.canExecute(), true);
      assert.equal(cb.getState(), "HALF_OPEN");

      // Failure during HALF_OPEN trips immediately back to OPEN
      cb.recordFailure();
      assert.equal(cb.getState(), "OPEN");
    });

    it("shifts sliding window when capacity exceeded", () => {
      const cb = new EosCircuitBreaker({
        slidingWindowSize: 2,
        failureThresholdPercentage: 100,
        resetTimeoutMs: 100,
      });

      cb.recordSuccess();
      cb.recordSuccess();
      cb.recordSuccess(); // triggers window.shift()
      assert.equal(cb.getState(), "CLOSED");
    });

    it("generates child trace context from string traceparent and fallback", () => {
      const mesh = new EosApolloHermesMesh();

      // Valid string traceparent
      const validHeader = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
      const trace1 = mesh.generateTraceContext(validHeader);
      assert.equal(trace1.traceId, "4bf92f3577b34da6a3ce929d0e0e4736");
      assert.equal(trace1.parentId, "00f067aa0ba902b7");

      // Invalid string traceparent triggers random fallback
      const invalidHeader = "not-a-valid-traceparent";
      const trace2 = mesh.generateTraceContext(invalidHeader);
      assert.equal(trace2.traceId.length, 32);
      assert.equal(trace2.parentId, "0000000000000000");
    });

    it("rejects RPC when token bucket is exhausted with HTTP 429 telemetry", async () => {
      const mesh = new EosApolloHermesMesh(1, 0);

      // Exhaust single token
      const res1 = await mesh.invokeRpc("svc", "ep", {}, async () => "ok");
      assert.equal(res1.success, true);

      // Next request must fail with 429
      const res2 = await mesh.invokeRpc("svc", "ep", {}, async () => "ok");
      assert.equal(res2.success, false);
      assert.ok(res2.error?.includes("429"));
    });

    it("rejects RPC when circuit breaker is OPEN", async () => {
      const mesh = new EosApolloHermesMesh();
      const cb = mesh.getCircuitBreaker("broken-svc", {
        slidingWindowSize: 1,
        failureThresholdPercentage: 1,
        resetTimeoutMs: 60000,
      });
      cb.recordFailure();

      const res = await mesh.invokeRpc("broken-svc", "ep", {}, async () => "ok");
      assert.equal(res.success, false);
      assert.equal(res.circuitState, "OPEN");
      assert.ok(res.error?.includes("is OPEN"));
    });

    it("records failure and captures telemetry when RPC handler throws", async () => {
      const mesh = new EosApolloHermesMesh();
      const res = await mesh.invokeRpc("failing-svc", "ep", {}, async () => {
        throw new Error("RPC internal detonation");
      });

      assert.equal(res.success, false);
      assert.equal(res.error, "RPC internal detonation");
    });

    it("handles subscriber errors gracefully and supports unsubscription", () => {
      const mesh = new EosApolloHermesMesh();
      let callCount = 0;

      const unsub1 = mesh.subscribe("telemetry.event", () => {
        throw new Error("Faulty subscriber");
      });
      const unsub2 = mesh.subscribe("telemetry.event", () => {
        callCount++;
      });

      // Publishing should not throw despite faulty subscriber
      mesh.publishEvent("telemetry.event", "partition-key-1", { status: "good" });
      assert.equal(callCount, 1);

      // Verify report reflects active subscribers and circuit breakers
      mesh.getCircuitBreaker("test-service");
      const report = mesh.getMeshReport();
      assert.ok(report.activeCircuitBreakers.some((b) => b.serviceName === "test-service"));
      assert.equal(report.activeSubscribers, 2);

      // Unsubscribe
      unsub1();
      unsub2();
      unsub2(); // duplicate unsubscribe safe check
      const updatedReport = mesh.getMeshReport();
      assert.equal(updatedReport.activeSubscribers, 0);
    });
  });
});
