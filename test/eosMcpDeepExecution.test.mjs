/**
 * EOS SYSTEM — DEEP MCP TOOL EXECUTION SUITE (SPEC-155 / BDD-280)
 *
 * Verifies end-to-end JSON-RPC 2.0 tools/call dispatch across Phase 1, Phase 2,
 * and Phase 3 core utilitarian tool handlers.
 *
 * Big Tech Standard (Google / Stripe API conformance):
 * Asserts handler correctness, response envelope structure, and zero unhandled exceptions.
 */

import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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

  // 1b. eos_mission_run
  const missionRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: { name: "eos_mission_run", arguments: { directive: "Audit code" } },
  });
  assert.ok(missionRes.result?.content?.[0]?.text);

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
      arguments: {
        title: "Gate strictness",
        description: "Choose between strict and lax verification gates",
        proposedAction: "Keep the strict fail-closed gate",
      },
    },
  });
  assert.ok(judgeRes.result?.content?.[0]?.text);

  // 4. eos_check_architecture
  const archRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "eos_check_architecture", arguments: { targetDir: "src/core" } },
  });
  assert.ok(archRes.result?.content?.[0]?.text);
  const archData = JSON.parse(archRes.result.content[0].text);
  assert.ok(archData.scannedFilesCount > 0);

  // 5. eos_nocturnal_evolution
  const noctRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "eos_nocturnal_evolution", arguments: { targetDir: "src/core", format: "json" } },
  });
  assert.ok(noctRes.result?.content?.[0]?.text);
  const noctData = JSON.parse(noctRes.result.content[0].text);
  assert.equal(noctData.status, "EVOLUTION_CYCLE_COMPLETED");

  // 6. eos_ast_analyze
  const astRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "eos_ast_analyze", arguments: { targetDir: "src/core" } },
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

  // 7b. eos_audit_fleet
  const fleetAuditRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 71,
    method: "tools/call",
    params: { name: "eos_audit_fleet", arguments: {} },
  });
  assert.ok(fleetAuditRes.result?.content?.[0]?.text);

  // 7c. eos_validate_patch
  const patchRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 72,
    method: "tools/call",
    params: {
      name: "eos_validate_patch",
      arguments: { filePath: "package.json", content: '{\n  "name": "valid-patch"\n}' },
    },
  });
  assert.ok(patchRes.result?.content?.[0]?.text);

  // 8. eos_optimize_context
  const optRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: {
      name: "eos_optimize_context",
      arguments: { filePath: "package.json", content: "export function hello() { return 42; }" },
    },
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
    params: { name: "eos_get_blast_radius", arguments: { filePath: "src/core/eosKernelPrimitives.ts" } },
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

  // 17. eos_manage_worktree
  const wtListRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 17,
    method: "tools/call",
    params: { name: "eos_manage_worktree", arguments: { action: "list" } },
  });
  assert.ok(wtListRes.result?.content?.[0]?.text);

  const wtCreateRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 18,
    method: "tools/call",
    params: { name: "eos_manage_worktree", arguments: { action: "create", branch: "test-plan", apply: false } },
  });
  assert.ok(wtCreateRes.result?.content?.[0]?.text);

  // 18. eos_agent_session_contract (lifecycle: open -> record_tool -> status)
  const sessionOpenRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 19,
    method: "tools/call",
    params: {
      name: "eos_agent_session_contract",
      arguments: { action: "open", ideFamily: "antigravity", directive: "Verify architecture" },
    },
  });
  assert.ok(sessionOpenRes.result?.content?.[0]?.text);
  const sessionOpenData = JSON.parse(sessionOpenRes.result.content[0].text);
  assert.ok(sessionOpenData.sessionId);

  const sessionRecordRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 20,
    method: "tools/call",
    params: {
      name: "eos_agent_session_contract",
      arguments: { action: "record_tool", sessionId: sessionOpenData.sessionId, toolName: "eos_check_architecture" },
    },
  });
  assert.ok(sessionRecordRes.result?.content?.[0]?.text);

  const sessionStatusRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 21,
    method: "tools/call",
    params: { name: "eos_agent_session_contract", arguments: { action: "status" } },
  });
  assert.ok(sessionStatusRes.result?.content?.[0]?.text);

  // 19. eos_sqlite_ledger (verify, recent, search)
  const ledgerStatsRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 22,
    method: "tools/call",
    params: { name: "eos_sqlite_ledger", arguments: { action: "verify" } },
  });
  assert.ok(ledgerStatsRes.result?.content?.[0]?.text);

  const ledgerStatusRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 23,
    method: "tools/call",
    params: { name: "eos_sqlite_ledger", arguments: { action: "recent", limit: 5 } },
  });
  assert.ok(ledgerStatusRes.result?.content?.[0]?.text);

  const ledgerCompactRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 24,
    method: "tools/call",
    params: { name: "eos_sqlite_ledger", arguments: { action: "search", query: "eos", limit: 5 } },
  });
  assert.ok(ledgerCompactRes.result?.content?.[0]?.text);

  // 20. eos_hnsw_knn_search
  const hnswRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 25,
    method: "tools/call",
    params: { name: "eos_hnsw_knn_search", arguments: { query: "cryptographic consensus", k: 3 } },
  });
  assert.ok(hnswRes.result?.content?.[0]?.text);

  // 21. eos_mcts_tune
  const mctsRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 26,
    method: "tools/call",
    params: { name: "eos_mcts_tune", arguments: { iterations: 10 } },
  });
  assert.ok(mctsRes.result?.content?.[0]?.text);

  // 22. eos_antigravity_direct & doctor
  const agDirectRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 27,
    method: "tools/call",
    params: { name: "eos_antigravity_direct", arguments: { directive: "Audit system invariants" } },
  });
  assert.ok(agDirectRes.result?.content?.[0]?.text);

  const agDoctorRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 28,
    method: "tools/call",
    params: { name: "eos_antigravity_doctor", arguments: {} },
  });
  assert.ok(agDoctorRes.result?.content?.[0]?.text);

  // 23. eos_gentleman_update
  const gentUpdateRes = await server.handleRequest({
    jsonrpc: "2.0",
    id: 29,
    method: "tools/call",
    params: { name: "eos_gentleman_update", arguments: { dryRun: true } },
  });
  assert.ok(gentUpdateRes.result?.content?.[0]?.text);
});

