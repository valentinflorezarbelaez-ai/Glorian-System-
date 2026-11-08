/**
 * EOS SYSTEM — DEEP MCP TOOL EXECUTION SUITE (SPEC-155 / BDD-280)
 *
 * Verifies end-to-end JSON-RPC 2.0 tools/call dispatch across Phase 1, Phase 2,
 * and Phase 3 core utilitarian tool handlers.
 *
 * Big Tech Standard (Google / Stripe API conformance):
 * Asserts handler correctness, response envelope structure, and zero unhandled exceptions.
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-280: EosMcpServer executes Phase 1 utilitarian tool handlers via tools/call", async () => {
  const server = new EosMcpServer(projectRoot, "full");

  // 1. eos_health_check
  const healthRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "eos_health_check", arguments: {} },
  });
  assert.equal(healthRes.jsonrpc, "2.0");
  assert.ok(healthRes.result?.content?.[0]?.text);
  const healthData = JSON.parse(healthRes.result.content[0].text);
  assert.equal(healthData.status, "HANDLER_ALIVE");

  // 2. eos_amplify_prompt
  const ampRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "eos_amplify_prompt", arguments: { rawPrompt: "Audit security boundaries" } },
  });
  assert.ok(ampRes.result?.content?.[0]?.text);
  const ampData = JSON.parse(ampRes.result.content[0].text);
  assert.ok(ampData.synthesizedUserPrompt || ampData.synthesizedSystemPrompt);

  // 3. eos_evaluate_decision
  const judgeRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "eos_evaluate_decision",
      arguments: { optionA: "Strict gate", optionB: "Lax gate", criteria: ["Security", "Quality"] },
    },
  });
  assert.ok(judgeRes.result?.content?.[0]?.text);

  // 4. eos_check_architecture
  const archRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "eos_check_architecture", arguments: { directory: "src/core" } },
  });
  assert.ok(archRes.result?.content?.[0]?.text);
  const archData = JSON.parse(archRes.result.content[0].text);
  assert.ok(archData.scannedFilesCount > 0);

  // 5. eos_nocturnal_evolution
  const noctRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "eos_nocturnal_evolution", arguments: { dryRun: true } },
  });
  assert.ok(noctRes.result?.content?.[0]?.text);
  const noctData = JSON.parse(noctRes.result.content[0].text);
  assert.equal(noctData.status, "EVOLUTION_CYCLE_COMPLETED");

  // 6. eos_ast_analyze
  const astRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "eos_ast_analyze", arguments: { targetPath: "src/core/eosKernelPrimitives.ts" } },
  });
  assert.ok(astRes.result?.content?.[0]?.text);
});

test("BDD-281: EosMcpServer executes Phase 2 and Phase 3 core utilitarian tool handlers via tools/call", async () => {
  const server = new EosMcpServer(projectRoot, "full");

  // 7. eos_tmr_consensus
  const tmrRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "eos_tmr_consensus", arguments: { directive: "Safe system audit" } },
  });
  assert.ok(tmrRes.result?.content?.[0]?.text);
  const tmrData = JSON.parse(tmrRes.result.content[0].text);
  assert.equal(tmrData.consensusAchieved, true);

  // 8. eos_optimize_context
  const optRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: { name: "eos_optimize_context", arguments: { source: "export function hello() { return 42; }" } },
  });
  assert.ok(optRes.result?.content?.[0]?.text);

  // 9. eos_check_openspec
  const specRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: { name: "eos_check_openspec", arguments: {} },
  });
  assert.ok(specRes.result?.content?.[0]?.text);

  // 10. eos_query_code_graph
  const graphRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: { name: "eos_query_code_graph", arguments: { query: "EosMcpServer" } },
  });
  assert.ok(graphRes.result?.content?.[0]?.text);

  // 11. eos_get_blast_radius
  const blastRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: { name: "eos_get_blast_radius", arguments: { file: "src/core/eosKernelPrimitives.ts" } },
  });
  assert.ok(blastRes.result?.content?.[0]?.text);

  // 12. eos_semantic_search
  const searchRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 12,
    method: "tools/call",
    params: { name: "eos_semantic_search", arguments: { query: "inviolable laws", topK: 3 } },
  });
  assert.ok(searchRes.result?.content?.[0]?.text);

  // 13. eos_autonomous_heal
  const healRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 13,
    method: "tools/call",
    params: { name: "eos_autonomous_heal", arguments: { dryRun: true } },
  });
  assert.ok(healRes.result?.content?.[0]?.text);

  // 14. eos_refactor_audit
  const refactorRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 14,
    method: "tools/call",
    params: { name: "eos_refactor_audit", arguments: { targetDir: "src/core" } },
  });
  assert.ok(refactorRes.result?.content?.[0]?.text);

  // 15. glorian_fleet_health_watchdog
  const watchdogRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 15,
    method: "tools/call",
    params: { name: "glorian_fleet_health_watchdog", arguments: { dryRun: true } },
  });
  assert.ok(watchdogRes.result?.content?.[0]?.text);

  // 16. glorian_constitutional_tribunal
  const tribunalRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 16,
    method: "tools/call",
    params: {
      name: "glorian_constitutional_tribunal",
      arguments: { actionId: "ACT-TEST-001", category: "CODE_MUTATION", description: "Safe test action" },
    },
  });
  assert.ok(tribunalRes.result?.content?.[0]?.text);
  const tribunalData = JSON.parse(tribunalRes.result.content[0].text);
  assert.equal(tribunalData.overallVerdict, "SOVEREIGN_TRIBUNAL_APPROVED");
});

test("BDD-282: EosMcpServer executes Phase 7 and Phase 8 domain and AGI handlers via tools/call", async () => {
  const server = new EosMcpServer(projectRoot, "full");

  const phase7And8Tools = [
    { name: "eos_invariant_engine", args: {} },
    { name: "eos_contract_governor", args: { contractType: "API" } },
    { name: "eos_wasm_sandbox", args: { action: "diagnose" } },
    { name: "eos_enterprise_workspace", args: { action: "list" } },
    {
      name: "eos_agent_topology_mesh",
      args: {
        action: "compile",
        nodes: [
          {
            id: "node_1",
            name: "Kernel Node",
            assignedModulePath: "src/core/eosKernelPrimitives.ts",
            dependencies: [],
          },
        ],
      },
    },
    { name: "eos_content_addressable_cache", args: { action: "stats" } },
    { name: "eos_threshold_secret_split_combine", args: { action: "demo" } },
    { name: "eos_smt_reasoning_prover", args: { action: "abac_demo" } },
    { name: "eos_hash_chain_verify", args: { maxBlocks: 5 } },
    { name: "eos_platform_ops_ceiling", args: {} },
    { name: "eos_truetime_commit_wait", args: { action: "now" } },
    { name: "eos_lsm_storage_put_get", args: { action: "stats" } },
    { name: "eos_monte_carlo_sim", args: { trials: 10 } },
    { name: "eos_nsa_zero_trust_check", args: {} },
    { name: "eos_bft_swarm_consensus", args: { proposalId: "TEST-01" } },
    { name: "eos_trace_span_record", args: { operation: "test" } },
    { name: "eos_unitotal_evaluate", args: { scope: "system" } },
    { name: "eos_wal_status", args: {} },
    { name: "eos_github_gate", args: {} },
    { name: "eos_microvm_sandbox", args: { action: "diagnose" } },
    { name: "eos_mutation_test", args: { maxMutants: 2 } },
    { name: "eos_zero_copy_scan", args: { targetDir: "src/core" } },
    { name: "eos_microvm_enclave_generate", args: { enclaveId: "test-enc" } },
    { name: "eos_agi_axioms", args: {} },
    { name: "eos_context_window", args: { targetFile: "package.json", objective: "Audit dependencies" } },
    { name: "eos_forge_list", args: {} },
    { name: "eos_spec_drift", args: {} },
  ];

  for (const t of phase7And8Tools) {
    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 100,
      method: "tools/call",
      params: { name: t.name, arguments: t.args },
    });
    assert.equal(res.jsonrpc, "2.0", `Tool ${t.name} must return JSON-RPC 2.0 envelope`);
    assert.ok(res.result?.content?.[0]?.text, `Tool ${t.name} must return text content`);
  }
});
