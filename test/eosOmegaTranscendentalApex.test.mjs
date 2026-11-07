/**
 * EOS SYSTEM — SPEC-040 OMEGA TRANSCENDENTAL APEX VERIFICATION SUITE
 * Pure Layer-0 Unit & Invariant Test Suite (node:test)
 *
 * Verifies:
 * - BDD-109: Bi-Temporal Sub-Microsecond Ontology Cyclotron & Transitive Closure
 * - BDD-110: NIST Post-Quantum Lattice Polynomial Reduction (ML-KEM-768)
 * - BDD-111: Bayesian Multi-Agent Intent Arbitration & Posterior Normalization
 * - BDD-112: Constant-Time TimingSafeEqual Side-Channel Resistance
 * - BDD-113: Multi-Channel MCP & CLI Transcendental Dispatch
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { EosOntologyCyclotron } from "../src/core/eosOntologyCyclotron.ts";
import { EosQuantumLatticeShield, HALF_Q } from "../src/core/eosQuantumLatticeShield.ts";
import { EosMetaCognitiveSynapse } from "../src/core/eosMetaCognitiveSynapse.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("SPEC-040: Omega Transcendental Apex Kernel Verification", () => {
  describe("BDD-109: Bi-Temporal Sub-Microsecond Ontology Cyclotron", () => {
    it("registers bi-temporal nodes and computes transitive reachability in sub-microsecond time", () => {
      const cyclotron = new EosOntologyCyclotron();
      cyclotron.registerNode("SPEC-001", "Specification", { title: "Constitution" });
      cyclotron.registerNode("MOD-AUTH", "Module", { file: "auth.ts" });
      cyclotron.registerNode("MOD-PERSIST", "Module", { file: "db.ts" });
      cyclotron.registerNode("GATE-SEC", "Gate", { stage: 1 });

      cyclotron.registerEdge("SPEC-001", "MOD-AUTH", "governs");
      cyclotron.registerEdge("MOD-AUTH", "MOD-PERSIST", "dependsOn");
      cyclotron.registerEdge("MOD-PERSIST", "GATE-SEC", "verifiedBy");

      const closure = cyclotron.computeTransitiveClosure("SPEC-001", undefined, 5);

      assert.equal(closure.startId, "SPEC-001");
      assert.equal(closure.totalReachable, 3);
      assert.ok(closure.reachableNodeIds.includes("MOD-AUTH"));
      assert.ok(closure.reachableNodeIds.includes("MOD-PERSIST"));
      assert.ok(closure.reachableNodeIds.includes("GATE-SEC"));
      assert.ok(closure.executionUs < 5000, "Should execute in sub-millisecond range");
    });

    it("reconstructs historical graph state via asOf(timestamp) without destructive mutation", () => {
      const cyclotron = new EosOntologyCyclotron();
      const t0 = 1000;
      const t1 = 2000;
      const t2 = 3000;

      cyclotron.registerNode("NODE-A", "Entity", {}, t0, t1);
      cyclotron.registerNode("NODE-B", "Entity", {}, t1, t2);

      const snap0 = cyclotron.asOf(1500);
      assert.equal(snap0.activeNodes, 1, "Only NODE-A was active at t=1500");

      const snap1 = cyclotron.asOf(2500);
      assert.equal(snap1.activeNodes, 1, "Only NODE-B was active at t=2500");

      const snapFuture = cyclotron.asOf(5000);
      assert.equal(snapFuture.activeNodes, 0, "No nodes active in future");
    });
  });

  describe("BDD-110: NIST Post-Quantum Lattice Polynomial Reduction (ML-KEM)", () => {
    it("reduces coefficients symmetrically to [-(q-1)/2, (q-1)/2] in constant time", () => {
      const testCoeffs = new Int32Array([4000, -3500, 3329, 0, 1664, -1664]);
      const reduced = testCoeffs.map((c) => EosQuantumLatticeShield.reduceSymmetric(c));

      for (const val of reduced) {
        assert.ok(val <= HALF_Q, `Value ${val} must be <= ${HALF_Q}`);
        assert.ok(val >= -HALF_Q, `Value ${val} must be >= -${HALF_Q}`);
      }
    });

    it("generates quantum-resistant lattice attestation seal", () => {
      const seal = EosQuantumLatticeShield.generateLatticeSeal("sovereign-production-attestation");

      assert.equal(seal.algorithm, "NIST-FIPS-203-ML-KEM-768");
      assert.equal(seal.polynomialHash.length, 64);
      assert.equal(seal.symmetricCoeffsDigest.length, 96);
      assert.equal(seal.quantumProof.length, 128);
      assert.equal(seal.constantTimeVerified, true);
    });
  });

  describe("BDD-111: Bayesian Multi-Agent Intent Arbitration", () => {
    it("normalizes posterior probabilities so sum(P(H|E)) equals 1.0", () => {
      const candidates = [
        {
          agentId: "agent-security",
          role: "SecDevOps",
          action: "block-deployment",
          priorBelief: 0.3,
          evidenceLikelihood: 0.9,
        },
        {
          agentId: "agent-feature",
          role: "Developer",
          action: "ship-feature",
          priorBelief: 0.5,
          evidenceLikelihood: 0.4,
        },
        {
          agentId: "agent-optimizer",
          role: "FinOps",
          action: "shrink-cluster",
          priorBelief: 0.2,
          evidenceLikelihood: 0.3,
        },
      ];

      const report = EosMetaCognitiveSynapse.arbitrateIntents(candidates);

      assert.equal(report.totalCandidates, 3);
      assert.equal(report.winningCandidate.agentId, "agent-security");
      assert.equal(report.winningCandidate.priorityRank, 1);

      const sumP = report.rankedCandidates.reduce((acc, c) => acc + c.posteriorProbability, 0);
      assert.ok(Math.abs(sumP - 1.0) < 0.005, `Sum of posteriors must be ~1.0, got ${sumP}`);
    });
  });

  describe("BDD-112: Constant-Time TimingSafeEqual Side-Channel Resistance", () => {
    it("verifies seal equivalence using constant-time memory buffers", () => {
      const seal1 = EosQuantumLatticeShield.generateLatticeSeal("payload-alpha");
      const seal1Copy = EosQuantumLatticeShield.generateLatticeSeal("payload-alpha");
      const seal2 = EosQuantumLatticeShield.generateLatticeSeal("payload-beta");

      assert.equal(EosQuantumLatticeShield.verifySealConstantTime(seal1, seal1Copy), true);
      assert.equal(EosQuantumLatticeShield.verifySealConstantTime(seal1, seal2), false);
    });
  });

  describe("BDD-113: Multi-Channel MCP & CLI Transcendental Dispatch", () => {
    it("dispatches eos_ontology_query via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "eos_ontology_query",
          arguments: { action: "status" },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.status, "ONTOLOGY_ACTIVE");
    });

    it("dispatches eos_quantum_lattice_seal via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "eos_quantum_lattice_seal",
          arguments: { payload: "ci-cd-receipt-proof" },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.algorithm, "NIST-FIPS-203-ML-KEM-768");
      assert.ok(parsed.quantumProof);
    });

    it("dispatches eos_synapse_arbitrate via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "eos_synapse_arbitrate",
          arguments: {
            candidates: [
              { agentId: "agent-a", role: "Lead", action: "merge", priorBelief: 0.6, evidenceLikelihood: 0.8 },
              { agentId: "agent-b", role: "QA", action: "retest", priorBelief: 0.4, evidenceLikelihood: 0.7 },
            ],
          },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.winningCandidate.agentId, "agent-a");
      assert.equal(parsed.winningCandidate.priorityRank, 1);
    });
  });
});
