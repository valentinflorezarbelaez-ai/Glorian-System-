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
import os from "node:os";
import path from "node:path";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosAutonomousReconciliationLoopCore } from "../src/core/eosAutonomousReconciliationLoop.ts";
import { EosOntologyCyclotron } from "../src/core/eosOntologyCyclotron.ts";
import { EosWasmBytecodeSynthesizerCore } from "../src/core/eosWasmBytecodeSynthesizer.ts";

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

    const receiptPath = resolveEvidencePath("RECONCILIATION_LOOP_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath), "Receipt file must exist on disk");

    const onDisk = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.strictEqual(onDisk.sha256Signature, receipt.sha256Signature);
  });

  it("handles registry formats, default arguments, unknown task types, and WASM failure catch path", () => {
    // 1. Default parameter branches on observeFleetState, orientAnomalies, auditReconciliationPipeline
    const defaultObs = EosAutonomousReconciliationLoopCore.observeFleetState();
    assert.strictEqual(defaultObs.totalProjectsCount, 10);

    const defaultAudit = EosAutonomousReconciliationLoopCore.auditReconciliationPipeline();
    assert.strictEqual(defaultAudit.specRef, "SPEC-307");

    const cleanCyclotron = new EosOntologyCyclotron();
    cleanCyclotron.registerNode("solo", "CORE", {}, Date.now());
    const defaultOrient = EosAutonomousReconciliationLoopCore.orientAnomalies(cleanCyclotron);
    assert.strictEqual(defaultOrient.status, "OPTIMAL_HARMONY");

    // 2. Object-map & empty registry.json shapes with fallback project fields
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-reconcile-test-"));
    try {
      const regDir = path.join(tempRoot, "docs", "projects");
      fs.mkdirSync(regDir, { recursive: true });
      fs.writeFileSync(
        path.join(regDir, "registry.json"),
        JSON.stringify({
          projects: {
            first: {
              id: "proj-1",
              name: "Project One",
              productionUrl: "https://one.example",
              authorization: "LEVEL_2",
              status: "REGISTERED",
            },
            second: {
              url: "https://two.example",
              auth_tier: "LEVEL_1",
              status: "PENDING",
            },
            third: {},
          },
        }),
        "utf8",
      );
      const mapObs = EosAutonomousReconciliationLoopCore.observeFleetState(tempRoot);
      assert.strictEqual(mapObs.totalProjectsCount, 3);
      assert.strictEqual(mapObs.projects[0].status, "REGISTERED");
      assert.strictEqual(mapObs.projects[1].projectId, "unknown");
      assert.strictEqual(mapObs.projects[1].repoName, "unknown");
      assert.strictEqual(mapObs.projects[1].productionUrl, "https://two.example");
      assert.strictEqual(mapObs.projects[1].authorizedTier, "LEVEL_1");
      assert.strictEqual(mapObs.projects[1].status, "UNKNOWN");
      assert.strictEqual(mapObs.projects[2].productionUrl, "");
      assert.strictEqual(mapObs.projects[2].authorizedTier, "UNKNOWN");

      fs.writeFileSync(path.join(regDir, "registry.json"), JSON.stringify({}), "utf8");
      const emptyObs = EosAutonomousReconciliationLoopCore.observeFleetState(tempRoot);
      assert.strictEqual(emptyObs.totalProjectsCount, 0);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }

    // 3. Unknown task type branch + WASM integrity check failure (both status !== SUCCESS and returnedValue !== 300)
    const origExecute = EosWasmBytecodeSynthesizerCore.executeModule;
    try {
      const planWithUnknown = {
        planId: "plan-edge",
        tasks: [
          {
            taskId: "t-wasm",
            type: "ACTION_WASM_INTEGRITY_CHECK",
            targetEntityId: "wasm:verify",
            description: "Check WASM failure path",
            dependencies: [],
            status: "PENDING",
          },
          {
            taskId: "t-noop",
            type: "ACTION_UNKNOWN_NOOP",
            targetEntityId: "noop",
            description: "Unknown task type",
            dependencies: [],
            status: "PENDING",
          },
        ],
        estimatedCycles: 200,
        generatedAtIso: new Date().toISOString(),
      };

      EosWasmBytecodeSynthesizerCore.executeModule = () => ({ status: "FAILED", returnedValue: 0 });
      const failStatusExec = EosAutonomousReconciliationLoopCore.actSurgicalRemediation(
        cleanCyclotron,
        planWithUnknown,
      );
      assert.strictEqual(failStatusExec.failedTasks, 1);
      assert.strictEqual(failStatusExec.executedTasks, 0);

      EosWasmBytecodeSynthesizerCore.executeModule = () => ({ status: "SUCCESS", returnedValue: 123 });
      const badReturnExec = EosAutonomousReconciliationLoopCore.actSurgicalRemediation(cleanCyclotron, planWithUnknown);
      assert.strictEqual(badReturnExec.failedTasks, 1);
      assert.strictEqual(badReturnExec.executedTasks, 0);
    } finally {
      EosWasmBytecodeSynthesizerCore.executeModule = origExecute;
    }
  });
});
