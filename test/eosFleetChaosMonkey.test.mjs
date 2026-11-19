/**
 * @file eosFleetChaosMonkey.test.mjs
 * @description Automated test suite for SPEC-364 / CHANGE-226: Fleet Chaos Monkey & Autonomous FDIR Engine.
 *
 * Verifies BDD-1963 through BDD-1968:
 * - BDD-1963: Multi-Vector Controlled Fault Injection
 * - BDD-1964: Sub-50ms Anomaly Detection Invariant
 * - BDD-1965: Sandboxed Blast-Radius Fault Isolation
 * - BDD-1966: Raft Swarm Autonomous Remediation & Healing
 * - BDD-1967: Sub-500ms Quantitative MTTR Certification
 * - BDD-1968: Full Diagnostic Audit & Fleet Resilience Receipt
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { EosFleetChaosMonkey, REGISTERED_FLEET_REPOS } from "../src/core/eosFleetChaosMonkey.ts";

test("BDD-1963: Multi-Vector Controlled Fault Injection", async () => {
  const monkey = new EosFleetChaosMonkey();
  assert.equal(monkey.getRepoState("eos-system"), "HEALTHY");

  const vectors = [
    "CORRUPTED_AST",
    "BROKEN_MERKLE_ROOT",
    "SPLIT_BRAIN_RAFT_PARTITION",
    "BUFFER_SATURATION_SPIKE",
    "DRIFTED_OPENSPEC",
    "LATENCY_INJECTION",
  ];

  for (const vector of vectors) {
    const experiment = await monkey.executeFdirExperiment({
      targetRepo: "eos-system",
      vector,
    });

    assert.ok(experiment.experimentId.startsWith("EXP-CHAOS-"));
    assert.equal(experiment.vector, vector);
    assert.equal(experiment.targetRepo, "eos-system");
    assert.equal(experiment.preSnapshotDigest.length, 64);
    assert.equal(experiment.postRecoveryDigest.length, 64);
    assert.equal(experiment.fdirState, "RECOVERED");
  }
});

test("BDD-1964: Sub-50ms Anomaly Detection Invariant", async () => {
  const monkey = new EosFleetChaosMonkey();

  const experiment = await monkey.executeFdirExperiment({
    targetRepo: "portafolio",
    vector: "BROKEN_MERKLE_ROOT",
  });

  assert.ok(
    experiment.detectionLatencyMs < 50,
    `Detection latency ${experiment.detectionLatencyMs}ms must be strictly < 50ms`,
  );
  assert.ok(experiment.detectedAt >= experiment.injectedAt);
});

test("BDD-1965: Sandboxed Blast-Radius Fault Isolation", async () => {
  const monkey = new EosFleetChaosMonkey();

  const otherRepo = "aberamentho";
  assert.equal(monkey.getRepoState(otherRepo), "HEALTHY");

  const experiment = await monkey.executeFdirExperiment({
    targetRepo: "crud-slack",
    vector: "SPLIT_BRAIN_RAFT_PARTITION",
  });

  assert.ok(
    experiment.isolationLatencyMs < 100,
    `Isolation latency ${experiment.isolationLatencyMs}ms must be < 100ms`,
  );
  assert.equal(monkey.getRepoState(otherRepo), "HEALTHY");
  assert.equal(monkey.getRepoState("crud-slack"), "HEALTHY");
});

test("BDD-1966: Raft Swarm Autonomous Remediation & Healing", async () => {
  const monkey = new EosFleetChaosMonkey();

  const experiment = await monkey.executeFdirExperiment({
    targetRepo: "biblioteca-gnostica-1",
    vector: "CORRUPTED_AST",
  });

  assert.equal(experiment.fdirState, "RECOVERED");
  assert.ok(experiment.recoveryLatencyMs > 0);
  assert.ok(experiment.postRecoveryDigest !== experiment.preSnapshotDigest);
  assert.equal(monkey.getRepoState("biblioteca-gnostica-1"), "HEALTHY");
});

test("BDD-1967: Sub-500ms Quantitative MTTR Certification across Fleet", async () => {
  const monkey = new EosFleetChaosMonkey();
  const benchmark = await monkey.runFleetBenchmark(1);

  assert.equal(benchmark.totalExperiments, REGISTERED_FLEET_REPOS.length);
  assert.equal(benchmark.successfulRecoveries, REGISTERED_FLEET_REPOS.length);
  assert.ok(benchmark.averageMttrMs < 500, `Average MTTR ${benchmark.averageMttrMs}ms must be strictly < 500ms`);
  assert.equal(benchmark.mttrTargetConforming, true);
  assert.equal(benchmark.evaluatedRepos.length, 9);
  assert.equal(benchmark.integrityHash.length, 64);
});

test("BDD-1968: Full Diagnostic Audit & Fleet Resilience Receipt", async () => {
  const receipt = await EosFleetChaosMonkey.audit();

  assert.equal(receipt.specId, "SPEC-364");
  assert.equal(receipt.changeId, "CHANGE-226");
  assert.equal(receipt.fleetRepositoriesCount, 9);
  assert.ok(receipt.certifiedAverageMttrMs < 500);
  assert.equal(receipt.checks.multiVectorFaultInjection, "PASS");
  assert.equal(receipt.checks.sub50msAnomalyDetection, "PASS");
  assert.equal(receipt.checks.sandboxedBlastRadiusIsolation, "PASS");
  assert.equal(receipt.checks.raftSwarmRemediation, "PASS");
  assert.equal(receipt.checks.sub500msMttrCertification, "PASS");
  assert.equal(receipt.checks.zeroDependencyPurity, "PASS");
  assert.equal(receipt.integrityHash.length, 64);
});
