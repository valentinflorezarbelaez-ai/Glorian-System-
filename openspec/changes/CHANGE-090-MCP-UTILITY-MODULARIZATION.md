# CHANGE-090: MCP Utility Modularization & Samaelian Utility Doctrine

- **Change ID**: `CHANGE-090`
- **Specification ID**: `SPEC-155`
- **Status**: `IN_PROGRESS`
- **Authorization Level**: `LEVEL_3_PRODUCTION_AUTHORIZED`
- **Impacted Specifications**: `SPEC-155-MCP-UTILITY-MODULARIZATION.md`, `SPEC-044-TIER0-APEX-GENTLEMAN-SYNERGY.md`, `SPEC-140-MCP-STREAMABLE-HTTP-TRANSPORT.md`
- **Modules Added / Modified**:
  - `src/mcp/eosMcpDispatchRegistry.ts` (new)
  - `src/mcp/eosMcpUtilityDoctrine.ts` (new)
  - `src/mcp/tools/eosMcpCoreUtilitarianHandlers.ts` (new)
  - `src/mcp/eosMcpServer.ts` (wire registry before legacy switch)
  - `src/mcp/eosMcpToolCatalog.ts` (core <= 30 already)
  - `test/eosMcpUtilityModularization.test.mjs` (new)

## Intent
Break the MCP god-file ego: modular dispatch + conscious `core` surface. Retain full catalog for compatibility without forcing vanity tools onto agents.
