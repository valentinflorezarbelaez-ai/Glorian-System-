/**
 * Unit Test Suite for EosCrossFleetNeuralSynapse
 * Specification: SPEC-120 (IEEE 830 / ISO 29148 / Spotify Fleetshift Model)
 * Acceptance Criteria: BDD-325 to BDD-329
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosCrossFleetNeuralSynapse } from "../src/core/eosCrossFleetNeuralSynapse.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

test("BDD-325: Dynamic Knowledge Ingestion & Pattern Synthesis", () => {
  const synapse = EosCrossFleetNeuralSynapse.getInstance();
  synapse.reset();

  const pattern = synapse.indexPattern({
    id: "ZERO_ALLOC_ARRAY_BUFFER",
    originRepoId: "eos-system",
    category: "PERFORMANCE_OPT",
    title: "Zero-allocation ArrayBuffer memory pool pattern",
    description: "Reuses typed buffers in hot loops to eliminate GC pressure"
  });

  assert.equal(pattern.id, "ZERO_ALLOC_ARRAY_BUFFER");
  assert.equal(pattern.category, "PERFORMANCE_OPT");
  assert.equal(pattern.originRepoId, "eos-system");
  assert.equal(pattern.signatureHash.length, 64);
  assert.ok(pattern.discoveredAt);

  const status = synapse.getStatus();
  assert.equal(status.totalPatternsIndexed, 1);
  assert.equal(status.merkleFleetRootSha256.length, 64);
});

test("BDD-326: Automated Golden Path Propagation Across Registered Fleet", () => {
  const synapse = EosCrossFleetNeuralSynapse.getInstance();
  synapse.reset();

  synapse.indexPattern({
    id: "GOLDEN_PATH_OBSERVABILITY_V2",
    originRepoId: "eos-system",
    category: "GOLDEN_PATH",
    title: "Universal OpenTelemetry Tail-Based Sampling Contract",
    description: "Configures 100% trace capture on anomalies with zero overhead"
  });

  const plan = synapse.propagateGoldenPath("GOLDEN_PATH_OBSERVABILITY_V2");
  assert.ok(plan.planId.startsWith("SYNAPSE-PLAN-"));
  assert.equal(plan.originRepoId, "eos-system");
  assert.equal(plan.totalTargets, 4); // All registered repos except origin 'eos-system'
  assert.equal(plan.synchronizedCount, 4);
  assert.equal(plan.isolatedCount, 0);
  assert.equal(plan.directives.length, 4);
  assert.equal(plan.merkleFleetRootSha256.length, 64);
  assert.equal(plan.sha256Attestation.length, 64);

  // Validate topological order
  for (let i = 0; i < plan.directives.length; i++) {
    assert.equal(plan.directives[i].topologicalOrder, i + 1);
    assert.equal(plan.directives[i].status, "SYNCHRONIZED");
  }
});

test("BDD-327: Contract Incompatibility Isolation & Fail-Closed Protection", () => {
  const synapse = EosCrossFleetNeuralSynapse.getInstance();
  synapse.reset();

  synapse.indexPattern({
    id: "SPECIALIZED_NATIVE_DSP",
    originRepoId: "eos-system",
    category: "PERFORMANCE_OPT",
    title: "AVX-512 DSP Acceleration Kernel",
    description: "Hardware-accelerated audio filtering",
    prerequisites: ["require-not-crud-slack"]
  });

  const plan = synapse.propagateGoldenPath("SPECIALIZED_NATIVE_DSP");
  assert.equal(plan.totalTargets, 4);
  assert.equal(plan.isolatedCount, 1);
  assert.equal(plan.synchronizedCount, 3);

  const isolatedDirective = plan.directives.find((d) => d.targetRepoId === "crud-slack");
  assert.ok(isolatedDirective);
  assert.equal(isolatedDirective.status, "ISOLATED_INCOMPATIBLE");
  assert.ok(isolatedDirective.rationale.includes("isolated fail-closed"));

  // Check custom incompatible target name
  const customPlan = synapse.propagateGoldenPath("SPECIALIZED_NATIVE_DSP", [
    "aberamentho",
    "legacy-incompatible-service"
  ]);
  assert.equal(customPlan.isolatedCount, 1);
  assert.equal(customPlan.synchronizedCount, 1);
  assert.equal(customPlan.directives[1].status, "ISOLATED_INCOMPATIBLE");
});

test("BDD-328: Cross-Fleet Merkle Digest & Soundcheck Elevation", () => {
  const synapse = EosCrossFleetNeuralSynapse.getInstance();
  synapse.reset();

  synapse.indexPattern({
    id: "AEROSPACE_ASSERTION_PATTERN",
    originRepoId: "eos-system",
    category: "AEROSPACE_SAFETY",
    title: "NASA JPL Rule 5 Assertion Bound",
    description: "Ensures minimum density of two assertions per function"
  });

  synapse.indexPattern({
    id: "FINOPS_TOKEN_ROUTING",
    originRepoId: "eos-system",
    category: "FINOPS_GOVERNANCE",
    title: "Cognitive Token Routing Gate",
    description: "Prevents tokenmaxxing loops"
  });

  const query = synapse.queryFleetKnowledge();
  assert.equal(query.totalPatterns, 2);
  assert.equal(query.registeredFleetRepos.length, 5);
  assert.equal(query.fleetHealthScoreAverage, 100.0);
  assert.equal(query.patternsByCategory.AEROSPACE_SAFETY, 1);
  assert.equal(query.patternsByCategory.FINOPS_GOVERNANCE, 1);
  assert.equal(query.patternsByCategory.PERFORMANCE_OPT, 0);
  assert.equal(query.merkleFleetRootSha256.length, 64);
  assert.equal(query.sha256Attestation.length, 64);

  // Filtered query
  const filtered = synapse.queryFleetKnowledge("AEROSPACE_SAFETY");
  assert.equal(filtered.totalPatterns, 1);
  assert.equal(filtered.patterns[0].id, "AEROSPACE_ASSERTION_PATTERN");
});

test("BDD-329: MCP Tool Dispatch for Cross-Fleet Neural Synapse", async () => {
  const mcpServer = new EosMcpServer();

  // Test 1: eos_synapse_propagate_golden_path
  const propagateRes = await mcpServer.handleRequest({
    jsonrpc: "2.0",
    id: "test-synapse-1",
    method: "tools/call",
    params: {
      name: "eos_synapse_propagate_golden_path",
      arguments: {
        patternId: "GLOBAL_SOUNDCHECK_GOLDEN_PATH",
        targetRepos: ["portafolio", "crud-slack"]
      }
    }
  });
  assert.equal(propagateRes.error, undefined);
  assert.ok(propagateRes.result);
  const propagateData = JSON.parse(propagateRes.result.content[0].text);
  assert.equal(propagateData.patternId, "GLOBAL_SOUNDCHECK_GOLDEN_PATH");
  assert.equal(propagateData.totalTargets, 2);
  assert.equal(propagateData.synchronizedCount, 2);

  // Test 2: eos_synapse_fleet_knowledge_query
  const queryRes = await mcpServer.handleRequest({
    jsonrpc: "2.0",
    id: "test-synapse-2",
    method: "tools/call",
    params: {
      name: "eos_synapse_fleet_knowledge_query",
      arguments: {}
    }
  });
  assert.equal(queryRes.error, undefined);
  assert.ok(queryRes.result);
  const queryData = JSON.parse(queryRes.result.content[0].text);
  assert.ok(queryData.registeredFleetRepos.includes("eos-system"));
  assert.equal(queryData.fleetHealthScoreAverage, 100.0);

  // Test 3: eos_synapse_mesh_status
  const statusRes = await mcpServer.handleRequest({
    jsonrpc: "2.0",
    id: "test-synapse-3",
    method: "tools/call",
    params: {
      name: "eos_synapse_mesh_status",
      arguments: {}
    }
  });
  assert.equal(statusRes.error, undefined);
  assert.ok(statusRes.result);
  const statusData = JSON.parse(statusRes.result.content[0].text);
  assert.equal(statusData.state, "NOMINAL");
  assert.ok(statusData.merkleFleetRootSha256);
});
