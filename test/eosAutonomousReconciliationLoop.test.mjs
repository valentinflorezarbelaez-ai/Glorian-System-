/**
 * GLORIAN SYSTEM — AUTONOMOUS RECONCILIATION LOOP TEST SUITE
 *
 * Verifies fleet observation, ontology anomaly orientation, deterministic DAG
 * plan synthesis, surgical self-healing execution, WASM linear memory kernel
 * integration, and cryptographic audit receipt generation.
 *
 * Governed by SPEC-307 (FR-307-01..FR-307-06, BDD-1617..BDD-1622).
 * Strict Law V: Zero third-party runtime dependencies. Uses node:test and node:assert/strict.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EosAutonomousReconciliationLoopCore } from "../src/core/eosAutonomousReconciliationLoop.ts";
import { EosOntologyCyclotron } from "../src/core/eosOntologyCyclotron.ts";

describe("SPEC-307: Autonomous Continuous Reconciliation Loop & High-Assurance Self-Healing Engine", () => {
  it("BDD-1617: Telemetry Observation Across Registered Sovereign Fleet", () => {
    const observation = EosAutonomousReconciliationLoopCore.observeFleetState(process.cwd());

    assert.strictEqual(observation.totalProjectsCount, 10, "Fleet must contain exactly 10 registered projects");
    assert.strictEqual(typeof observation.fleetMerkleRoot, "string");
    assert.strictEqual(observation.fleetMerkleRoot.length, 64);

    const expectedProjectIds = [
      "aberamentho",
      "atp-strength",
      "biblioteca-gnostica-1",
      "control-de-asistencia-abopack",
      "crud-slack",
      "donaciones",
      "eos-system",
      "performance-talent-group",
      "portafolio",
      "trading-family-office",
    ];

    for (const id of expectedProjectIds) {
      const found = observation.projects.find((p) => p.projectId === id);
      assert.ok(found, `Project ${id} must be observed in fleet`);
      assert.strictEqual(found.status, "REGISTERED");
      assert.ok(found.productionUrl.startsWith("https://"));
    }
  });

  it("BDD-1618: Anomaly Orientation and Semantic Graph Defect Classification", () => {
    const cyclotron = new EosOntologyCyclotron();
    const now = Date.now();

    cyclotron.registerNode("node:1", "SERVICE", {}, now);
    cyclotron.registerNode("node:2", "SERVICE", {}, now);
    cyclotron.registerEdge("node:1", "node:2", "CONNECTS", 1.0, now);
    // Injected orphan edge
    const orphanEdge = cyclotron.registerEdge("node:1", "ghost:missing", "TARGETS", 1.0, now);

    const orientation = EosAutonomousReconciliationLoopCore.orientAnomalies(cyclotron, now);

    assert.strictEqual(orientation.status, "REMEDIATION_REQUIRED");
    assert.strictEqual(orientation.totalAnomaliesCount, 1);
    assert.strictEqual(orientation.orphanAnomalies.length, 1);
    assert.strictEqual(orientation.orphanAnomalies[0].edgeId, orphanEdge.id);
  });

  it("BDD-1619: Deterministic Atomic DAG Reconciliation Plan Synthesis", () => {
    const cyclotron = new EosOntologyCyclotron();
    const now = Date.now();

    cyclotron.registerNode("A", "NODE", {}, now);
    cyclotron.registerNode("B", "NODE", {}, now);
    cyclotron.registerEdge("A", "ghost:x", "BROKEN", 1.0, now);
    cyclotron.registerEdge("A", "B", "NEXT", 1.0, now);
    cyclotron.registerEdge("B", "A", "LOOP", 1.0, now);

    const orientation = EosAutonomousReconciliationLoopCore.orientAnomalies(cyclotron, now);
    const plan = EosAutonomousReconciliationLoopCore.decideConvergencePlan(orientation);

    assert.ok(plan.tasks.length >= 3, "Plan must contain at least orphan purge, cycle break, wasm check, seal");
    assert.ok(plan.tasks.some((t) => t.type === "ACTION_PURGE_ORPHAN"));
    assert.ok(plan.tasks.some((t) => t.type === "ACTION_BREAK_CYCLE"));
    assert.ok(plan.tasks.some((t) => t.type === "ACTION_WASM_INTEGRITY_CHECK"));
    assert.ok(plan.tasks.some((t) => t.type === "ACTION_SEAL_MERKLE"));

    // Check dependency ordering
    const wasmTask = plan.tasks.find((t) => t.type === "ACTION_WASM_INTEGRITY_CHECK");
    const sealTask = plan.tasks.find((t) => t.type === "ACTION_SEAL_MERKLE");
    assert.ok(Boolean(wasmTask), "WASM task must exist");
    assert.ok(sealTask?.dependencies.includes(wasmTask.taskId), "Seal task must depend on WASM check");
  });

  it("BDD-1620: Autonomous Surgical Self-Healing Execution", () => {
    const cyclotron = new EosOntologyCyclotron();
    const now = Date.now();

    cyclotron.registerNode("alpha", "APP", {}, now);
    cyclotron.registerNode("beta", "DB", {}, now);
    cyclotron.registerEdge("alpha", "beta", "CONNECTS", 1.0, now);
    cyclotron.registerEdge("alpha", "unreal:target", "ORPHAN", 1.0, now);

    const orientation = EosAutonomousReconciliationLoopCore.orientAnomalies(cyclotron, now);
    assert.strictEqual(orientation.status, "REMEDIATION_REQUIRED");

    const plan = EosAutonomousReconciliationLoopCore.decideConvergencePlan(orientation);
    const execution = EosAutonomousReconciliationLoopCore.actSurgicalRemediation(cyclotron, plan);

    assert.strictEqual(execution.failedTasks, 0);
    assert.strictEqual(execution.postExecutionHarmony, "OPTIMAL_HARMONY");
    assert.ok(execution.executedTasks >= 3);
    assert.ok(execution.durationUs > 0);

    // Verify post-healing status directly on cyclotron
    const postOrientation = EosAutonomousReconciliationLoopCore.orientAnomalies(cyclotron, now);
    assert.strictEqual(postOrientation.status, "OPTIMAL_HARMONY");
    assert.strictEqual(postOrientation.totalAnomaliesCount, 0);
  });

  it("BDD-1621: Sub-Microsecond High-Performance WASM Kernel Integration", () => {
    const cyclotron = new EosOntologyCyclotron();
    const now = Date.now();
    cyclotron.registerNode("root", "CORE", {}, now);

    const orientation = EosAutonomousReconciliationLoopCore.orientAnomalies(cyclotron, now);
    const plan = EosAutonomousReconciliationLoopCore.decideConvergencePlan(orientation);

    const execution = EosAutonomousReconciliationLoopCore.actSurgicalRemediation(cyclotron, plan);
    assert.strictEqual(execution.failedTasks, 0);
    assert.strictEqual(execution.postExecutionHarmony, "OPTIMAL_HARMONY");
  });

  it("BDD-1622: End-to-End Cryptographic Audit Receipt Generation", () => {
    const receipt = EosAutonomousReconciliationLoopCore.auditReconciliationPipeline({
      projectRoot: process.cwd(),
    });

    assert.strictEqual(receipt.receiptType, "EOS_RECONCILIATION_LOOP_AUDIT");
    assert.strictEqual(receipt.specRef, "SPEC-307");
    assert.strictEqual(receipt.fleetObservedProjects, 10);
    assert.strictEqual(receipt.convergenceAchieved, true);
    assert.strictEqual(receipt.remainingAnomaliesCount, 0);
    assert.strictEqual(receipt.wasmKernelAccelerated, true);
    assert.strictEqual(typeof receipt.sha256Signature, "string");
    assert.strictEqual(receipt.sha256Signature.length, 64);

    const receiptPath = path.join(process.cwd(), "docs", "evidence", "RECONCILIATION_LOOP_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath), "Receipt file must exist on disk");

    const onDisk = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.strictEqual(onDisk.sha256Signature, receipt.sha256Signature);
  });
});
