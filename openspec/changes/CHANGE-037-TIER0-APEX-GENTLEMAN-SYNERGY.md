# CHANGE-037: EOS TIER-0 PRINCIPAL HARDENING & GENTLEMAN AI STACK CO-GOVERNANCE (v50.0.0)

- **Change ID**: `CHANGE-037`
- **Governing Spec**: `SPEC-044`
- **Target Version**: `50.0.0`
- **Summary**:
  1. Fix MCP path confinement and `process.cwd()` independence across `src/mcp/eosMcpServer.ts` (`eos_refactor_audit`, `eos_refactor_execute`, etc.).
  2. Add `src/mcp/eosMcpToolCatalog.ts` providing official MCP `2025-03-26` `ToolAnnotations` and `core` vs `full` tool profiles (`EOS_MCP_PROFILE`).
  3. Add `src/core/eosDurableSqliteLedger.ts` using Node's built-in `node:sqlite` (`WAL` + `FTS5` + monotonic SHA-256 hash chain, `0` npm dependencies).
  4. Add `src/core/eosTypeScriptAstAnalyzer.ts` using the real TypeScript Compiler AST (`ts.createSourceFile`) for zero-false-positive Layer-0 purity, cyclomatic complexity, and Node 24 strip-only checks.
  5. Add `src/core/eosGentlemanStackBridge.ts`, `.gga`, `.atl/skill-registry.md`, official Gentleman `agent-teams-lite` skills (`sdd-init`..`sdd-archive`, `judgment-day`, `skill-registry`, `branch-pr`, `issue-creation`, `go-testing`), and `.agents/skills/eos-gentleman-synergy/SKILL.md`, while installing `gentle-ai` `v4.3.1` and `gga` `v2.10.1` alongside `engram` `v3.2.1` and `context7` in Antigravity.
