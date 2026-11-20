# TASKS-234: Aladdin Institutional Portfolio & Multi-Factor Risk Engine

- **Tasks ID**: TASKS-234
- **Related Spec**: SPEC-372
- **Change Ref**: CHANGE-234
- **Status**: VERIFIED

---

## Task Checklist & DAG

- [x] **TASK-234-01**: Ingest context and formalize intake document (`docs/intake/eos-system/INTAKE-234-ALADDIN-INSTITUTIONAL-PORTFOLIO-RISK-ENGINE.md`).
- [x] **TASK-234-02**: Formalize OpenSpec change proposal (`openspec/changes/CHANGE-234-aladdin-institutional-portfolio-risk-engine.md`).
- [x] **TASK-234-03**: Formalize OpenSpec specification (`openspec/specs/SPEC-372-aladdin-institutional-portfolio-risk-engine.md`).
- [x] **TASK-234-04**: Write Architecture Plan and ADRs (`docs/plans/PLAN-234-ALADDIN-INSTITUTIONAL-PORTFOLIO-RISK-ENGINE.md`).
- [x] **TASK-234-05**: Author Task DAG (`docs/tasks/TASKS-234-ALADDIN-INSTITUTIONAL-PORTFOLIO-RISK-ENGINE.md`).
- [x] **TASK-234-06**: Record formal authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **TASK-234-07**: Write formal TLA+ specification and configuration (`AladdinPortfolioRiskEngine.tla`, `AladdinPortfolioRiskEngine.cfg`).
- [x] **TASK-234-08**: Verify TLA+ invariants via TLC model checker (`scripts/run-tlc.mjs`).
- [x] **TASK-234-09**: Implement domain types and pure core logic in `src/core/eosAladdinPortfolioRiskEngine.types.ts` and `src/core/eosAladdinPortfolioRiskEngine.ts`.
- [x] **TASK-234-10**: Re-export in `src/core/index.ts` maintaining $\le 800$ line ceilings.
- [x] **TASK-234-11**: Implement CLI command handler `bin/commands/cliAladdinRiskEngine.mjs` and register routes in `cliToolchainRouter.mjs` and `cliHelpCatalog.mjs`.
- [x] **TASK-234-12**: Register MCP tool `eos_aladdin_risk_audit` in MCP taxonomy and phase 8 handlers.
- [x] **TASK-234-13**: Write and execute comprehensive BDD test suite in `test/eosAladdinPortfolioRiskEngine.test.mjs`.
- [x] **TASK-234-14**: Verify full hygiene and release gates, seal freeze pin, and push to GitHub.
