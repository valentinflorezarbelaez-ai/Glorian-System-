/**
 * EOS SYSTEM — MASTER UNIFIED ENTERPRISE ENTRY POINT (Layer 0)
 * Governed by SPEC-085, CHANGE-063, ADR-087 (v71.0.0)
 *
 * Exposes all pure sovereign core modules, MCP protocol engines,
 * and developer toolkits with 100% strict type safety and zero external dependencies.
 */

// Core Layer-0 Sovereign Engines & Zenith Hyperscaler Modules
export * from "./core/index.ts";

// MCP Server Protocol & Catalog
export { EosMcpServer } from "./mcp/eosMcpServer.ts";
export {
  CORE_TIER0_TOOL_NAMES,
  annotateAndFilterTools,
  computeToolAnnotations,
  normalizeToolProfile,
  type McpToolProfile,
  type McpToolAnnotations,
  type AnnotatedMcpToolDefinition
} from "./mcp/eosMcpToolCatalog.ts";
