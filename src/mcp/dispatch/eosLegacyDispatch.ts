import type {
  EosLegacyDispatchContext,
  EosLegacyProgressReporter,
  EosLegacyToolArgs,
  EosLegacyToolHandler
} from "./eosLegacyDispatchContext.ts";
import { KNOWLEDGE_LEGACY_HANDLERS } from "./eosLegacyKnowledgeHandlers.ts";
import { SOVEREIGN_LEGACY_HANDLERS } from "./eosLegacySovereignHandlers.ts";
import { RUNTIME_LEGACY_HANDLERS } from "./eosLegacyRuntimeHandlers.ts";
import { RELIABILITY_LEGACY_HANDLERS } from "./eosLegacyReliabilityHandlers.ts";
import { GOVERNANCE_LEGACY_HANDLERS } from "./eosLegacyGovernanceHandlers.ts";

const legacyHandlers = new Map<string, EosLegacyToolHandler>();

for (const group of [
  KNOWLEDGE_LEGACY_HANDLERS,
  SOVEREIGN_LEGACY_HANDLERS,
  RUNTIME_LEGACY_HANDLERS,
  RELIABILITY_LEGACY_HANDLERS,
  GOVERNANCE_LEGACY_HANDLERS
]) {
  for (const [toolName, handler] of Object.entries(group)) {
    if (legacyHandlers.has(toolName)) {
      throw new Error(`Duplicate legacy MCP handler for tool '${toolName}'.`);
    }
    legacyHandlers.set(toolName, handler);
  }
}

export const LEGACY_TOOL_NAMES: readonly string[] = Object.freeze([...legacyHandlers.keys()]);

export function dispatchLegacyTool(
  context: EosLegacyDispatchContext,
  toolName: string,
  args: EosLegacyToolArgs,
  onProgress?: EosLegacyProgressReporter
): any {
  const handler = legacyHandlers.get(toolName);
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return handler(context, args, onProgress);
}
