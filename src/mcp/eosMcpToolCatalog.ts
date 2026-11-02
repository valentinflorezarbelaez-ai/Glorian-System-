/**
 * EOS SYSTEM — MODULAR MCP 2025-03-26 TOOL ANNOTATIONS & ANTI-BLOAT PROFILES (Layer 1)
 * Governed by SPEC-044, CHANGE-037, ADR-050, FR-133, BDD-129 (v50.0.0)
 *
 * Enriches every EOS MCP tool definition with standard Model Context Protocol (2025-03-26)
 * safety annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
 * and supports focused tool catalog profiles (`core` vs `full`) to prevent LLM tool-bloat.
 */

export type McpToolProfile = "core" | "full";

export interface McpToolAnnotations {
  readonly title: string;
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
}

export interface AnnotatedMcpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly annotations: McpToolAnnotations;
}

/**
 * Curated Tier-0 Core Engineering Profile (25 real, high-signal control-plane tools).
 * Keeps LLM tool-selection precision maximized when `EOS_MCP_PROFILE=core`.
 */
export const CORE_TIER0_TOOL_NAMES: ReadonlySet<string> = new Set([
  "eos_antigravity_direct",
  "eos_antigravity_doctor",
  "eos_gentleman_audit",
  "eos_gentleman_update",
  "eos_enterprise_workspace",
  "eos_evolve_module",
  "eos_sqlite_ledger",
  "eos_ast_analyze",
  "eos_amplify_prompt",
  "eos_semantic_search",
  "eos_hnsw_knn_search",
  "eos_check_architecture",
  "eos_check_openspec",
  "eos_get_blast_radius",
  "eos_query_code_graph",
  "eos_evaluate_decision",
  "eos_tmr_consensus",
  "eos_validate_patch",
  "eos_optimize_context",
  "eos_turbo_verify",
  "eos_refactor_audit",
  "eos_autonomous_heal",
  "eos_manage_worktree",
  "eos_fleet_soundcheck",
  "eos_audit_fleet",
  "eos_mcts_tune",
  "eos_canary_rollout",
  "eos_agent_topology_mesh",
  "eos_invariant_engine",
  "eos_contract_governor",
  "eos_surgical_healing",
  "eos_tlc_checker",
  "eos_github_gate",
  "eos_microvm_sandbox",
  "eos_dashboard_status",
  "eos_fleet_verify",
  "eos_unitotal_evaluate",
  "eos_fuzz_hypervisor",
  "eos_conscious_witness",
  "eos_sapfix_autoshipper",
  "eos_slsa_provenance_sbom",
  "eos_content_addressable_cache",
  "eos_smt_reasoning_prover",
  "eos_chaos_monkey_live",
  "eos_bft_swarm_consensus",
  "eos_health_check"
]);

/**
 * Tools capable of mutating local workspace files, Git worktrees, or durable ledger state
 * when explicit mutation flags (`apply: true`, `dryRun: false`, `action: "record"`) are supplied.
 */
const MUTATION_CAPABLE_TOOLS: ReadonlySet<string> = new Set([
  "eos_autonomous_heal",
  "eos_manage_worktree",
  "eos_reconcile_state",
  "eos_spotify_scaffold",
  "eos_spotify_fleetshift_batch",
  "eos_fleet_elevate",
  "eos_universal_scaffold",
  "eos_apex_autonomous_heal",
  "eos_hnsw_index_add",
  "eos_product_foundry_create",
  "eos_sqlite_ledger",
  "eos_gentleman_update",
  "eos_enterprise_workspace",
  "eos_evolve_module",
  "eos_agent_topology_mesh",
  "eos_surgical_healing",
  "eos_sapfix_autoshipper",
  "eos_content_addressable_cache",
  "eos_chaos_monkey_live",
  "eos_fleet_registry_sync"
]);

const DESTRUCTIVE_CAPABLE_TOOLS: ReadonlySet<string> = new Set([
  "eos_manage_worktree"
]);

function humanizeToolTitle(toolName: string): string {
  return toolName
    .replace(/^eos_/, "EOS ")
    .split("_")
    .map((part) => (part.length <= 3 && /^(mcp|sdd|ast|hft|dsp|nsa|tmr|wal|dst|dbc|cas|smt|bft)$/i.test(part)
      ? part.toUpperCase()
      : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

export function computeToolAnnotations(toolName: string): McpToolAnnotations {
  const isMutating = MUTATION_CAPABLE_TOOLS.has(toolName);
  const isDestructive = DESTRUCTIVE_CAPABLE_TOOLS.has(toolName);

  return {
    title: humanizeToolTitle(toolName),
    readOnlyHint: !isMutating,
    destructiveHint: isDestructive,
    idempotentHint: !isMutating || toolName === "eos_reconcile_state",
    openWorldHint: false
  };
}

export function normalizeToolProfile(rawProfile?: string): McpToolProfile {
  return String(rawProfile || "").trim().toLowerCase() === "core" ? "core" : "full";
}

export function annotateAndFilterTools(
  rawTools: ReadonlyArray<{
    readonly name: string;
    readonly description: string;
    readonly inputSchema: Record<string, unknown>;
  }>,
  profile: McpToolProfile = "full"
): AnnotatedMcpToolDefinition[] {
  const filtered =
    profile === "core"
      ? rawTools.filter((tool) => CORE_TIER0_TOOL_NAMES.has(tool.name))
      : rawTools;

  return filtered.map((tool) => ({
    ...tool,
    annotations: computeToolAnnotations(tool.name)
  }));
}
