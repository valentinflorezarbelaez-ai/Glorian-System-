/**
 * EOS SYSTEM — PHASE-7 DOMAIN MCP HANDLERS (SPEC-155 / T7c Max-3)
 * Largest residual switch arms extracted for god-file LOC ≤ ~5341 (−25% vs peak).
 * Explicitly NOT Level 5 — WITHIN_TESTED_SCOPE only.
 *
 * Thin router: the switch arms live in two cohesive slices so every module stays
 * within the 800-line size budget:
 *   - ./eosMcpPhase7VerificationHandlers.ts (verification & governance tools)
 *   - ./eosMcpPhase7RuntimeHandlers.ts      (runtime & assurance tools)
 * Construction fails closed if any migrated tool name lacks exactly one owner.
 */

import type { McpToolHandler } from "../eosMcpDispatchRegistry.ts";
import { PHASE7_MIGRATED_TOOL_NAMES } from "./eosMcpPhase7ToolNames.ts";
import { type Phase7DomainHandlerDeps, type Phase7HandlerContext } from "./eosMcpPhase7Shared.ts";
import { PHASE7_VERIFICATION_TOOL_NAMES, dispatchPhase7VerificationCase } from "./eosMcpPhase7VerificationHandlers.ts";
import { PHASE7_RUNTIME_TOOL_NAMES, dispatchPhase7RuntimeCase } from "./eosMcpPhase7RuntimeHandlers.ts";

export { PHASE7_MIGRATED_TOOL_NAMES };
export type { Phase7DomainHandlerDeps, Phase7HandlerContext } from "./eosMcpPhase7Shared.ts";

type Phase7SliceDispatcher = (
  toolName: string,
  args: Record<string, any>,
  deps: Phase7DomainHandlerDeps,
  ctx?: Phase7HandlerContext,
) => unknown;

function resolvePhase7Owner(toolName: string): Phase7SliceDispatcher {
  const inVerification = PHASE7_VERIFICATION_TOOL_NAMES.has(toolName);
  const inRuntime = PHASE7_RUNTIME_TOOL_NAMES.has(toolName);
  if (inVerification === inRuntime) {
    throw new Error(
      `Phase-7 routing invariant violated for ${toolName}: expected exactly one owner (verification=${inVerification}, runtime=${inRuntime})`,
    );
  }
  return inVerification ? dispatchPhase7VerificationCase : dispatchPhase7RuntimeCase;
}

export function createPhase7DomainHandlers(deps: Phase7DomainHandlerDeps): Readonly<Record<string, McpToolHandler>> {
  const out: Record<string, McpToolHandler> = {};
  for (const name of PHASE7_MIGRATED_TOOL_NAMES) {
    const dispatch = resolvePhase7Owner(name);
    out[name] = (args, ctx) => dispatch(name, (args || {}) as Record<string, any>, deps, ctx as any);
  }
  return out;
}
