# TASKS-236: Sovereign Autonomous Prop-Firm Trader, Tri-Temporal Fractal Engine & Real-Time WhatsApp Dispatcher

- **Tasks ID**: TASKS-236
- **Related Spec**: SPEC-374
- **Change Ref**: CHANGE-236
- **Status**: IN_PROGRESS

---

## Task Checklist & DAG

- [x] **TASK-236-01**: Ingest context and write intake document (`docs/intake/eos-system/INTAKE-236-TRI-TEMPORAL-PROP-FIRM-WHATSAPP-ENGINE.md`).
- [x] **TASK-236-02**: Formalize OpenSpec change proposal (`openspec/changes/CHANGE-236-tri-temporal-prop-firm-whatsapp-engine.md`).
- [x] **TASK-236-03**: Formalize OpenSpec specification (`openspec/specs/SPEC-374-tri-temporal-prop-firm-whatsapp-engine.md`).
- [x] **TASK-236-04**: Write Architecture Plan and ADRs (`docs/plans/PLAN-236-TRI-TEMPORAL-PROP-FIRM-WHATSAPP-ENGINE.md`).
- [x] **TASK-236-05**: Author Task DAG (`docs/tasks/TASKS-236-TRI-TEMPORAL-PROP-FIRM-WHATSAPP-ENGINE.md`).
- [ ] **TASK-236-06**: Record formal authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [ ] **TASK-236-07**: Write formal TLA+ specification and configuration (`TriTemporalPropFirmEngine.tla`, `TriTemporalPropFirmEngine.cfg`).
- [ ] **TASK-236-08**: Verify TLA+ invariants via TLC model checker (`scripts/run-tlc.mjs`).
- [ ] **TASK-236-09**: Implement domain types and pure core logic in `src/core/eosTriTemporalPropFirmEngine.types.ts` and `src/core/eosTriTemporalPropFirmEngine.ts`.
- [ ] **TASK-236-10**: Re-export in `src/core/index.ts` maintaining $\le 800$ line ceilings.
- [ ] **TASK-236-11**: Implement CLI command handler `bin/commands/cliTriTemporalPropFirmEngine.mjs` and register routes in `cliToolchainRouter.mjs` and `cliHelpCatalog.mjs`.
- [ ] **TASK-236-12**: Register MCP tool `eos_tri_temporal_propfirm_audit` in MCP taxonomy and phase 8 handlers.
- [ ] **TASK-236-13**: Write and execute comprehensive BDD test suite in `test/eosTriTemporalPropFirmEngine.test.mjs`.
- [ ] **TASK-236-14**: Verify full hygiene and release gates, seal freeze pin, and push to GitHub.
