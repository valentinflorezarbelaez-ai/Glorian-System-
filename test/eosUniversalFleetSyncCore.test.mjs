import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { EosUniversalFleetSyncCore } from "../src/core/eosUniversalFleetSyncCore.ts";
import { dispatchPhase7FrontierActionExt } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts";

test("BDD-1144: Registry Parsing and Deterministic Path Resolution", () => {
  const root = process.cwd();
  const registry = EosUniversalFleetSyncCore.loadRegistry(root);
  assert.equal(registry.projects.length, 9, "Registry must declare exactly 9 projects");
  assert.ok(registry.version.length > 0);

  const resolved = EosUniversalFleetSyncCore.resolveFleetProjects(root);
  assert.equal(resolved.length, 9);

  const eosSystem = resolved.find((p) => p.id === "eos-system");
  assert.ok(eosSystem, "eos-system control plane must be present in registry");
  assert.equal(eosSystem.resolution, "CONTROL_PLANE");
  assert.equal(eosSystem.existsLocally, true);
  assert.ok(eosSystem.path !== null);

  for (const p of resolved) {
    assert.ok(p.id.length > 0);
    assert.ok(p.name.length > 0);
    assert.ok(p.remoteUrl.startsWith("https://github.com/"));
  }
});

test("BDD-1145: Cross-Fleet Git Synchronization and Divergence Detection", () => {
  const root = process.cwd();
  const report = EosUniversalFleetSyncCore.syncFleet(root);

  assert.equal(report.totalProjects, 9);
  assert.ok(report.fleetMerkleRoot.length === 64, "Merkle root must be a 64-char SHA-256 hex string");
  assert.ok(report.receipt.length === 64);

  const eosResult = report.results.find((r) => r.id === "eos-system");
  assert.ok(eosResult);
  assert.ok(
    ["IN_SYNC", "DIRTY_TREE"].includes(eosResult.syncState),
    `eos-system state should be IN_SYNC or DIRTY_TREE, got ${eosResult.syncState}`,
  );
  assert.ok(typeof eosResult.isClean === "boolean");
  assert.ok(eosResult.headCommitSha.length >= 7);

  // Check federated and sibling projects
  const federatedResults = report.results.filter((r) => r.id !== "eos-system");
  assert.equal(federatedResults.length, 8);
  const validStates = ["IN_SYNC", "DIRTY_TREE", "LOCAL_AHEAD", "REMOTE_AHEAD", "DIVERGED", "FEDERATED_ATTESTED"];
  for (const r of federatedResults) {
    assert.ok(validStates.includes(r.syncState), `Unexpected state ${r.syncState} for ${r.id}`);
  }
});

test("BDD-1146: Autonomous Healing of Manifest Drift and Directory Markers", () => {
  const root = process.cwd();
  const projects = EosUniversalFleetSyncCore.resolveFleetProjects(root);

  for (const p of projects) {
    const healRes = EosUniversalFleetSyncCore.healProject(root, p);
    assert.equal(healRes.projectId, p.id);
    assert.ok(["HEALED", "ALREADY_NOMINAL", "SKIPPED"].includes(healRes.status));
  }

  const healAllReport = EosUniversalFleetSyncCore.healAll(root);
  assert.equal(healAllReport.totalEvaluated, 9);
  assert.ok(healAllReport.receipt.length === 64);
});

test("BDD-1147: 4-Pillar Spotify Soundcheck Scoring and Fleet Health Index", () => {
  const root = process.cwd();
  const auditReport = EosUniversalFleetSyncCore.auditFleetHealth(root);

  assert.equal(auditReport.totalProjects, 9);
  assert.ok(auditReport.fleetAverageScore >= 70, `Fleet average score ${auditReport.fleetAverageScore} must be >= 70`);
  assert.equal(auditReport.deploymentAuthorizedQuorum, true);
  assert.ok(auditReport.fleetMerkleRoot.length === 64);

  for (const rep of auditReport.reports) {
    assert.ok(rep.totalScore >= 0 && rep.totalScore <= 100);
    assert.ok(rep.gitHealthScore >= 0 && rep.gitHealthScore <= 25);
    assert.ok(rep.architectureScore >= 0 && rep.architectureScore <= 25);
    assert.ok(rep.securityScore >= 0 && rep.securityScore <= 25);
    assert.ok(rep.productionAvailabilityScore >= 0 && rep.productionAvailabilityScore <= 25);
    assert.ok(["A+", "A", "B", "C", "F"].includes(rep.grade));
    assert.equal(typeof rep.eligibleForAutonomousDeploy, "boolean");
  }
});

test("BDD-1148: SHA-256 Merkle Root Attestation and CLI/MCP Dispatch", () => {
  const root = process.cwd();

  // 1. Merkle folding validation
  const sampleDigests = ["a".repeat(64), "b".repeat(64), "c".repeat(64), "d".repeat(64)];
  const rootHash = EosUniversalFleetSyncCore.computeFleetMerkleRoot(sampleDigests);
  assert.equal(rootHash.length, 64);

  // 2. MCP actions
  const mcpSync = dispatchPhase7FrontierActionExt("fleet_sync_all", { root }, {});
  assert.ok(mcpSync);
  assert.equal(mcpSync.action, "fleet_sync_all");
  assert.equal(mcpSync.totalProjects, 9);
  assert.ok(mcpSync.fleetMerkleRoot.length === 64);

  const mcpAudit = dispatchPhase7FrontierActionExt("fleet_audit_all", { root }, {});
  assert.ok(mcpAudit);
  assert.equal(mcpAudit.action, "fleet_audit_all");
  assert.equal(mcpAudit.totalProjects, 9);
  assert.ok(mcpAudit.fleetAverageScore >= 70);

  // 3. CLI command execution
  const cliSyncJson = execSync("node bin/eos.mjs fleet:sync-all --json", {
    cwd: root,
    encoding: "utf-8",
  });
  const parsedSync = JSON.parse(cliSyncJson);
  assert.equal(parsedSync.totalProjects, 9);
  assert.ok(parsedSync.fleetMerkleRoot);

  const cliAuditJson = execSync("node bin/eos.mjs fleet:audit-all --json", {
    cwd: root,
    encoding: "utf-8",
  });
  const parsedAudit = JSON.parse(cliAuditJson);
  assert.equal(parsedAudit.totalProjects, 9);
  assert.ok(parsedAudit.fleetAverageScore >= 70);
});
