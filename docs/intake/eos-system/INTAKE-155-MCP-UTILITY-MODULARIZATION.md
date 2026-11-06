# INTAKE-155: MCP Utility Modularization & Samaelian Utility Doctrine

## Problem
`eosMcpServer.ts` (~7122 LOC) concentrates ~196 MCP tools in one god-file. Agents on `full` drown in mechanical tool noise. Vanity / ceremonial tools inflate cognitive ego without serving daily control-plane work.

## Intent (Samaelian utility doctrine → engineering)
- **Death of the mechanical ego**: remove vanity from the *default agent path* (`core` <= 30).
- **Conscious vs mechanical**: `core` = conscious useful; `full` = retained compatibility only.
- **Do not accumulate engines for prestige**: modularize the dispatcher; do not invent Level-5 claims.
- Split the MCP god-file into domain facades with **zero behavior change** for retained tools.

## Non-Goals
- Deleting Layer-0 engines wholesale without provenance.
- Claiming PRODUCTION_READY / Level-5.
- Changing Gentle AI co-governance contracts (SPEC-154).

## Success Metrics
1. `eosMcpServer.ts` line count reduced by >= 25% after Phase-1 facade extraction OR dispatch registry hosts >= 10 core handlers outside the god-file.
2. `core` profile remains exactly <= 30 tools.
3. Golden parity: identical JSON results for a fixed set of core tool invocations before/after.
4. `npm run typecheck` exit 0; dedicated BDD-475..478 tests exit 0.
