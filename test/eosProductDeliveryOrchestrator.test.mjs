/**
 * SPEC-147 / LADDER-15 — Product Delivery Orchestrator BDD-420..425
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EosProductDeliveryOrchestrator,
  resolveDeliveryTrack,
  createHermeticVerificationGatePort,
  DELIVERY_MUTATION_TARGET_SNIPPET,
  deliveryAdmitOracle,
  computeProductQualityScorecard
} from "../src/core/eosProductDeliveryOrchestrator.ts";
import { EosMutationTester } from "../src/core/eosMutationTester.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function demoManifest(overrides = {}) {
  return {
    id: "demo-ledger-mvp",
    name: "Demo Ledger MVP",
    domain: "fintech-ledger",
    description: "Hermetic dogfood product for LADDER-15 Product Delivery Orchestrator",
    tier: "MVP",
    platforms: ["distributed-backend", "web"],
    entities: ["LedgerEntry", "Account"],
    commands: ["PostEntry", "ReconcileBooks"],
    compliance: ["SLSA_4"],
    ...overrides
  };
}

test("BDD-420: Dry-run connects Foundry to Sovereign Loop", () => {
  const result = EosProductDeliveryOrchestrator.deliverProduct(demoManifest(), {
    dryRun: true,
    projectRoot,
    enforceGates: true
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.dryRun, true);
  assert.ok(result.topology?.valid);
  assert.ok(result.intelGovernanceStagesCompleted >= 9);
  assert.match(result.sha256Receipt, /^[a-f0-9]{64}$/);
  assert.ok(result.scorecard);
  assert.ok(result.scorecard.score >= 80);
});

test("BDD-421: Law IV blocks external satellite materialization", () => {
  const result = EosProductDeliveryOrchestrator.deliverProduct(demoManifest({ id: "external-probe" }), {
    dryRun: false,
    externalSatellite: true,
    projectRoot,
    lawIv: {
      registered: false,
      intakeComplete: false,
      specificationApproved: false,
      auditComplete: false,
      ownerApproval: false,
      implementationAuthorized: false
    }
  });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason, "LAW_IV_INCOMPLETE");
  assert.equal(result.deploymentAttempted, false);
});

test("BDD-422: Gate failure stops deployment", () => {
  const result = EosProductDeliveryOrchestrator.deliverProduct(demoManifest({ id: "gate-fail-probe" }), {
    dryRun: true,
    projectRoot,
    enforceGates: true,
    gates: createHermeticVerificationGatePort({ turboExit: 1 })
  });

  assert.equal(result.status, "FAILED");
  assert.equal(result.reason, "VERIFICATION_GATE_FAILED");
  assert.equal(result.epistemicState, "REMEDIATION_REQUIRED");
  assert.equal(result.deploymentAttempted, false);
  assert.equal(result.scorecard, null);
});

test("BDD-423: Dual-track routing", () => {
  assert.equal(resolveDeliveryTrack("MVP"), "FastTrack");
  assert.equal(resolveDeliveryTrack("MISSION_CRITICAL"), "HeavySddTrack");
  assert.equal(resolveDeliveryTrack("ENTERPRISE"), "HeavySddTrack");
  assert.equal(resolveDeliveryTrack("PLANETARY"), "HeavySddTrack");
});

test("BDD-424: Product quality scorecard threshold", () => {
  const result = EosProductDeliveryOrchestrator.deliverProduct(demoManifest({ tier: "ENTERPRISE", id: "scorecard-probe" }), {
    dryRun: true,
    projectRoot,
    enforceGates: true
  });
  assert.ok(result.scorecard);
  assert.ok(result.scorecard.score >= 80);
  assert.ok(result.scorecard.grade === "A+" || result.scorecard.grade === "B");

  const card = computeProductQualityScorecard({
    topology: result.topology,
    gateResults: result.gateResults,
    mutationScore: result.scorecard.mutationFloor,
    timeToGreenMs: result.durationMs,
    blastRadiusKnown: true
  });
  assert.ok(card.score >= 80);
});

test("BDD-425: Mutation floor on delivery admit", () => {
  const tester = new EosMutationTester();
  const report = tester.evaluateTestSuite(DELIVERY_MUTATION_TARGET_SNIPPET, deliveryAdmitOracle);
  assert.ok(report.mutationScore >= 80, `mutationScore ${report.mutationScore} < 80`);
  assert.equal(report.grade, "TIER_S_CERTIFIED");
});

test("BDD-420b: Hermetic dogfood materializes docs/products/demo-ledger-mvp", () => {
  const result = EosProductDeliveryOrchestrator.deliverProduct(demoManifest(), {
    dryRun: false,
    projectRoot,
    enforceGates: true,
    externalSatellite: false
  });
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.sddPackagePath, "docs/products/demo-ledger-mvp");
  const base = path.join(projectRoot, "docs", "products", "demo-ledger-mvp");
  assert.ok(fs.existsSync(path.join(base, "INTAKE.md")));
  assert.ok(fs.existsSync(path.join(base, "SPEC.md")));
  assert.ok(fs.existsSync(path.join(base, "PLAN.md")));
  assert.ok(fs.existsSync(path.join(base, "TASKS.md")));
  assert.ok(fs.existsSync(path.join(base, "blueprint.json")));
  assert.ok(fs.existsSync(path.join(base, "scorecard.json")));
});

test("SPEC-147 status surface", () => {
  const status = EosProductDeliveryOrchestrator.getStatus();
  assert.equal(status.ladder, "LADDER-15");
  assert.equal(status.specId, "SPEC-147");
  assert.equal(status.epistemicTarget, "PRODUCT_DELIVERY_ORCHESTRATOR_VERIFIED_WITHIN_SCOPE");
});

test("SPEC-147 MCP tools dispatch cleanly", async () => {
  const mcp = new EosMcpServer(projectRoot);
  const statusRes = await mcp.handleRequest({
    jsonrpc: "2.0",
    id: 1471,
    method: "tools/call",
    params: { name: "eos_product_deliver_status", arguments: {} }
  });
  assert.equal(statusRes.id, 1471);
  const statusData = JSON.parse(statusRes.result.content[0].text);
  assert.equal(statusData.ladder, "LADDER-15");
  assert.equal(statusData.specId, "SPEC-147");

  const runRes = await mcp.handleRequest({
    jsonrpc: "2.0",
    id: 1472,
    method: "tools/call",
    params: { name: "eos_product_deliver_run", arguments: { name: "MCP Test Product", write: false } }
  });
  assert.equal(runRes.id, 1472);
  const runData = JSON.parse(runRes.result.content[0].text);
  assert.equal(runData.status, "SUCCESS");
  assert.equal(runData.dryRun, true);
});

