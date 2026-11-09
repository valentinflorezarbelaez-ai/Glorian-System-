/**
 * Test Suite: EosMultiWindowSloGovernor (SPEC-110 / BDD-282 / BDD-283 / BDD-284)
 *
 * Verifies:
 * 1. BDD-282: Deterministic error budget and burn rate calculation across sliding windows.
 * 2. BDD-283: Dual-window correlation and transient spike suppression (Tier 1 vs Transient).
 * 3. BDD-284: Autonomous sovereign deployment freeze on error budget exhaustion.
 * 4. MCP Server tool call handling for eos_slo_burn_rate_evaluate and eos_slo_budget_status.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { EosMultiWindowSloGovernor } from "../src/core/eosMultiWindowSloGovernor.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("EOS SPEC-110: Multi-Window Multi-Burn-Rate SLO & Error Budget Governor Suite", () => {
  it("BDD-282: Calculates multi-window burn rates and error budget consumption deterministically", () => {
    const governor = new EosMultiWindowSloGovernor(0.999); // 99.9% SLO -> budget = 0.001 (0.1%)
    const serviceId = "auth-service";

    governor.registerService({
      serviceId,
      availabilitySlo: 0.999,
      latencyThresholdMs: 400,
    });

    const baseNow = 1700000000000;

    // Ingest 1000 events: 999 good, 1 bad -> error rate = 0.001 (burn rate = 1.0x)
    for (let i = 0; i < 999; i++) {
      governor.ingestEvent(serviceId, { timestamp: baseNow - i * 100, statusCode: 200, latencyMs: 50 });
    }
    governor.ingestEvent(serviceId, { timestamp: baseNow - 50, statusCode: 500, latencyMs: 120 });

    const status = governor.evaluateService(serviceId, baseNow);

    assert.strictEqual(status.serviceId, serviceId);
    assert.strictEqual(status.availabilitySlo, 0.999);
    assert.strictEqual(status.errorBudgetFraction, 0.001);
    assert.strictEqual(status.healthState, "NOMINAL_HEALTHY");
    assert.strictEqual(status.isDeploymentFrozen, false);

    // 1 error out of 1000 events with 0.001 budget fraction = exactly 1.0x burn rate
    assert.strictEqual(status.windows.window5m.burnRate, 1.0);
    assert.strictEqual(status.windows.window5m.totalEvents, 1000);
    assert.strictEqual(status.windows.window5m.totalErrors, 1);
    assert.ok(status.sha256Receipt.length === 64, "Must output a valid SHA-256 cryptographic receipt");
  });

  it("BDD-283: Suppresses transient spikes without false alerts and triggers Tier 1 on sustained burn", () => {
    const governor = new EosMultiWindowSloGovernor(0.999);
    const serviceId = "api-gateway";

    governor.registerService({
      serviceId,
      availabilitySlo: 0.999,
      periodTotalEventsBudget: 100000,
    });

    const baseNow = 1700005000000;

    // Transient spike: 5 errors in 30s, but 0 errors in preceding 55 minutes
    for (let i = 0; i < 9900; i++) {
      governor.ingestEvent(serviceId, { timestamp: baseNow - 10 * 60 * 1000 - i * 200, statusCode: 200 });
    }
    for (let i = 0; i < 95; i++) {
      governor.ingestEvent(serviceId, { timestamp: baseNow - 60000 + i * 500, statusCode: 200 });
    }
    for (let i = 0; i < 5; i++) {
      governor.ingestEvent(serviceId, { timestamp: baseNow - 30000 + i * 500, statusCode: 500 });
    }

    const spikeStatus = governor.evaluateService(serviceId, baseNow);

    // window5m has high burn rate, but window1h is below 14.4x
    assert.ok(spikeStatus.windows.window5m.burnRate > 14.4, "5m window saw high spike");
    assert.ok(spikeStatus.windows.window1h.burnRate < 14.4, "1h window burn rate is below 14.4x");
    assert.strictEqual(spikeStatus.healthState, "NOMINAL_HEALTHY", "Transient spike must be suppressed");
    assert.strictEqual(spikeStatus.isDeploymentFrozen, false, "Transient spike must not freeze deployments");

    // Sustained outage: add high sustained error rate across the entire hour
    governor.resetService(serviceId);
    for (let i = 0; i < 1000; i++) {
      // 5% error rate sustained across the full hour (0.05 / 0.001 = 50.0x burn rate)
      const isErr = i % 20 === 0;
      governor.ingestEvent(serviceId, {
        timestamp: baseNow - i * 3000, // spans 3000s = 50 min
        statusCode: isErr ? 500 : 200,
      });
    }

    const sustainedStatus = governor.evaluateService(serviceId, baseNow);
    assert.strictEqual(sustainedStatus.healthState, "CRITICAL_BURN");
    assert.strictEqual(sustainedStatus.isDeploymentFrozen, true);
    assert.ok(sustainedStatus.activeAlerts.some((a) => a.includes("ALERT_TIER_1_CRITICAL")));
  });

  it("BDD-284: Autonomous sovereign deployment freeze on error budget exhaustion", () => {
    const governor = new EosMultiWindowSloGovernor(0.999);
    const serviceId = "payment-ledger";

    governor.registerService({
      serviceId,
      availabilitySlo: 0.999,
      periodTotalEventsBudget: 10000, // 10,000 * 0.001 = 10 allowed errors
    });

    const baseNow = 1700010000000;

    // Simulate 30-day budget depletion: 20 errors > 10 allowed errors
    for (let i = 0; i < 500; i++) {
      const isErr = i % 25 === 0; // 20 errors out of 500
      governor.ingestEvent(serviceId, {
        timestamp: baseNow - i * 60000,
        statusCode: isErr ? 503 : 200,
      });
    }

    const budgetStatus = governor.evaluateService(serviceId, baseNow);
    assert.ok(budgetStatus.errorBudgetRemainingPct <= 0, "Budget must be <= 0% remaining");
    assert.strictEqual(budgetStatus.healthState, "BUDGET_EXHAUSTED");
    assert.strictEqual(budgetStatus.isDeploymentFrozen, true);

    const check = governor.isDeploymentAllowed(serviceId, baseNow);
    assert.strictEqual(check.allowed, false);
    assert.ok(check.reason?.includes("DEPLOYMENT_FROZEN"));
  });

  it("MCP Integration: Evaluates SLO and queries budget status via JSON-RPC handleRequest", async () => {
    const server = new EosMcpServer();
    const serviceId = "eos-fleet-service";

    // 1. Evaluate burn rate via eos_slo_burn_rate_evaluate
    const evalRes = await server.handleRequest({
      jsonrpc: "2.0",
      id: "req-slo-1",
      method: "tools/call",
      params: {
        name: "eos_slo_burn_rate_evaluate",
        arguments: {
          serviceId,
          events: [
            { timestamp: Date.now() - 1000, statusCode: 200, latencyMs: 40 },
            { timestamp: Date.now() - 500, statusCode: 200, latencyMs: 60 },
          ],
        },
      },
    });

    assert.ok(evalRes.result);
    assert.ok(!evalRes.error);
    const evalData = JSON.parse(evalRes.result.content[0].text);
    assert.strictEqual(evalData.serviceId, serviceId);
    assert.strictEqual(evalData.isDeploymentFrozen, false);
    assert.ok(evalData.sha256Receipt.length === 64);

    // 2. Query budget status via eos_slo_budget_status
    const budgetRes = await server.handleRequest({
      jsonrpc: "2.0",
      id: "req-slo-2",
      method: "tools/call",
      params: {
        name: "eos_slo_budget_status",
        arguments: {
          serviceId,
          checkDeploymentAllowed: true,
        },
      },
    });

    assert.ok(budgetRes.result);
    assert.ok(!budgetRes.error);
    const budgetData = JSON.parse(budgetRes.result.content[0].text);
    assert.strictEqual(budgetData.allowed, true);
  });
});
