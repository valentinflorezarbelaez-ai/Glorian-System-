/**
 * @file eosAgentSwarmMicroKernel.test.mjs
 * @description Automated test suite for SPEC-359 / CHANGE-221: Autonomous Self-Assembling Agent Swarm Micro-Kernel with Raft/Paxos Formal Leadership & Dynamic Capability Mesh.
 *
 * Verifies BDD-1933 through BDD-1938:
 * - BDD-1933: Transición de Seguidor a Candidato y Solicitud de Votos Raft
 * - BDD-1934: Concesión de Quórum Mayoritario y Coronación de Líder Único
 * - BDD-1935: Degradación Inmediata ante Detección de Término Superior (Anti-Split-Brain)
 * - BDD-1936: Mapeo Dinámico de Capacidades y Adjudicación de Roles Especializados
 * - BDD-1937: Replicación Atómica de Comandos y Consenso de Quórum
 * - BDD-1938: Benchmark de Throughput de Consenso y Recibo Formal de Auditoría
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import {
  EosRaftConsensusEngine,
  EosSwarmCapabilityMesh,
  EosSwarmMicroKernelCore,
} from "../src/core/eosAgentSwarmMicroKernel.ts";

function createAgents(count = 5) {
  const agents = [];
  const roles = [
    ["ARCH", "TLA_SPEC", "OPENSPEC_DESIGN"],
    ["SECRET_SCAN", "OWASP_AUDIT", "SLSA_PROVENANCE"],
    ["BDD_TEST", "UNIT_TEST", "FUZZING"],
    ["PERF_AUDIT", "SIMD_BENCH", "LATENCY_PROFILE"],
    ["LINT", "TYPECHECK", "HYGIENE_GOVERNOR"],
  ];
  for (let i = 0; i < count; i++) {
    agents.push({
      agentId: `node-${i}`,
      skills: roles[i % roles.length],
      computeWeight: 10 - i,
      reliabilityScore: 0.99 - i * 0.01,
    });
  }
  return agents;
}

test("BDD-1933: Transición de Seguidor a Candidato y Solicitud de Votos Raft", () => {
  const caps = createAgents(5);
  const engine = new EosRaftConsensusEngine(caps);

  assert.equal(engine.getNodes().length, 5);
  assert.equal(engine.getQuorum(), 3);
  assert.equal(engine.getLeaderId(), null);

  for (const n of engine.getNodes()) {
    assert.equal(n.role, "FOLLOWER");
    assert.equal(n.currentTerm, 0);
    assert.equal(n.votedFor, null);
  }

  // Node-0 initiates election
  const elected = engine.triggerElection("node-0");
  assert.equal(elected, true);

  const node0 = engine.getNode("node-0");
  assert.equal(node0?.currentTerm, 1);
  assert.equal(node0?.votedFor, "node-0");
});

test("BDD-1934: Concesión de Quórum Mayoritario y Coronación de Líder Único", () => {
  const caps = createAgents(5);
  const engine = new EosRaftConsensusEngine(caps);

  const elected = engine.triggerElection("node-2");
  assert.equal(elected, true);
  assert.equal(engine.getLeaderId(), "node-2");

  const leader = engine.getNode("node-2");
  assert.equal(leader?.role, "LEADER");
  assert.equal(leader?.currentTerm, 1);

  // Other nodes remain followers at term 1
  for (const n of engine.getNodes()) {
    if (n.id !== "node-2") {
      assert.equal(n.role, "FOLLOWER");
      assert.equal(n.currentTerm, 1);
    }
  }
});

test("BDD-1935: Degradación Inmediata ante Detección de Término Superior (Anti-Split-Brain)", () => {
  const caps = createAgents(5);
  const engine = new EosRaftConsensusEngine(caps);

  engine.triggerElection("node-0");
  assert.equal(engine.getLeaderId(), "node-0");
  assert.equal(engine.getNode("node-0")?.role, "LEADER");

  // Node-0 receives a message with Term 5 from network partition heal
  engine.handleHigherTerm("node-0", 5);

  const node0 = engine.getNode("node-0");
  assert.equal(node0?.role, "FOLLOWER");
  assert.equal(node0?.currentTerm, 5);
  assert.equal(engine.getLeaderId(), null);
});

test("BDD-1936: Mapeo Dinámico de Capacidades y Adjudicación de Roles Especializados", () => {
  const caps = createAgents(5);
  const engine = new EosRaftConsensusEngine(caps);

  const assignments = EosSwarmCapabilityMesh.assignRoles(engine.getNodes());

  assert.equal(assignments.size, 5);
  assert.equal(assignments.get("node-0"), "LEAD_ARCHITECT");
  assert.equal(assignments.get("node-1"), "SECURITY_GATEKEEPER");
  assert.equal(assignments.get("node-2"), "TEST_SYNTHESIZER");
  assert.equal(assignments.get("node-3"), "BENCHMARK_PROFILER");
  assert.equal(assignments.get("node-4"), "STATIC_AUDITOR");
});

test("BDD-1937: Replicación Atómica de Comandos y Consenso de Quórum", () => {
  const caps = createAgents(5);
  const engine = new EosRaftConsensusEngine(caps);

  // Throws if no leader is elected
  assert.throws(
    () => engine.proposeCommand("MUTATE_CONFIG", { debug: true }),
    /NO_LEADER: Cannot propose command when no leader is elected/,
  );

  engine.triggerElection("node-1");
  const entry = engine.proposeCommand("APPLY_PATCH", { file: "test.ts", lines: 10 });

  assert.equal(entry.index, 1);
  assert.equal(entry.term, 1);
  assert.equal(entry.command, "APPLY_PATCH");
  assert.equal(entry.committed, true);
  assert.equal(engine.getLog().length, 1);
});

test("BDD-1938: Benchmark de Throughput de Consenso y Recibo Formal de Auditoría", () => {
  const bench = EosSwarmMicroKernelCore.runBenchmark(500);

  assert.equal(bench.electionsExecuted, 500);
  assert.ok(bench.consensusThroughputOpsSec > 10000); // Exceeds 10k ops/sec
  assert.ok(bench.avgConvergenceTimeUs > 0);
  assert.equal(bench.splitBrainViolations, 0);

  const receipt = EosSwarmMicroKernelCore.audit(process.cwd());
  assert.equal(receipt.specId, "SPEC-359");
  assert.equal(receipt.changeId, "CHANGE-221");
  assert.equal(receipt.verdict, "CONFORMANT");
  assert.equal(receipt.tlcModelVerified, true);
  assert.equal(receipt.epistemicState, "PRODUCTION_READY_WITHIN_TESTED_SCOPE");

  const receiptPath = resolveEvidencePath("AGENT_SWARM_MICROKERNEL_RECEIPT.json", process.cwd());
  assert.ok(fs.existsSync(receiptPath));
});
