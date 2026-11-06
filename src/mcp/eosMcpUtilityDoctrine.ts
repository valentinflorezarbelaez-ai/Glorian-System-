/**
 * EOS SYSTEM — MCP UTILITY DOCTRINE (SPEC-155 / CHANGE-090)
 * Engineering translation of conscious vs mechanical discrimination:
 * UTILITARIAN tools stay on the agent default path; ceremonial vanity stays full-only.
 */

import { CORE_TIER0_TOOL_NAMES } from "./eosMcpToolCatalog.ts";

export type McpToolUtilityClass = "UTILITARIAN" | "RETAINED_COMPAT" | "CEREMONIAL";

/** Known ceremonial / prestige-named tools retained only for full-profile compatibility. */
export const CEREMONIAL_TOOL_NAMES: ReadonlySet<string> = new Set([
  "eos_alchemical_transmute",
  "eos_conscious_witness",
  "eos_unitotal_evaluate",
  "eos_sapience_autoshipper",
  "eos_samael_ibm_nvidia",
  "eos_big_tech_transcendence",
  "eos_transcendence_execute",
  "eos_transcendence_status",
  "eos_ain",
  "eos_clave_de_sol_evaluate"
]);

export function classifyMcpToolUtility(toolName: string): McpToolUtilityClass {
  const name = String(toolName || "").trim();
  if (CORE_TIER0_TOOL_NAMES.has(name)) return "UTILITARIAN";
  if (CEREMONIAL_TOOL_NAMES.has(name)) return "CEREMONIAL";
  return "RETAINED_COMPAT";
}

export function assertCoreToolsAreUtilitarian(): {
  readonly ok: boolean;
  readonly coreCount: number;
  readonly offenders: readonly string[];
} {
  const offenders: string[] = [];
  for (const name of CORE_TIER0_TOOL_NAMES) {
    if (classifyMcpToolUtility(name) !== "UTILITARIAN") offenders.push(name);
  }
  return {
    ok: offenders.length === 0 && CORE_TIER0_TOOL_NAMES.size <= 30,
    coreCount: CORE_TIER0_TOOL_NAMES.size,
    offenders
  };
}
