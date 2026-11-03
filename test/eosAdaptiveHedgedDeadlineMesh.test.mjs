/**
 * Test Suite: EosAdaptiveHedgedDeadlineMesh (SPEC-111 / BDD-285 / BDD-286 / BDD-287)
 *
 * Verifies:
 * 1. BDD-285: Tail-latency straggler mitigation via speculative hedged request & cancellation.
 * 2. BDD-286: Contextual deadline budget expiration and downstream fail-fast shedding.
 * 3. BDD-287: Anti-storm token bucket regulation enforcing strict <= 5% hedging volume.
 * 4. MCP Server tool call handling for eos_hedge_request_execute and eos_hedge_metrics_status.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  EosAdaptiveHedgedDeadlineMesh,
  EosDeadlineContext
} from "../src/core/eosAdaptiveHedgedDeadlineMesh.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("EOS SPEC-111: Distributed Adaptive Hedged Requests & Deadline Mesh Suite", () => {
  it("BDD-285: Mitigates tail latency stragglers via speculative hedged duplicate and aborts lagging replica", async () => {
    const mesh = new EosAdaptiveHedgedDeadlineMesh({ maxHedgeRatePercent: 10, defaultP95Ms: 30 });
    const endpointId = "search-service";

    // Bootstrap baseline requests to give token bucket headroom
    for (let i = 0; i < 20; i++) {
      mesh.recordSample(endpointId, 25);
    }

    let primaryAborted = false;
    let hedgedAborted = false;

    // Dispatch request where primary lags at 300ms, but hedged responds in 15ms
    const result = await mesh.executeHedged({
      endpointId,
      hedgingDelayMs: 25, // Trigger hedge after 25ms
      primaryFn: (signal) => new Promise((resolve) => {
        signal.addEventListener("abort", () => {
          primaryAborted = true;
        });
        setTimeout(() => resolve("PRIMARY_SLOW"), 300);
      }),
      hedgedFn: (signal) => new Promise((resolve) => {
        signal.addEventListener("abort", () => {
          hedgedAborted = true;
        });
        setTimeout(() => resolve("HEDGED_FAST"), 15);
      })
    });

    assert.strictEqual(result.result, "HEDGED_FAST");
    assert.strictEqual(result.executedBy, "HEDGED");
    assert.strictEqual(result.hedgeDispatched, true);
    assert.ok(result.latencyMs < 250, `Latency should be ~40ms and beat primary (300ms), got ${result.latencyMs}ms`);
    assert.ok(result.sha256Receipt.length === 64);

    // Give microtask tick for abort signal listener
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(primaryAborted, true, "Lagging primary request must be cancelled cooperatively");
    assert.strictEqual(hedgedAborted, false, "Winner must not be aborted");
  });

  it("BDD-286: Enforces strict deadline budget propagation and sheds downstream calls early", async () => {
    const mesh = new EosAdaptiveHedgedDeadlineMesh();
    const endpointId = "database-service";

    // Expired deadline context (e.g. timeout elapsed before dispatch)
    const expiredContext = new EosDeadlineContext(Date.now() - 50);
    assert.strictEqual(expiredContext.isExpired(), true);
    assert.ok(expiredContext.getRemainingMs() <= 0);

    let executed = false;

    await assert.rejects(
      async () => {
        await mesh.executeHedged({
          endpointId,
          deadlineContext: expiredContext,
          primaryFn: async () => {
            executed = true;
            return "SHOULD_NOT_EXECUTE";
          },
          hedgedFn: async () => "HEDGED"
        });
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("DEADLINE_EXCEEDED"));
        return true;
      }
    );

    assert.strictEqual(executed, false, "Downstream call must be shed without dispatching");

    const metrics = mesh.getMetrics();
    assert.strictEqual(metrics.shedRequests, 1);
  });

  it("BDD-287: Suppresses hedging storms and caps speculative volume to <= 5%", () => {
    const mesh = new EosAdaptiveHedgedDeadlineMesh({ maxHedgeRatePercent: 5, defaultP95Ms: 20 });
    const endpointId = "payment-gateway";

    // Simulate 100 requests where primary latency is 100ms (> delay of 20ms)
    // If unrestricted, all 100 would hedge (100% hedge rate).
    // With anti-storm bucket, at most 5 requests can be hedged!
    let hedgeCount = 0;

    for (let i = 0; i < 100; i++) {
      const res = mesh.executeHedgedSync({
        endpointId,
        hedgingDelayMs: 20,
        simulatedPrimaryDelayMs: 100, // Straggler
        simulatedHedgedDelayMs: 10
      });
      if (res.hedgeDispatched) {
        hedgeCount++;
      }
    }

    const metrics = mesh.getMetrics();
    assert.ok(metrics.hedgedRatePct <= 5.0, `Hedging rate must be <= 5%, got ${metrics.hedgedRatePct}%`);
    assert.ok(hedgeCount <= 5, `Expected at most 5 hedged requests out of 100, got ${hedgeCount}`);
    assert.strictEqual(metrics.totalRequests, 100);
    assert.ok(metrics.sha256Receipt.length === 64);
  });

  it("MCP Integration: Dispatches synthetic probe and retrieves metrics via JSON-RPC", async () => {
    const server = new EosMcpServer();
    const endpointId = "fleet-edge-proxy";

    // 1. Record sample latency
    const metricsInit = await server.handleRequest({
      jsonrpc: "2.0",
      id: "req-hedge-1",
      method: "tools/call",
      params: {
        name: "eos_hedge_metrics_status",
        arguments: {
          endpointId,
          recordSampleLatencyMs: 35
        }
      }
    });

    assert.ok(metricsInit.result);
    assert.ok(!metricsInit.error);
    const initData = JSON.parse(metricsInit.result.content[0].text);
    assert.strictEqual(initData.endpointId, endpointId);
    assert.strictEqual(initData.stats.sampleCount, 1);

    // 2. Execute synthetic hedged request via eos_hedge_request_execute
    const execRes = await server.handleRequest({
      jsonrpc: "2.0",
      id: "req-hedge-2",
      method: "tools/call",
      params: {
        name: "eos_hedge_request_execute",
        arguments: {
          endpointId,
          deadlineMs: 500,
          simulatedPrimaryDelayMs: 15,
          simulatedHedgedDelayMs: 10
        }
      }
    });

    assert.ok(execRes.result);
    assert.ok(!execRes.error);
    const execData = JSON.parse(execRes.result.content[0].text);
    assert.strictEqual(execData.executedBy, "PRIMARY");
    assert.ok(execData.sha256Receipt.length === 64);
  });
});
