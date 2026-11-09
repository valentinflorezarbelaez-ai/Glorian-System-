/**
 * Unit Test Suite for EosPlanetaryMonorepoGovernor
 * Specification: SPEC-119 (IEEE 830 / ISO 29148 / NASA JPL Power of Ten / Google Rosie)
 * Acceptance Criteria: BDD-320 to BDD-324
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosPlanetaryMonorepoGovernor } from "../src/core/eosPlanetaryMonorepoGovernor.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

test("BDD-320: Virtual Sparse Projection of Transitive Monorepo Closure", () => {
  const governor = EosPlanetaryMonorepoGovernor.getInstance();
  governor.reset();

  // Create virtual monorepo of 100 nodes
  const nodes = [];
  for (let i = 0; i < 100; i++) {
    nodes.push({
      id: `node-${i}`,
      path: `packages/pkg-${i}/index.ts`,
      dependencies: [],
    });
  }

  // Chain: target -> dep1 -> dep2
  nodes[0].dependencies = [nodes[1].path];
  nodes[1].dependencies = [nodes[2].path];

  const result = governor.projectSparseClosure(nodes[0].path, nodes);
  assert.equal(result.totalMonorepoNodes, 100);
  assert.equal(result.projectedNodesCount, 3);
  assert.ok(result.pruningRatioPercent >= 95.0, "Pruning ratio should exceed 95%");
  assert.equal(result.transitiveClosure.length, 3);
  assert.equal(result.merkleRootSha256.length, 64);
  assert.equal(result.sha256Attestation.length, 64);

  const status = governor.getStatus();
  assert.equal(status.totalProjectionsExecuted, 1);
});

test("BDD-321: NASA/JPL Power of Ten Safety-Critical Static Compliance Audit", () => {
  const governor = EosPlanetaryMonorepoGovernor.getInstance();
  governor.reset();

  // 1. Aerospace flight-ready code: bounded loops, assertions, simple flow
  const flightReadyCode = `
export function computeTrajectory(t: number): number {
  if (t < 0) throw new Error("Invalid time");
  let velocity = 0;
  for (let i = 0; i < 100; i++) {
    velocity += i * 0.1;
  }
  if (velocity <= 0) throw new Error("Zero velocity");
  return velocity;
}`;

  const passResult = governor.auditJplPowerOfTen(flightReadyCode);
  assert.equal(passResult.certifiedFlightReady, true);
  assert.equal(passResult.verdict, "JPL_CERTIFIED_FLIGHT_READY");
  assert.equal(passResult.sha256Attestation.length, 64);

  // 2. Code with unbounded infinite loop: fails JPL Rule 2
  const unboundedLoopCode = `
export function runWorker() {
  while (true) {
    doWork();
  }
}`;

  const failResult = governor.auditJplPowerOfTen(unboundedLoopCode);
  assert.equal(failResult.certifiedFlightReady, false);
  assert.equal(failResult.verdict, "FAIL_UNBOUNDED_LOOP_DETECTED");
  assert.ok(failResult.findings.some((f) => f.rule === 2));
});

test("BDD-322: Large-Scale Codemod Sharding and Topological Blast Radius Ordering", () => {
  const governor = EosPlanetaryMonorepoGovernor.getInstance();
  governor.reset();

  const packages = [
    { id: "pkg-core", dependencies: [] },
    { id: "pkg-mid", dependencies: ["pkg-core"] },
    { id: "pkg-leaf", dependencies: ["pkg-mid"] },
  ];

  const plan = governor.generateRosieCodemodPlan(packages);
  assert.equal(plan.totalPackagesAffected, 3);
  assert.equal(plan.totalShards, 3);
  assert.equal(plan.shards[0].topologicalDepth, 0);
  assert.deepEqual(plan.shards[0].packagesAffected, ["pkg-core"]);
  assert.equal(plan.shards[1].topologicalDepth, 1);
  assert.deepEqual(plan.shards[1].packagesAffected, ["pkg-mid"]);
  assert.equal(plan.shards[2].topologicalDepth, 2);
  assert.deepEqual(plan.shards[2].packagesAffected, ["pkg-leaf"]);
  assert.equal(plan.sha256Attestation.length, 64);
});

test("BDD-323: Triple Modular Redundancy (TMR) 2-of-3 Byzantine Consensus Adjudication", () => {
  const governor = EosPlanetaryMonorepoGovernor.getInstance();
  governor.reset();

  // 1. Quorum approval: 2 voters agree on assertionHash "hash-alpha"
  const approvedVotes = [
    { modelId: "claude-3-7-sonnet", approved: true, assertionHash: "hash-alpha", rationale: "Proof sound." },
    { modelId: "gemini-2.5-pro", approved: true, assertionHash: "hash-alpha", rationale: "Invariant verified." },
    { modelId: "gpt-4o", approved: false, assertionHash: "hash-beta", rationale: "Divergence." },
  ];
  const quorumResult = governor.adjudicateTmrConsensus(approvedVotes);
  assert.equal(quorumResult.quorumApproved, true);
  assert.equal(quorumResult.verdict, "TMR_QUORUM_APPROVED");
  assert.equal(quorumResult.agreeingVotesCount, 2);
  assert.equal(quorumResult.winningAssertionHash, "hash-alpha");
  assert.equal(quorumResult.sha256Attestation.length, 64);

  // 2. Byzantine split rejection: 3 split decisions
  const splitVotes = [
    { modelId: "claude-3-7-sonnet", approved: true, assertionHash: "hash-1", rationale: "R1" },
    { modelId: "gemini-2.5-pro", approved: true, assertionHash: "hash-2", rationale: "R2" },
    { modelId: "gpt-4o", approved: false, assertionHash: "hash-3", rationale: "R3" },
  ];
  const splitResult = governor.adjudicateTmrConsensus(splitVotes);
  assert.equal(splitResult.quorumApproved, false);
  assert.equal(splitResult.verdict, "TMR_BYZANTINE_SPLIT_REJECTED");
});

test("BDD-324: EosMcpServer Integration for Planetary Monorepo and Aerospace Tools", async () => {
  const server = new EosMcpServer(process.cwd());

  // 1. Test eos_planetary_sparse_project
  const sparseReq = {
    jsonrpc: "2.0",
    id: "test-monorepo-1",
    method: "tools/call",
    params: {
      name: "eos_planetary_sparse_project",
      arguments: {
        targetFile: "src/core/index.ts",
        monorepoNodes: [
          { id: "1", path: "src/core/index.ts", dependencies: ["src/core/eosFinOpsBudget.ts"] },
          { id: "2", path: "src/core/eosFinOpsBudget.ts", dependencies: [] },
        ],
      },
    },
  };
  const sparseRes = await server.handleRequest(sparseReq);
  assert.equal(sparseRes.error, undefined);
  assert.ok(sparseRes.result);
  const sparseData = JSON.parse(sparseRes.result.content[0].text);
  assert.equal(sparseData.projectedNodesCount, 2);
  assert.equal(sparseData.sha256Attestation.length, 64);

  // 2. Test eos_jpl_power_of_ten_audit
  const jplReq = {
    jsonrpc: "2.0",
    id: "test-monorepo-2",
    method: "tools/call",
    params: {
      name: "eos_jpl_power_of_ten_audit",
      arguments: {
        sourceCode:
          "function test() { for(let i=0;i<10;i++){} if(x) throw new Error(); if(y) throw new Error(); return 1; }",
      },
    },
  };
  const jplRes = await server.handleRequest(jplReq);
  assert.equal(jplRes.error, undefined);
  assert.ok(jplRes.result);
  const jplData = JSON.parse(jplRes.result.content[0].text);
  assert.equal(jplData.certifiedFlightReady, true);
  assert.equal(jplData.verdict, "JPL_CERTIFIED_FLIGHT_READY");

  // 3. Test eos_tmr_consensus_adjudicate
  const tmrReq = {
    jsonrpc: "2.0",
    id: "test-monorepo-3",
    method: "tools/call",
    params: {
      name: "eos_tmr_consensus_adjudicate",
      arguments: {
        votes: [
          { modelId: "modelA", approved: true, assertionHash: "H1", rationale: "OK" },
          { modelId: "modelB", approved: true, assertionHash: "H1", rationale: "OK" },
          { modelId: "modelC", approved: false, assertionHash: "H2", rationale: "NO" },
        ],
      },
    },
  };
  const tmrRes = await server.handleRequest(tmrReq);
  assert.equal(tmrRes.error, undefined);
  assert.ok(tmrRes.result);
  const tmrData = JSON.parse(tmrRes.result.content[0].text);
  assert.equal(tmrData.quorumApproved, true);
  assert.equal(tmrData.verdict, "TMR_QUORUM_APPROVED");
});
