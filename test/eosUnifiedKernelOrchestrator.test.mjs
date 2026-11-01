/**
 * Unit Test Suite for EosUnifiedKernelOrchestrator
 * Specification: SPEC-115 (IEEE 830 / ISO 29148)
 * Standard: Google Borg/Autopilot & Netflix Keystone Unified Control Standard
 * Acceptance Criteria: BDD-299 to BDD-302
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosUnifiedKernelOrchestrator } from "../src/core/eosUnifiedKernelOrchestrator.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

test("BDD-299: Nominal Reconciliation & High Omni-System Equilibrium Index (OSEI >= 85)", () => {
  const kernel = EosUnifiedKernelOrchestrator.getInstance();
  kernel.reset();

  const receipt = kernel.reconcile({
    fleetSoundcheckScore: 100,
    sloErrorBudgetConsumptionPct: 0,
    predictiveHazardSeverityPct: 0,
    concurrencyHeadroomPct: 100,
    syntheticSocketBacklog: 50,
    virtualPagePressurePct: 40
  });

  assert.equal(receipt.oseiScore, 100);
  assert.equal(receipt.state, "BALANCED");
  assert.equal(receipt.mitigationAction, "STABILIZE_NOMINAL");
  assert.equal(receipt.canaryFreezeActive, false);
  assert.equal(receipt.sha256Attestation.length, 64);

  const status = kernel.getStatus();
  assert.equal(status.state, "BALANCED");
  assert.equal(status.totalCycles, 1);
  assert.equal(status.nominalCycles, 1);
  assert.equal(status.mitigationCycles, 0);
  assert.equal(status.currentOseiScore, 100);
});

test("BDD-300: Critical Compound Fault Reconciliation & Emergency Load Shedding (OSEI < 50)", () => {
  const kernel = EosUnifiedKernelOrchestrator.getInstance();
  kernel.reset();

  const receipt = kernel.reconcile({
    fleetSoundcheckScore: 40,
    sloErrorBudgetConsumptionPct: 90,
    predictiveHazardSeverityPct: 80,
    concurrencyHeadroomPct: 20
  });

  // OSEI calculation:
  // 0.25 * 40 = 10
  // 0.25 * (100 - 90) = 2.5
  // 0.25 * (100 - 80) = 5
  // 0.25 * 20 = 5
  // Sum = 22.5 (< 50)
  assert.ok(receipt.oseiScore < 50, `Expected OSEI < 50, got ${receipt.oseiScore}`);
  assert.equal(receipt.state, "CRITICAL");
  assert.equal(receipt.mitigationAction, "EMERGENCY_SHED");
  assert.equal(receipt.canaryFreezeActive, true);
  assert.equal(receipt.sha256Attestation.length, 64);

  const status = kernel.getStatus();
  assert.equal(status.state, "CRITICAL");
  assert.equal(status.totalCycles, 1);
  assert.equal(status.nominalCycles, 0);
  assert.equal(status.mitigationCycles, 1);
});

test("BDD-301: Intermediate Degradation Triggering Adaptive Throttling & Canary Freeze", () => {
  const kernel = EosUnifiedKernelOrchestrator.getInstance();
  kernel.reset();

  const receipt = kernel.reconcile({
    fleetSoundcheckScore: 80,
    sloErrorBudgetConsumptionPct: 40,
    predictiveHazardSeverityPct: 55,
    concurrencyHeadroomPct: 60
  });

  // OSEI calculation:
  // 0.25 * 80 = 20
  // 0.25 * 60 = 15
  // 0.25 * 45 = 11.25
  // 0.25 * 60 = 15
  // Total ~ 61.25 (between 50 and 84)
  assert.ok(receipt.oseiScore >= 50 && receipt.oseiScore < 85);
  assert.equal(receipt.state, "DEGRADED");
  assert.equal(receipt.mitigationAction, "THROTTLE_ADAPTIVE");
  assert.equal(receipt.canaryFreezeActive, true);
});

test("BDD-302: EosMcpServer Kernel Orchestrator Tool Dispatch", async () => {
  const server = new EosMcpServer(process.cwd());

  // 1. Test reconcile dispatch
  const reconcileReq = {
    jsonrpc: "2.0",
    id: "test-reconcile-1",
    method: "tools/call",
    params: {
      name: "eos_kernel_orchestrator_reconcile",
      arguments: {
        fleetSoundcheckScore: 100,
        sloErrorBudgetConsumptionPct: 0,
        predictiveHazardSeverityPct: 0,
        concurrencyHeadroomPct: 100
      }
    }
  };

  const reconcileResponse = await server.handleRequest(reconcileReq);
  assert.equal(reconcileResponse.error, undefined);
  assert.ok(reconcileResponse.result);
  const reconcileContent = JSON.parse(reconcileResponse.result.content[0].text);
  assert.equal(reconcileContent.state, "BALANCED");
  assert.equal(reconcileContent.mitigationAction, "STABILIZE_NOMINAL");
  assert.equal(reconcileContent.canaryFreezeActive, false);
  assert.equal(reconcileContent.sha256Attestation.length, 64);

  // 2. Test status dispatch
  const statusReq = {
    jsonrpc: "2.0",
    id: "test-status-1",
    method: "tools/call",
    params: {
      name: "eos_kernel_orchestrator_status",
      arguments: {}
    }
  };

  const statusResponse = await server.handleRequest(statusReq);
  assert.equal(statusResponse.error, undefined);
  assert.ok(statusResponse.result);
  const statusContent = JSON.parse(statusResponse.result.content[0].text);
  assert.equal(statusContent.state, "BALANCED");
  assert.ok(statusContent.totalCycles >= 1);
});
