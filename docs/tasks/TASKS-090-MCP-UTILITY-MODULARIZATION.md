# TASKS-090: MCP Utility Modularization

- [x] T1 Author INTAKE/SPEC/CHANGE/PLAN/auth entry for SPEC-155
- [x] T2 Add `eosMcpUtilityDoctrine.ts` (UTILITARIAN | RETAINED_COMPAT | CEREMONIAL)
- [x] T3 Add `eosMcpDispatchRegistry.ts`
- [x] T4 Extract Phase-1 core utilitarian handlers (>=8) and wire into `EosMcpServer.dispatchTool`
- [x] T5 Add BDD-475..478 tests and run typecheck + targeted node:test
- [x] T6 Phase-2: migrate next utilitarian batch (>=7) via `eosMcpPhase2UtilitarianHandlers.ts` (tmr/audit/validate/optimize/blast/code-graph/openspec)
- [ ] T7 Later: split full-profile domain bundles; measure LOC reduction >= 25%; delete dead god-file cases after parity soak
