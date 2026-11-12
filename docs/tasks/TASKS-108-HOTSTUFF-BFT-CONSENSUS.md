# TASKS-108: Task Breakdown for Layer-0 HotStuff Pipelined BFT Consensus Core

- **Change ID**: `CHANGE-108`
- **Spec ID**: `SPEC-223`
- **Status**: `IN_PROGRESS`

## Task Checklist

- [x] **Task 1.1**: Author `INTAKE-108-HOTSTUFF-BFT-CONSENSUS.md`.
- [x] **Task 1.2**: Author `CHANGE-108-HOTSTUFF-BFT-CONSENSUS.md`.
- [x] **Task 1.3**: Author `SPEC-223-HOTSTUFF-BFT-CONSENSUS.md` with IEEE 830 EARS and Gherkin BDD.
- [x] **Task 1.4**: Author `PLAN-108-HOTSTUFF-BFT-CONSENSUS.md`.
- [ ] **Task 2.1**: Append Level 2+ implementation authorization `AUTH-2026-11-11-HOTSTUFF-BFT-CONSENSUS-223` in `IMPLEMENTATION_AUTHORIZATION.md`.
- [ ] **Task 2.2**: Implement `src/core/eosHotStuffConsensusEngine.types.ts` ($\le 800$ lines).
- [ ] **Task 2.3**: Implement `src/core/eosHotStuffConsensusEngine.ts` ($\le 800$ lines).
- [ ] **Task 3.1**: Add `"./hotstuff"` subpath export to `package.json` and export in `src/core/index.ts`.
- [ ] **Task 3.2**: Implement `bin/commands/cliHotStuffMesh.mjs` and wire into `cliPlatform.mjs` and `cliKernel.mjs`.
- [ ] **Task 3.3**: Register MCP tools `hotstuff_propose`, `hotstuff_vote`, `hotstuff_status` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
- [ ] **Task 4.1**: Implement comprehensive test suite `test/eosHotStuffConsensusEngine.test.mjs` (BDD-1134..BDD-1138).
- [ ] **Task 4.2**: Add step #35 to `test/eosEnterpriseFacade.test.mjs` ($\le 800$ lines).
- [ ] **Task 4.3**: Update `docs/DEVELOPER_GUIDE.md` (Módulo 38 + CLI table).
- [ ] **Task 4.4**: Export catalog index (218 specs) and update `AGENTS.md`.
- [ ] **Task 4.5**: Run `npm run typecheck`, `npm run lint`, `npx prettier --write`, and `node scripts/repo-health.mjs`.
- [ ] **Task 4.6**: Commit, seal pin, and push to GitHub.