test("BDD-282: EosMcpServer executes Phase 7 and Phase 8 domain and AGI handlers via tools/call", async () => {
  const server = new EosMcpServer(projectRoot, "full");

  const phase7And8Tools = [
    { name: "eos_invariant_engine", args: { action: "verify", modelType: "counter" } },
    { name: "eos_contract_governor", args: { action: "sql_lint", ddlSql: "ALTER TABLE users ADD COLUMN age INT;" } },
    { name: "eos_surgical_healing", args: { action: "diagnose" } },
    { name: "eos_wasm_sandbox", args: { action: "diagnose", tier: "WASM" } },
    { name: "eos_enterprise_workspace", args: { action: "inspect", projectId: "eos-system" } },
    {
      name: "eos_neurosymbolic_fleet_healing",
      args: {
        action: "heal_fault",
        faultId: "FAULT_01",
        targetFilePath: "src/core/sample.ts",
        failingLine: 1,
        errorMessage: "TypeError",
        mockOriginalContent: "const x = 1;",
      },
    },
    {
      name: "eos_evolve_module",
      args: { action: "evaluate", candidatePatch: "+ // opt", targetModulePath: "src/core/sample.ts" },
    },
    { name: "eos_autonomous_synthesize", args: { directive: "Build payment gateway adapter", write: false } },
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
    {
      name: "eos_threshold_secret_split_combine",
      args: { action: "split", secret: "hermetic-demo-secret", threshold: 2, totalShares: 3 },
    },
    { name: "eos_smt_reasoning_prover", args: { action: "abac_demo" } },
    { name: "eos_hash_chain_verify", args: { maxBlocks: 5 } },
    { name: "eos_platform_ops_ceiling", args: {} },
    { name: "eos_truetime_commit_wait", args: { action: "now" } },
    { name: "eos_lsm_storage_put_get", args: { action: "stats" } },
    { name: "eos_monte_carlo_sim", args: { trials: 10 } },
    {
      name: "eos_nsa_zero_trust_check",
      args: {
        subjectClearance: "SECRET",
        objectClassification: "CONFIDENTIAL",
        action: "READ",
      },
    },
    { name: "eos_bft_swarm_consensus", args: { proposalId: "TEST-01" } },
    {
      name: "eos_trace_span_record",
      args: { traceId: "tr-test", spanId: "sp-test", name: "hermetic.operation", durationMs: 12 },
    },
    { name: "eos_unitotal_evaluate", args: { action: "evaluate" } },
    { name: "eos_wal_status", args: {} },
    { name: "eos_github_gate", args: {} },
    { name: "eos_microvm_sandbox", args: { action: "doctor" } },
    { name: "eos_mutation_test", args: { targetSnippet: "function add(a,b){return a+b}" } },
    { name: "eos_zero_copy_scan", args: { targetDir: "src/core" } },
    { name: "eos_microvm_enclave_generate", args: { enclaveId: "test-enc" } },
    { name: "eos_agi_axioms", args: {} },
    { name: "eos_context_window", args: { targetFile: "package.json", objective: "Audit dependencies" } },
    { name: "eos_forge_list", args: {} },
    {
      name: "eos_forge_tool",
      args: {
        toolName: "dynamic_audit_test",
        description: "Audit test tool",
        inputSchema: { type: "object" },
        moduleSource:
          'export const name = "dynamic_audit_test"; export const description = "Audit test tool"; export const inputSchema = { type: "object" }; export function execute() { return true; }',
      },
    },
    { name: "eos_consult", args: { problem: "Architecture audit" } },
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

test("BDD-283: EosMcpServer executes Phase 4, Phase 5, and Phase 6 domain and institutional handlers via tools/call", async () => {
  const server = new EosMcpServer(projectRoot, "full");

  const phase456Tools = [
    // Phase 4 Institutional Tools
    { name: "eos_nubank_audit", args: {} },
    {
      name: "eos_nubank_sachem_verify",
      args: {
        previousSchema: { type: "record", name: "User", fields: [] },
        proposedSchema: { type: "record", name: "User", fields: [] },
      },
    },
    {
      name: "eos_nubank_postmortem",
      args: {
        incidentId: "INC-01",
        title: "Audit verification",
        severity: "SEV3",
        owningSquad: "platform",
        affectedServices: ["eos-mcp"],
        customerImpact: "none",
        startTime: "2026-11-09T00:00:00Z",
        resolutionTime: "2026-11-09T00:05:00Z",
        durationMinutes: 5,
        timeline: [{ t: "T0", note: "detected" }],
        fiveWhys: ["why1", "why2", "why3", "why4", "why5"],
        cognitiveFactors: ["alert fatigue"],
        systemicRemediations: [{ action: "add arg gate", owner: "eos" }],
      },
    },
    { name: "eos_nubank_datomic_transact", args: { txData: [["db/add", 1, "test/ident", "audit"]] } },
    { name: "eos_spotify_audit_institutional", args: {} },
    {
      name: "eos_spotify_golden_path_verify",
      args: { serviceName: "audit-svc", filesPresent: ["catalog-info.yaml"] },
    },
    {
      name: "eos_spotify_canary_gate",
      args: {
        stage: "5%",
        trafficPercentage: 5,
        totalRequests: 10000,
        errorCount: 0,
        p99LatencyMs: 120,
        maxAllowedP99Ms: 500,
        observationWindowMinutes: 10,
      },
    },
    {
      name: "eos_spotify_fleetshift_plan",
      args: {
        migrationId: "MIG-AUDIT",
        description: "Hermetic fleetshift audit plan",
        targetRepos: [{ id: "eos-system", name: "Glorian" }],
        action: "codemod-verify",
      },
    },
    { name: "eos_slsa_provenance_sbom", args: { mode: "both" } },
    { name: "eos_planetary_doctrine_audit", args: { format: "summary" } },
    { name: "eos_black_projects_triad_audit", args: { format: "summary" } },

    // Phase 5 Domain Tools
    { name: "eos_spotify_audit", args: { targetPath: "." } },
    { name: "eos_spotify_scaffold", args: { targetPath: ".", name: "test-comp", apply: false } },
    { name: "eos_spotify_standup", args: { yesterday: ["Audited"], today: ["Verify"], blockers: [] } },
    { name: "eos_spotify_postmortem", args: { incidentId: "INC-02", timeline: ["T0: pass"] } },
    { name: "eos_spotify_experiment", args: { experimentId: "EXP-01", hypothesis: "Strict gates" } },
    { name: "eos_spotify_honk_dispatch", args: { taskName: "Audit test", specDescription: "Check Law V" } },
    { name: "eos_spotify_xirp_context", args: { syncFiles: false } },
    {
      name: "eos_spotify_fleetshift_batch",
      args: { migrationId: "MIG-BATCH-01", action: "enforce_strict_sre" },
    },
    { name: "eos_spotify_canary_manifest", args: { serviceName: "spotify-service", squad: "platform" } },
    { name: "eos_spotify_mix_plan", args: { keyA: "8A", keyB: "9A", duration: 5.0 } },
    { name: "eos_spotify_taste_profile", args: { userId: "user-deep-test" } },
    { name: "eos_spotify_shuffle", args: { seed: 42108 } },

    // Phase 6 Domain & Fleet Tools
    { name: "eos_fleet_registry_sync", args: { dryRun: true } },
    { name: "eos_apex_route_model", args: { directivePrompt: "Evaluate security policy" } },
    { name: "eos_finops_budget_check", args: {} },
    { name: "eos_finops_wallet_status", args: {} },
    { name: "eos_fleet_elevate", args: { targetProject: "eos-system" } },
    { name: "eos_fleet_mission_control", args: {} },
    { name: "eos_fleet_pulse", args: {} },
    { name: "eos_fleet_verify", args: { targetProject: "eos-system" } },
    { name: "eos_planetary_mesh_status", args: {} },
    { name: "eos_product_deliver_status", args: {} },
    { name: "eos_product_foundry_create", args: { name: "test-product", domain: "ai", tier: "MVP" } },
    {
      name: "eos_product_foundry_validate",
      args: {
        manifest: {
          id: "p-1",
          name: "P1",
          archetype: "api",
          capabilities: [],
          tier: "EXPERIMENTAL",
          complianceSeal: "sha256:0",
        },
      },
    },
    { name: "eos_synapse_mesh_status", args: {} },
    { name: "eos_synapse_fleet_knowledge_query", args: { query: "arch" } },
  ];

  for (const t of phase456Tools) {
    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 200,
      method: "tools/call",
      params: { name: t.name, arguments: t.args },
    });
    assert.equal(res.jsonrpc, "2.0", `Tool ${t.name} must return JSON-RPC 2.0 envelope`);
    assert.ok(res.result?.content?.[0]?.text, `Tool ${t.name} must return text content`);
  }
});

after(() => {
  const forged = path.join(projectRoot, "src/dynamic_tools/eos_dynamic_audit_test.tool.mjs");
  if (fs.existsSync(forged)) fs.unlinkSync(forged);
  const manifest = path.join(projectRoot, "src/dynamic_tools/forge_manifest.json");
  if (fs.existsSync(manifest)) fs.unlinkSync(manifest);
  const consultDir = path.join(projectRoot, "docs/consulting");
  if (fs.existsSync(consultDir)) fs.rmSync(consultDir, { recursive: true, force: true });
});
