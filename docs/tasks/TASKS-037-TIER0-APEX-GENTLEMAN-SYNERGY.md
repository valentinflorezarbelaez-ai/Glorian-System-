# TASKS-037: ATOMIC TASK DAG — EOS v50.0.0 TIER-0 & GENTLEMAN STACK CO-GOVERNANCE

- [x] **T-037-1**: Formalize `INTAKE-037`, `SPEC-044`, `CHANGE-037`, `PLAN-037` (`ADR-050`), `GentlemanEosSynergyMesh.tla`, and `AUTH-2026-10-30-TIER0-APEX-GENTLEMAN-SYNERGY-044` (`LEVEL 3`).
  - *Done Criteria*: Complete specification package present and authorized.
- [x] **T-037-2**: Register `verifyGentlemanEosSynergyMeshModel()` in `scripts/verify-formal-tla.mjs`.
  - *Done Criteria*: `node scripts/verify-formal-tla.mjs` passes 10/10 bounded JS simulations.
- [x] **T-037-3**: Install `gentle-ai` (`v4.3.1`) via Go 1.27.1 and `gga` (`v2.10.1`) via Git Bash `install.sh` on Windows User `PATH`; configure `.gga` and `.atl/skill-registry.md`; vendor official `agent-teams-lite` skills (`sdd-*`, `judgment-day`, `skill-registry`, `branch-pr`, `issue-creation`, `go-testing`) + `eos-gentleman-synergy` into `.agents/skills/`.
  - *Done Criteria*: `gentle-ai --version`, `engram version`, and `gga --version` all succeed; all skills pass Stage 1 regular-file & zero-secret checks.
- [x] **T-037-4**: Implement `src/core/eosDurableSqliteLedger.ts` (`node:sqlite` WAL + FTS5 + SHA-256 hash chain), `src/core/eosTypeScriptAstAnalyzer.ts` (dual-engine TS Compiler & State-Machine Token AST analyzer), and `src/core/eosGentlemanStackBridge.ts` (6-pillar EOS + Gentleman co-governance auditor).
  - *Done Criteria*: `0` runtime npm dependencies; `npm run typecheck` passes with `0` errors.
- [x] **T-037-5**: Implement `src/mcp/eosMcpToolCatalog.ts` (`2025-03-26` `ToolAnnotations` + `core`/`full` profiles), fix `resolveProjectPath` confinement in `src/mcp/eosMcpServer.ts`, register `eos_sqlite_ledger`, `eos_ast_analyze`, and `eos_gentleman_audit`, update `scripts/install-antigravity-mcp.mjs` + `bin/eos.mjs` (`ledger`, `ast`, `gentleman`), and bump version to `50.0.0`.
  - *Done Criteria*: `eos antigravity install`, `eos antigravity doctor` (`100/100`), and `eos gentleman doctor` (`100/100`) succeed.
- [x] **T-037-6**: Author `test/eosTier0GentlemanSynergy.test.mjs` covering `BDD-128` through `BDD-132`, run full 7-stage `npm run test` (`51` suites, `10` TLA+ simulations) + `node bin/eos.mjs turbo`, save milestone to `engram` (`mem_save` `id:1125`), commit, and push `v50.0.0` to `origin/main`.
  - *Done Criteria*: 7/7 stages exit 0; Engram + SQLite ledger record sealed; `origin/main` updated cleanly.
