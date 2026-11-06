# TASKS-039: ENTERPRISE MULTI-PROJECT WORKSPACE GOVERNOR (v52.0.0)

* **Specification**: `SPEC-046`
* **Plan**: `PLAN-039` (`ADR-052`)

## Atomic Task DAG

- [x] **T-039-1**: Author constitutional specification package (`INTAKE-039`, `SPEC-046`, `CHANGE-039`, `PLAN-039` / `ADR-052`, `TASKS-039`) and record `LEVEL 3` authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
  - *Done Criteria*: All 6 artifacts exist in standard English with formal EARS requirements (`FR-142`..`FR-146`) and Gherkin BDD scenarios (`BDD-138`..`BDD-142`).
- [x] **T-039-2**: Author TLA+ formal specification `docs/formal/EnterpriseWorkspaceGovernor.tla` and wire deterministic bounded JS simulation `verifyEnterpriseWorkspaceGovernorModel()` into `scripts/verify-formal-tla.mjs`.
  - *Done Criteria*: `node scripts/verify-formal-tla.mjs` passes all 12 bounded JS simulations (`2,600` steps) with 0 invariant violations.
- [x] **T-039-3**: Implement Layer-0 `src/core/eosEnterpriseWorkspaceGovernor.ts` (`inspectWorkspace`, `onboardWorkspace`, `resolveAuthorizedWorkspace`, `verifyWorkspace`, `listRegisteredWorkspaces`) with Design-by-Contract guards, symlink immunity, and `EosDurableSqliteLedger` integration.
  - *Done Criteria*: `npm run typecheck` passes with 0 errors and `0` runtime npm dependencies.
- [x] **T-039-4**: Expose MCP tool `eos_enterprise_workspace` in `src/mcp/eosMcpToolCatalog.ts` (`core` profile + MCP `2025-03-26` `ToolAnnotations`) and `src/mcp/eosMcpServer.ts`, plus CLI commands `eos project [list|inspect|onboard|verify]` in `bin/eos.mjs` and `package.json` (`v52.0.0`).
  - *Done Criteria*: CLI and MCP endpoints inspect registered fleet projects cleanly and enforce Law IV barriers.
- [x] **T-039-5**: Author BDD test suite `test/eosEnterpriseWorkspaceGovernor.test.mjs` (`BDD-138`..`BDD-142`), run full 7-stage `npm run test` (`53` suites, `12` TLA+ models), publish Big-Tech Whitepaper artifact, record Engram memory, commit, and push `v52.0.0` to `origin/main`.
  - *Done Criteria*: 7/7 SecDevOps stages exit `0` and `origin/main` is updated.
