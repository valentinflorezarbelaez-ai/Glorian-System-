/**
 * Test Suite: EosAdaptiveConcurrencyGovernor (SPEC-112 / BDD-288 / BDD-289 / BDD-290)
 *
 * Verifies:
 * 1. BDD-288: Dynamic Vegas gradient contraction under latency spike and expansion on recovery.
 * 2. BDD-289: Priority-tier load shedding preserving Critical and High while shedding Best Effort and Normal.
 * 3. BDD-290: Queue delay bounding (CoDel bufferbloat prevention) shedding requests waiting > 15ms.
 * 4. MCP Server tool call handling for eos_concurrency_evaluate and eos_concurrency_status.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { EosAdaptiveConcurrencyGovernor } from "../src/core/eosAdaptiveConcurrencyGovernor.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("EOS SPEC-112: Adaptive Concurrency Control & Priority Load Shedder Suite", () => {
  it("BDD-288: Contracts concurrency limit when latency spikes and expands upon recovery", () => {
    const governor = new EosAdaptiveConcurrencyGovernor({
      minLimit: 10,
      maxLimit: 100,
      initialLimit: 50,
      queueHeadroom: 3,
      smoothingAlpha: 0.5
    });

    // Establish baseline at 20ms
    governor.recordLatency(20);
    let status = governor.getStatus();
    assert.strictEqual(status.baselineRttMs, 20);
    assert.ok(status.currentLimit >= 50 && status.currentLimit <= 55);

    // Latency spikes dramatically to 80ms (4x baseline)
    for (let i = 0; i < 5; i++) {
      governor.recordLatency(80);
    }

    status = governor.getStatus();
    assert.ok(status.gradient < 0.35, `Gradient should contract below 0.35, got ${status.gradient}`);
    assert.ok(status.currentLimit < 30, `Limit should contract down, got ${status.currentLimit}`);
    assert.ok(status.currentLimit >= 10, "Limit must not fall below minLimit (10)");

    // System recovers: latency drops back to 20ms
    for (let i = 0; i < 10; i++) {
      governor.recordLatency(20);
    }

    const recoveredStatus = governor.getStatus();
    assert.ok(recoveredStatus.gradient > 0.90, `Gradient should recover near 1.0, got ${recoveredStatus.gradient}`);
    assert.ok(recoveredStatus.currentLimit > status.currentLimit, "Limit should expand upon recovery");
    assert.ok(recoveredStatus.sha256Receipt.length === 64);
  });

  it("BDD-289: Sheds low-priority tiers progressively while preserving Critical & High traffic", () => {
    const governor = new EosAdaptiveConcurrencyGovernor({
      minLimit: 10,
      maxLimit: 50,
      initialLimit: 20,
      emergencyHeadroom: 5
    });

    // Fill capacity up to 16 in-flight (80% of 20)
    for (let i = 0; i < 16; i++) {
      const decision = governor.tryAcquire("HIGH");
      assert.strictEqual(decision.admitted, true);
    }

    // At 16 in-flight (>= 80% of 20), BEST_EFFORT must be shed
    const bestEffortDecision = governor.tryAcquire("BEST_EFFORT");
    assert.strictEqual(bestEffortDecision.admitted, false);
    assert.ok(bestEffortDecision.reason?.includes("SHED_BEST_EFFORT"));

    // NORMAL is still admitted (below 95% = 19)
    const normalDecision = governor.tryAcquire("NORMAL");
    assert.strictEqual(normalDecision.admitted, true);

    // Fill to 20 in-flight (100% of limit)
    governor.tryAcquire("HIGH"); // 18
    governor.tryAcquire("HIGH"); // 19
    governor.tryAcquire("HIGH"); // 20

    // At 20 in-flight, HIGH and NORMAL are shed
    const highAtLimit = governor.tryAcquire("HIGH");
    assert.strictEqual(highAtLimit.admitted, false);
    assert.ok(highAtLimit.reason?.includes("SHED_HIGH"));

    // CRITICAL utilizes emergency headroom (can admit up to 20 + 5 = 25)
    const criticalDecision = governor.tryAcquire("CRITICAL");
    assert.strictEqual(criticalDecision.admitted, true);

    const status = governor.getStatus();
    assert.strictEqual(status.inFlight, 21);
    assert.ok(status.totalShed >= 2);
    assert.strictEqual(status.shedByTier.CRITICAL, 0, "No critical requests should have been shed");
  });

  it("BDD-290: Binds queue residency delay and sheds requests experiencing bufferbloat (CoDel)", () => {
    const governor = new EosAdaptiveConcurrencyGovernor({
      maxQueueDelayMs: 15
    });

    // Request waiting within delay limit (10ms <= 15ms)
    const freshDecision = governor.tryAcquire("NORMAL", 10);
    assert.strictEqual(freshDecision.admitted, true);

    // Request waiting too long in queue (25ms > 15ms)
    const staleDecision = governor.tryAcquire("NORMAL", 25);
    assert.strictEqual(staleDecision.admitted, false);
    assert.ok(staleDecision.reason?.includes("QUEUE_DELAY_EXCEEDED"));

    const status = governor.getStatus();
    assert.strictEqual(status.totalShed, 1);
    assert.strictEqual(status.totalAdmitted, 1);
  });

  it("MCP Integration: Evaluates concurrency admission and queries status via JSON-RPC", async () => {
    const server = new EosMcpServer();

    // 1. Evaluate admission for CRITICAL request
    const evalRes = await server.handleRequest({
      jsonrpc: "2.0",
      id: "req-conc-1",
      method: "tools/call",
      params: {
        name: "eos_concurrency_evaluate",
        arguments: {
          priority: "CRITICAL",
          queueWaitMs: 5,
          releaseAfterSimulatedRttMs: 25
        }
      }
    });

    assert.ok(evalRes.result);
    assert.ok(!evalRes.error);
    const evalData = JSON.parse(evalRes.result.content[0].text);
    assert.strictEqual(evalData.admitted, true);
    assert.strictEqual(evalData.priority, "CRITICAL");
    assert.ok(evalData.sha256Receipt.length === 64);

    // 2. Query status via eos_concurrency_status
    const statusRes = await server.handleRequest({
      jsonrpc: "2.0",
      id: "req-conc-2",
      method: "tools/call",
      params: {
        name: "eos_concurrency_status",
        arguments: {
          recordLatencyMs: 30
        }
      }
    });

    assert.ok(statusRes.result);
    assert.ok(!statusRes.error);
    const statusData = JSON.parse(statusRes.result.content[0].text);
    assert.ok(statusData.currentLimit >= 10);
    assert.ok(statusData.gradient > 0);
    assert.ok(statusData.sha256Receipt.length === 64);
  });
});
