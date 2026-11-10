/**
 * EOS MCP TOOL DEFINITIONS — static "tools/list" schemas (208 tools).
 * Pure data (no behavior). Runtime annotations live in eosMcpToolCatalog.ts;
 * the name taxonomy lives in src/core/eosMcpToolTaxonomy.ts.
 *
 * The schemas are partitioned into ordered slices under ./tools/definitions/ so
 * every module stays within the 800-line size budget. Concatenation order is
 * part of the public contract (tools/list ordering) and must not change.
 */
import { PHASE8_TOOL_DEFINITIONS } from "./tools/eosMcpPhase8ToolDefinitions.ts";
import { EOS_MCP_TOOL_DEFINITIONS_PART_01 } from "./tools/definitions/eosMcpToolDefinitionsPart01.ts";
import { EOS_MCP_TOOL_DEFINITIONS_PART_02 } from "./tools/definitions/eosMcpToolDefinitionsPart02.ts";
import { EOS_MCP_TOOL_DEFINITIONS_PART_03 } from "./tools/definitions/eosMcpToolDefinitionsPart03.ts";
import { EOS_MCP_TOOL_DEFINITIONS_PART_04 } from "./tools/definitions/eosMcpToolDefinitionsPart04.ts";
import { EOS_MCP_TOOL_DEFINITIONS_PART_05 } from "./tools/definitions/eosMcpToolDefinitionsPart05.ts";
import type { EosMcpToolDefinitionInput } from "./tools/definitions/eosMcpToolDefinitionTypes.ts";

export type { EosMcpToolDefinitionInput } from "./tools/definitions/eosMcpToolDefinitionTypes.ts";

export const EOS_MCP_TOOL_DEFINITIONS: ReadonlyArray<EosMcpToolDefinitionInput> = [
  ...EOS_MCP_TOOL_DEFINITIONS_PART_01,
  ...EOS_MCP_TOOL_DEFINITIONS_PART_02,
  ...EOS_MCP_TOOL_DEFINITIONS_PART_03,
  ...EOS_MCP_TOOL_DEFINITIONS_PART_04,
  ...EOS_MCP_TOOL_DEFINITIONS_PART_05,
  ...PHASE8_TOOL_DEFINITIONS,
];
