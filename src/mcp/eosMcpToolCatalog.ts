/**
 * EOS SYSTEM — MODULAR MCP 2025-03-26 TOOL ANNOTATIONS & ANTI-BLOAT PROFILES (Layer 1)
 * Governed by SPEC-044, CHANGE-037, ADR-050, FR-133, BDD-129 (v50.0.0)
 *
 * Enriches every EOS MCP tool definition with standard Model Context Protocol (2025-03-26)
 * safety annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
 * and supports focused tool catalog profiles (`core` vs `full`) to prevent LLM tool-bloat.
 */

import { CORE_TIER0_TOOL_NAMES } from "../core/eosMcpToolTaxonomy.ts";

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
 * Curated Tier-0 Core Engineering Profile (<= 30 high-signal control-plane tools).
 * BDD-129 / FR-133: exotic frontier tools stay in `full`. Activate with `EOS_MCP_PROFILE=core`.
 * Re-exported from Layer 0 so core scorecards never import the MCP layer.
 */
export { CORE_TIER0_TOOL_NAMES };

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
  "eos_mission_run",
  "eos_gentleman_update",
  "eos_enterprise_workspace",
  "eos_evolve_module",
  "eos_agent_topology_mesh",
  "eos_surgical_healing",
  "eos_sapience_autoshipper",
  "eos_content_addressable_cache",
  "eos_chaos_monkey_live",
  "eos_fleet_registry_sync",
  "eos_agent_session_contract",
  "eos_nocturnal_evolution"
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
