/**
 * EOS SYSTEM — MCP TOOL-NAME TAXONOMY (Layer 0, single source of truth)
 *
 * Core scorecards, the schema validator and the MCP catalog all need the same
 * tool-name catalogs. Keeping them in Layer 0 removes the historical
 * `src/core -> src/mcp` imports (architecture rule R2 in
 * scripts/verify-architecture-boundaries.mjs) while `src/mcp` re-exports them
 * so its public API stays unchanged.
 *
 * Phase 1 and Phase 2 lists mirror their handler registries by construction;
 * test/eosMcpToolTaxonomy.test.mjs fails the gate if they ever drift.
 */

/** Curated Tier-0 Core Engineering Profile (<= 30 high-signal control-plane tools). */
export const CORE_TIER0_TOOL_NAMES: ReadonlySet<string> = new Set([
  "eos_antigravity_direct",
  "eos_antigravity_doctor",
  "eos_gentleman_audit",
  "eos_gentleman_update",
  "eos_agent_session_contract",
  "eos_amplify_prompt",
  "eos_semantic_search",
  "eos_hnsw_knn_search",
  "eos_check_architecture",
  "eos_check_openspec",
  "eos_ast_analyze",
  "eos_get_blast_radius",
  "eos_query_code_graph",
  "eos_evaluate_decision",
  "eos_tmr_consensus",
  "eos_validate_patch",
  "eos_turbo_verify",
  "eos_optimize_context",
  "eos_refactor_audit",
  "eos_nocturnal_evolution",
  "eos_mission_run",
  "eos_autonomous_heal",
  "eos_sqlite_ledger",
  "eos_manage_worktree",
  "eos_fleet_soundcheck",
  "eos_audit_fleet",
  "eos_health_check",
  "eos_mcts_tune",
  "glorian_fleet_health_watchdog",
  "glorian_constitutional_tribunal"
]);

/** Phase-1 core utilitarian handlers (must equal Object.keys(PHASE1_CORE_UTILITARIAN_HANDLERS).sort()). */
export const PHASE1_MIGRATED_TOOL_NAMES: readonly string[] = Object.freeze([
  "eos_amplify_prompt",
  "eos_ast_analyze",
  "eos_check_architecture",
  "eos_evaluate_decision",
  "eos_fleet_soundcheck",
  "eos_gentleman_audit",
  "eos_health_check",
  "eos_mission_run",
  "eos_nocturnal_evolution",
  "eos_turbo_verify"
]);

/** Phase-2 core utilitarian handlers (must equal Object.keys(PHASE2_CORE_UTILITARIAN_HANDLERS).sort()). */
export const PHASE2_MIGRATED_TOOL_NAMES: readonly string[] = Object.freeze([
  "eos_audit_fleet",
  "eos_check_openspec",
  "eos_get_blast_radius",
  "eos_optimize_context",
  "eos_query_code_graph",
  "eos_tmr_consensus",
  "eos_validate_patch"
]);

/** Phase-3 core handlers. */
export const PHASE3_MIGRATED_TOOL_NAMES: readonly string[] = Object.freeze([
  "eos_agent_session_contract",
  "eos_antigravity_direct",
  "eos_antigravity_doctor",
  "eos_autonomous_heal",
  "eos_gentleman_update",
  "eos_hnsw_knn_search",
  "eos_manage_worktree",
  "eos_mcts_tune",
  "eos_refactor_audit",
  "eos_semantic_search",
  "eos_sqlite_ledger",
  "glorian_constitutional_tribunal",
  "glorian_fleet_health_watchdog"
]);

/** Phase-4 institutional handlers. */
export const PHASE4_MIGRATED_TOOL_NAMES: readonly string[] = Object.freeze([
  "eos_black_projects_triad_audit",
  "eos_nubank_audit",
  "eos_nubank_datomic_transact",
  "eos_nubank_postmortem",
  "eos_nubank_sachem_verify",
  "eos_planetary_doctrine_audit",
  "eos_slsa_provenance_sbom",
  "eos_spotify_audit_institutional",
  "eos_spotify_canary_gate",
  "eos_spotify_fleetshift_plan",
  "eos_spotify_golden_path_verify"
]);

/** Phase-5 domain handlers (Spotify domain bundle). */
export const PHASE5_MIGRATED_TOOL_NAMES: readonly string[] = Object.freeze([
  "eos_spotify_audit",
  "eos_spotify_canary_manifest",
  "eos_spotify_experiment",
  "eos_spotify_fleetshift_batch",
  "eos_spotify_honk_dispatch",
  "eos_spotify_mix_plan",
  "eos_spotify_postmortem",
  "eos_spotify_scaffold",
  "eos_spotify_shuffle",
  "eos_spotify_standup",
  "eos_spotify_taste_profile",
  "eos_spotify_xirp_context"
]);

/** Phase-6 domain handlers. */
export const PHASE6_MIGRATED_TOOL_NAMES: readonly string[] = Object.freeze([
  "eos_apex_autonomous_heal",
  "eos_apex_compress_context",
  "eos_apex_go_benchmark",
  "eos_apex_route_model",
  "eos_finops_budget_check",
  "eos_finops_evaluate_stagnation",
  "eos_finops_route_task",
  "eos_finops_wallet_status",
  "eos_fleet_elevate",
  "eos_fleet_mission_control",
  "eos_fleet_pulse",
  "eos_fleet_registry_sync",
  "eos_fleet_verify",
  "eos_planetary_mesh_evacuate_traffic",
  "eos_planetary_mesh_health_matrix",
  "eos_planetary_mesh_status",
  "eos_planetary_sparse_project",
  "eos_product_deliver_run",
  "eos_product_deliver_status",
  "eos_product_foundry_create",
  "eos_product_foundry_validate",
  "eos_synapse_arbitrate",
  "eos_synapse_fleet_knowledge_query",
  "eos_synapse_mesh_status",
  "eos_synapse_propagate_golden_path"
]);

/** Phase-7 domain handlers. */
export const PHASE7_MIGRATED_TOOL_NAMES: readonly string[] = Object.freeze([
  "eos_invariant_engine",
  "eos_contract_governor",
  "eos_surgical_healing",
  "eos_wasm_sandbox",
  "eos_enterprise_workspace",
  "eos_agent_topology_mesh",
  "eos_content_addressable_cache",
  "eos_threshold_secret_split_combine",
  "eos_neurosymbolic_fleet_healing",
  "eos_columnar_telemetry_query",
  "eos_smt_reasoning_prover",
  "eos_evolve_module",
  "eos_fuzz_hypervisor",
  "eos_hash_chain_verify",
  "eos_platform_ops_ceiling",
  "eos_truetime_commit_wait",
  "eos_lsm_storage_put_get",
  "eos_monte_carlo_sim",
  "eos_nsa_zero_trust_check",
  "eos_bft_swarm_consensus",
  "eos_trace_span_record",
  "eos_autonomous_synthesize",
  "eos_unitotal_evaluate",
  "eos_wal_status",
  "eos_github_gate",
  "eos_microvm_sandbox",
  "eos_mutation_test",
  "eos_zero_copy_scan",
  "eos_microvm_enclave_generate"
]);
