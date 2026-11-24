/**
 * GLORIAN SYSTEM — FDIR CLINICAL FIREWALL FOR KNOWLEDGE ONTOLOGY TEST SUITE
 *
 * Verifies bi-temporal semantic graph integrity scanning, orphan link detection and quarantine isolation,
 * autonomous surgical purging ("La Sanación del Grafo"), Tarjan's SCC cycle isolation,
 * 24/7 EosSentinelDaemon heartbeat integration, and cryptographic audit receipts.
 *
 * Governed by SPEC-305 (FR-305-01..FR-305-06, BDD-1605..BDD-1610).
 * Strict Law V: Zero third-party runtime dependencies. Uses node:test and node:assert/strict.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosFdirOntology } from "../src/core/eosFdirOntology.ts";
import { EosOntologyCyclotron } from "../src/core/eosOntologyCyclotron.ts";
import { EosSentinelDaemon } from "../src/core/eosSentinelDaemon.ts";

describe("SPEC-305: FDIR Clinical Firewall for Knowledge Ontology & Sentinel Integration", () => {
  it("BDD-1605: Bi-temporal Knowledge Graph Integrity Scan", () => {
    const cyclotron = new EosOntologyCyclotron();
    const now = Date.now();

    cyclotron.registerNode("srv:control-plane", "CORE_SERVICE", { name: "Control Plane" }, now);
    cyclotron.registerNode("srv:database", "STORAGE_SERVICE", { name: "Database" }, now);
    cyclotron.registerEdge("srv:control-plane", "srv:database", "PERSISTS_TO", 1.0, now);

    const report = EosFdirOntology.scanGraphIntegrity(cyclotron, now);

    assert.strictEqual(report.status, "OPTIMAL_HARMONY");
    assert.strictEqual(report.totalNodes, 2);
    assert.strictEqual(report.totalEdges, 1);
    assert.strictEqual(report.orphanLinksCount, 0);
    assert.strictEqual(report.cyclesCount, 0);
  });

  it("BDD-1606: Orphan Link Detection and Quarantine Isolation", () => {
    const cyclotron = new EosOntologyCyclotron();
    const now = Date.now();

    cyclotron.registerNode("srv:active-gateway", "GATEWAY", { name: "Active Gateway" }, now);
    // Register edge pointing to a non-existent ghost service
    const orphanEdge = cyclotron.registerEdge("srv:active-gateway", "srv:ghost-microvm", "ROUTES_TO", 1.0, now);

    const report = EosFdirOntology.scanGraphIntegrity(cyclotron, now);

    assert.strictEqual(report.status, "REMEDIATION_REQUIRED");
    assert.strictEqual(report.orphanLinksCount, 1);
    assert.strictEqual(report.orphanAnomalies.length, 1);
    assert.strictEqual(report.orphanAnomalies[0].edgeId, orphanEdge.id);
    assert.strictEqual(report.orphanAnomalies[0].reason, "ORPHAN_TARGET_NODE");
  });

  it("BDD-1607: Autonomous Surgical Purging and Relational Restitution", () => {
    const cyclotron = new EosOntologyCyclotron();
    const now = Date.now();

    cyclotron.registerNode("srv:alpha", "SERVICE", {}, now);
    cyclotron.registerNode("srv:beta", "SERVICE", {}, now);
    cyclotron.registerEdge("srv:alpha", "srv:beta", "CONNECTS", 1.0, now);
    const danglingEdge = cyclotron.registerEdge("srv:alpha", "srv:deleted-node", "DEPENDS", 1.0, now);

    // Initial check detects 1 orphan
    const preScan = EosFdirOntology.scanGraphIntegrity(cyclotron, now);
    assert.strictEqual(preScan.orphanLinksCount, 1);

    // Execute surgical healing
    const healResult = EosFdirOntology.healGraphAnomalies(cyclotron, now);

    assert.strictEqual(healResult.healed, true);
    assert.strictEqual(healResult.purgedEdgesCount, 1);
    assert.strictEqual(healResult.purgedEdgeIds[0], danglingEdge.id);
    assert.strictEqual(healResult.remainingAnomaliesCount, 0);

    // Post-scan verifies restitution
    const postScan = EosFdirOntology.scanGraphIntegrity(cyclotron, now);
    assert.strictEqual(postScan.status, "OPTIMAL_HARMONY");
    assert.strictEqual(postScan.orphanLinksCount, 0);
    assert.strictEqual(postScan.totalEdges, 1, "Only the valid edge remains");
  });

  it("BDD-1608: Tarjan Strongly Connected Components Cyclic Deadlock Detection", () => {
    const cyclotron = new EosOntologyCyclotron();
    const now = Date.now();

    cyclotron.registerNode("node:A", "ACTOR", {}, now);
    cyclotron.registerNode("node:B", "ACTOR", {}, now);
    cyclotron.registerNode("node:C", "ACTOR", {}, now);

    // Create directed cycle: A -> B -> C -> A
    cyclotron.registerEdge("node:A", "node:B", "NEXT", 1.0, now);
    cyclotron.registerEdge("node:B", "node:C", "NEXT", 1.0, now);
    cyclotron.registerEdge("node:C", "node:A", "NEXT", 1.0, now);

    const cycles = EosFdirOntology.detectTarjanCycles(cyclotron, now);

    assert.strictEqual(cycles.length, 1, "Must detect exactly 1 SCC cycle");
    assert.strictEqual(cycles[0].length, 3, "Cycle length must be 3");

    // Heal should break the cycle
    const heal = EosFdirOntology.healGraphAnomalies(cyclotron, now);
    assert.strictEqual(heal.cyclesBrokenCount, 1);

    const postCycles = EosFdirOntology.detectTarjanCycles(cyclotron, now);
    assert.strictEqual(postCycles.length, 0, "All cycles must be eliminated");
  });

  it("BDD-1609: Live Integration with EosSentinelDaemon Heartbeat", () => {
    const cyclotron = new EosOntologyCyclotron();
    const now = Date.now();

    cyclotron.registerNode("daemon:core", "CORE", {}, now);
    cyclotron.registerEdge("daemon:core", "ghost:unreachable", "CONNECTS", 1.0, now);

    const sentinel = new EosSentinelDaemon(process.cwd());

    // When tick is provided with an infected cyclotron
    const pulseReport = sentinel.tick(cyclotron);

    assert.strictEqual(pulseReport.status, "REMEDIATION_REQUIRED");
    assert.ok(pulseReport.fleetHealth.orphanLinksDetected >= 1, "Pulse must register detected orphan links");
    assert.ok(
      pulseReport.anomaliesDetected.some((a) => a.includes("Orphan link detected")),
      "Anomalies list must cite orphan link",
    );

    // Heal cyclotron
    EosFdirOntology.healGraphAnomalies(cyclotron, now);

    // Next tick on healed cyclotron
    const healedPulse = sentinel.tick(cyclotron);
    assert.strictEqual(healedPulse.status, "SENTINEL_PULSE_HEALTHY");
    assert.strictEqual(healedPulse.fleetHealth.orphanLinksDetected, 0);
  });

  it("BDD-1610: End-to-End Cryptographic FDIR Receipt Generation", () => {
    const receipt = EosFdirOntology.auditFdirOntologyPipeline({
      projectRoot: process.cwd(),
    });

    assert.strictEqual(receipt.receiptType, "EOS_FDIR_ONTOLOGY_AUDIT");
    assert.strictEqual(receipt.specRef, "SPEC-305");
    assert.strictEqual(receipt.harmonyRestored, true);
    assert.ok(receipt.totalNodesEvaluated >= 4);
    assert.ok(receipt.orphanLinksPurged >= 1);
    assert.ok(receipt.cyclesResolved >= 1);
    assert.strictEqual(typeof receipt.sha256Signature, "string");
    assert.strictEqual(receipt.sha256Signature.length, 64);

    const receiptPath = resolveEvidencePath("FDIR_ONTOLOGY_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath), "FDIR receipt must exist");

    const onDisk = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.strictEqual(onDisk.receiptType, "EOS_FDIR_ONTOLOGY_AUDIT");
    assert.strictEqual(onDisk.sha256Signature, receipt.sha256Signature);
  });
});
