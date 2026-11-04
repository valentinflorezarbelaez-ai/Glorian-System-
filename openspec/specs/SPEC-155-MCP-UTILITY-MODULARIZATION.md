# SPEC-155: MCP Utility Modularization & Conscious Tool Surface

## 1. Specification Metadata
- **Specification ID**: `SPEC-155`
- **Status**: `APPROVED`
- **Related Specs**: `SPEC-044` (anti-bloat profiles), `SPEC-140` (MCP transport), `SPEC-154` (Gentle co-governance)
- **Module Target**: `src/mcp/eosMcpServer.ts`, `src/mcp/eosMcpToolCatalog.ts`, `src/mcp/eosMcpDispatchRegistry.ts`, `src/mcp/eosMcpUtilityDoctrine.ts`, `src/mcp/tools/*`, `test/eosMcpUtilityModularization.test.mjs`
- **Doctrine (engineering translation of Samaelian discrimination)**: Prefer conscious useful tools; keep mechanical/vanity tools off the default agent path; modularize without ceremonial inflation.

---

## 2. Functional Requirements (EARS)

- **FR-501 (Ubiquitous / Utility doctrine)**: `THE SYSTEM SHALL classify every MCP tool as UTILITARIAN (conscious default), RETAINED_COMPAT (full-only compatibility), or CEREMONIAL (full-only vanity), and SHALL expose UTILITARIAN tools on the core profile only.`

- **FR-502 (Ubiquitous / Core ceiling)**: `THE SYSTEM SHALL keep the core MCP profile at most 30 tools (BDD-129 / SPEC-044), all UTILITARIAN.`

- **FR-503 (Event-Driven / Dispatch registry)**: `WHEN tools/call invokes a tool registered in EosMcpDispatchRegistry, THE SYSTEM SHALL execute the facade handler and return a result semantically identical to the pre-modularization dispatcher for that tool name and arguments.`

- **FR-504 (State-Driven / Progressive extraction)**: `WHILE modularizing eosMcpServer.ts, THE SYSTEM SHALL keep unmigrated tools on the legacy switch path and SHALL NOT break tools/list or tools/call for either core or full profiles.`

- **FR-505 (Error / Fail-closed unknown)**: `IF tools/call names an unknown tool, THEN THE SYSTEM SHALL reject with JSON-RPC error without mutating workspace state.`

- **FR-506 (Ubiquitous / Epistemic honesty)**: `THE SYSTEM SHALL NOT claim Level 5, absolute perfection, or production readiness solely from modularization.`

---

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: BDD-475 Utility doctrine classifies core tools as UTILITARIAN
  GIVEN eosMcpUtilityDoctrine and CORE_TIER0_TOOL_NAMES
  WHEN every core tool name is classified
  THEN class equals UTILITARIAN
  AND CORE_TIER0_TOOL_NAMES.size is <= 30

SCENARIO: BDD-476 Dispatch registry hosts migrated core handlers
  GIVEN EosMcpDispatchRegistry populated by the Phase-1 core facade bundle
  WHEN registry.has is called for each migrated tool name
  THEN it returns true
  AND migrated count is >= 8

SCENARIO: BDD-477 Core tools/list parity after modularization
  GIVEN EosMcpServer profile core
  WHEN tools/list is requested
  THEN tools length equals CORE_TIER0_TOOL_NAMES.size
  AND every listed name is UTILITARIAN

SCENARIO: BDD-478 Migrated tool call parity smoke
  GIVEN EosMcpServer profile core
  WHEN eos_turbo_verify is invoked via tools/call
  THEN success is true
  AND epistemicState is LOCAL_CHECKS_PASSED
```
