/**
 * @file eosAutonomousSentinelDaemon.test.mjs
 * @description Automated test suite for SPEC-362 / CHANGE-224: Autonomous Continuous Sentinel Daemon 24/7.
 *
 * Verifies BDD-1951 through BDD-1956:
 * - BDD-1951: Background Sentinel Daemon Lifecycle & Heartbeat
 * - BDD-1952: Multi-Dimensional Health Probe Evaluation
 * - BDD-1953: Specification Drift Detection
 * - BDD-1954: Raft Swarm Self-Healing Task Dispatch
 * - BDD-1955: Autonomous Verified PR Synthesis
 * - BDD-1956: Diagnostic Audit & Invariant Receipt Generation
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { EosAutonomousSentinelDaemon } from "../src/core/eosAutonomousSentinelDaemon.ts";

test("BDD-1951: Background Sentinel Daemon Lifecycle & Heartbeat", async () => {
  const daemon = new EosAutonomousSentinelDaemon({
    heartbeatIntervalMs: 50,
  });

  assert.equal(daemon.getState(), "STOPPED");
  assert.equal(daemon.getHeartbeatTick(), 0);

  await daemon.start();
  assert.ok(daemon.getState() === "IDLE" || daemon.getState() === "REMEDIATING");
  assert.ok(daemon.getHeartbeatTick() >= 1);

  // Wait for at least one additional background tick
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(daemon.getHeartbeatTick() >= 2);

  await daemon.stop();
  assert.equal(daemon.getState(), "STOPPED");
});

test("BDD-1952: Multi-Dimensional Health Probe Evaluation", async () => {
  const daemon = new EosAutonomousSentinelDaemon();
  const probes = await daemon.runHealthProbes();

  assert.equal(probes.length, 5);
  const pillars = probes.map((p) => p.pillar);
  assert.ok(pillars.includes("LEDGER"));
  assert.ok(pillars.includes("SPEC_AST"));
  assert.ok(pillars.includes("GIT_TREE"));
  assert.ok(pillars.includes("RAFT_SWARM"));
  assert.ok(pillars.includes("FLEET_SOUNDCHECK"));

  for (const probe of probes) {
    assert.equal(probe.status, "HEALTHY");
    assert.ok(probe.latencyMs >= 0);
  }
});

test("BDD-1953: Specification Drift Detection", async () => {
  const daemon = new EosAutonomousSentinelDaemon();
  const report = await daemon.tick();

  assert.ok(report.reportId.startsWith("REP-"));
  assert.equal(report.overallStatus, "HEALTHY");
  assert.ok(report.integrityHash.length === 64);
});

test("BDD-1954: Raft Swarm Self-Healing Task Dispatch", () => {
  const daemon = new EosAutonomousSentinelDaemon();
  const simulatedFinding = {
    findingId: "FND-DRIFT-TEST-42",
    pillar: "SPEC_AST",
    severity: "HIGH",
    epistemicState: "FINDINGS_IDENTIFIED",
    description: "Missing interface method in core module",
    timestamp: Date.now(),
    affectedSpecs: ["SPEC-362-sentinel"],
    targetFiles: ["src/core/eosAutonomousSentinelDaemon.ts"],
  };

  const lease = daemon.dispatchSelfHealingLease(simulatedFinding);
  assert.ok(lease.leaseId.startsWith("LEASE-"));
  assert.equal(lease.findingId, "FND-DRIFT-TEST-42");
  assert.equal(lease.status, "ACTIVE");
  assert.ok(lease.expiresAt > lease.issuedAt);
});

test("BDD-1955: Autonomous Verified PR Synthesis", () => {
  const daemon = new EosAutonomousSentinelDaemon();
  const finding = {
    findingId: "FND-DRIFT-TEST-99",
    pillar: "GIT_TREE",
    severity: "MEDIUM",
    epistemicState: "FINDINGS_IDENTIFIED",
    description: "Whitespace discrepancy detected",
    timestamp: Date.now(),
    affectedSpecs: ["SPEC-362-sentinel"],
    targetFiles: ["src/core/eosAutonomousSentinelDaemon.ts"],
  };

  const lease = daemon.dispatchSelfHealingLease(finding);
  const patchContent = "// Corrected formatting verified by CEGIS\nexport const V = 1;";
  const pr = daemon.synthesizeAutonomousPr(lease, patchContent);

  assert.ok(pr.prId.startsWith("PR-"));
  assert.ok(pr.title.includes("autonomous remediation"));
  assert.equal(pr.cegisProofVerified, true);
  assert.equal(pr.zeroSecretsVerified, true);
  assert.ok(pr.patchDigest.length === 64);
  assert.ok(pr.diffSummary.includes("CEGIS formal proof"));
});

test("BDD-1956: Diagnostic Audit & Invariant Receipt Generation", async () => {
  const daemon = new EosAutonomousSentinelDaemon({ heartbeatIntervalMs: 50 });
  const receipt = await daemon.audit();

  assert.equal(receipt.specId, "SPEC-362");
  assert.equal(receipt.changeId, "CHANGE-224");
  assert.equal(receipt.checks.heartbeatLoopNonBlocking, "PASS");
  assert.equal(receipt.checks.multiDimensionalProbes, "PASS");
  assert.equal(receipt.checks.specAstDriftDetection, "PASS");
  assert.equal(receipt.checks.raftSwarmRemediationLease, "PASS");
  assert.equal(receipt.checks.cegisVerifiedPrSynthesis, "PASS");
  assert.equal(receipt.checks.zeroDependencyPurity, "PASS");
  assert.ok(receipt.integrityHash.length === 64);
  assert.ok(receipt.receiptId.startsWith("REC-SENTINEL-"));
});
