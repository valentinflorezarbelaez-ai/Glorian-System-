# PLAN-119 — Layer-0 Jarvis Autonomous SDLC Orchestrator & Enterprise DNA Assimilation

## Metadata

- **Plan ID**: PLAN-119
- **Change ID**: CHANGE-119
- **SPEC ID**: SPEC-234
- **Status**: APPROVED
- **Date**: 2026-11-13

## Architecture Decisions

### ADR-119-001: Pure Layer-0 State Machine Separated from Child Process Execution

**Decision**: Implement `EosJarvisSdlcOrchestratorCore` as a pure, deterministic state machine in `src/core/` using only `node:crypto`, `node:fs`, and `node:path`, without executing unguarded shell commands inside core logic.
**Rationale**: Keeps all verification and healing state transitions fast, reproducible, testable in milliseconds without Docker or Git side-effects during unit tests, and 100% compliant with Law V (`dependencies: {}`).
**Rejected**: Embedding direct `execFileSync("git", ...)` or Docker calls inside the core state transitions (couples domain rules to host OS process state and slows verification).

### ADR-119-002: Modular MCP Extension File (`eosMcpPhase7EnterpriseFrontierHandlersExt2.ts`)

**Decision**: Route new MCP actions (`jarvis_dna_assimilate`, `jarvis_sdlc_start`, `jarvis_sdlc_verify`, `jarvis_sync_rules`) through a dedicated extension file `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts` called as a fallback from `eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
**Rationale**: `eosMcpPhase7EnterpriseFrontierHandlersExt.ts` sits at 777 lines, close to the strict 800-line ceiling enforced by `test/eosModuleSizeBudget.test.mjs`. Keeping each module compact prevents budget failures while exposing the new actions under `eos_enterprise_workspace` without breaking the 46-tool Tier-0 core count invariant.
**Rejected**: Appending 150 lines directly into `eosMcpPhase7EnterpriseFrontierHandlersExt.ts` (would breach the 800-line ceiling) or adding top-level tools that invalidate `test/eosMcpSchemaValidator.test.mjs`.

### ADR-119-003: Single-Responsibility Helper Decomposition for Complexity <= 10

**Decision**: Decompose preset lookup, EARS/BDD synthesis, failure diagnosis, Soundcheck scoring, and IDE rule generation into focused pure helper functions.
**Rationale**: Guarantees every function stays well under the `complexity-gate.mjs` ceiling of 15 cyclomatic complexity and improves maintainability.
**Rejected**: Monolithic switch/if-else blocks inside `initiateMission` or `verifyAndHealMission`.

## Implementation Steps

1. Remove accidental nested `Glorian-System-/` duplicate clone directory if present.
2. Create SDD package (`INTAKE-119`, `CHANGE-119`, `SPEC-234`, `PLAN-119`, `TASKS-119`) and record `LEVEL 3` authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
3. Create `src/core/eosJarvisSdlcOrchestratorCore.types.ts` and `src/core/eosJarvisSdlcOrchestratorCore.ts`.
4. Export module in `src/core/index.ts` and add `"./jarvis-sdlc"` and `"./autopilot"` exports in `package.json`.
5. Create `bin/commands/cliJarvisSdlcMesh.mjs` and wire it in `bin/commands/cliPlatform.mjs`.
6. Create `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts` and wire fallback in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
7. Write BDD tests in `test/eosJarvisSdlcOrchestratorCore.test.mjs` (`BDD-1190`..`BDD-1195`) and add step #46 in `test/eosEnterpriseFacade.test.mjs`.
8. Document Module 49 and CLI commands in `docs/DEVELOPER_GUIDE.md`.
9. Regenerate `docs/specs/openspec-catalog-index.json` and run `scripts/tip-refresh.mjs`.
10. Run `typecheck`, `boundary:check`, `complexity:check`, `verify:references`, Prettier checks, and focused test suites.
