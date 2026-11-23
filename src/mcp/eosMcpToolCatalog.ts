/**
 * EOS SYSTEM — MODULAR MCP 2025-03-26 TOOL ANNOTATIONS & ANTI-BLOAT PROFILES (Layer 1)
 * Governed by SPEC-044, CHANGE-037, ADR-050, FR-133, BDD-129 (v50.0.0)
 * Token economy (LIDR M6 / fazt.dev): default profile is Tier-0 `core` (~46 tools).
 * Power users opt into `full` via `EOS_MCP_PROFILE=full` — the full catalog remains intact.
 *
 * Enriches every EOS MCP tool definition with standard Model Context Protocol (2025-03-26)
 * safety annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
 * and supports focused tool catalog profiles (`essential` | `core` | `full`) to prevent LLM tool-bloat.
 */

export type McpToolProfile = "essential" | "core" | "full";

/** Hard ceiling for Tier-0 `core` tool count (token-economy contract). */
export const MCP_TIER0_CORE_MAX_TOOLS = 46;

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

import { CORE_TIER0_TOOL_NAMES, ESSENTIAL_TIER0_TOOL_NAMES } from "../core/eosMcpSchemaValidator.ts";
import { MCP_MUTATION_CAPABLE_TOOLS } from "../core/eosMcpIamCallGate.ts";
export { CORE_TIER0_TOOL_NAMES, ESSENTIAL_TIER0_TOOL_NAMES };

/**
 * Tools capable of mutating local workspace files, Git worktrees, or durable ledger state
 * when explicit mutation flags (`apply: true`, `dryRun: false`, `action: "record"`) are supplied.
 * Single source of truth: SPEC-184 MCP IAM gate (`MCP_MUTATION_CAPABLE_TOOLS`).
 */
const MUTATION_CAPABLE_TOOLS: ReadonlySet<string> = MCP_MUTATION_CAPABLE_TOOLS;

const DESTRUCTIVE_CAPABLE_TOOLS: ReadonlySet<string> = new Set(["eos_manage_worktree"]);

function humanizeToolTitle(toolName: string): string {
  return toolName
    .replace(/^eos_/, "EOS ")
    .split("_")
    .map((part) =>
      part.length <= 3 && /^(mcp|sdd|ast|hft|dsp|nsa|tmr|wal|dst|dbc|cas|smt|bft)$/i.test(part)
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
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
    openWorldHint: false,
  };
}

/**
 * Resolve MCP tool profile.
 * Default (unset/empty/unknown) → Tier-0 `core` so agent turns do not load the full catalog.
 * Explicit `full` / `complete` / `all` preserves the power-user surface.
 * Aliases: `tier0` / `tier-0` → `core`; `essentials` → `essential`.
 */
export function normalizeToolProfile(rawProfile?: string): McpToolProfile {
  const normalized = String(rawProfile || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "core";
  if (normalized === "essential" || normalized === "essentials") return "essential";
  if (normalized === "core" || normalized === "tier0" || normalized === "tier-0") return "core";
  if (normalized === "full" || normalized === "complete" || normalized === "all") return "full";
  return "core";
}

export function annotateAndFilterTools(
  rawTools: ReadonlyArray<{
    readonly name: string;
    readonly description: string;
    readonly inputSchema: Record<string, unknown>;
  }>,
  profile: McpToolProfile = "core",
): AnnotatedMcpToolDefinition[] {
  const filtered =
    profile === "essential"
      ? rawTools.filter((tool) => ESSENTIAL_TIER0_TOOL_NAMES.has(tool.name))
      : profile === "core"
        ? rawTools.filter((tool) => CORE_TIER0_TOOL_NAMES.has(tool.name))
        : rawTools;

  return filtered.map((tool) => ({
    ...tool,
    annotations: computeToolAnnotations(tool.name),
  }));
}
