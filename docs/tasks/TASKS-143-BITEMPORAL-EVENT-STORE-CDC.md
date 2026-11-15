# TASKS-143: Bitemporal Event Store & CDC Execution DAG

## Big Tech Event Sourcing & CDC Architecture (SPEC-281)

---

```mermaid
flowchart TD
    T143_01[TASK-143-01: Intake, Change, Spec, Plan, Tasks] --> T143_02[TASK-143-02: Sample Bitemporal Event Stream Template]
    T143_02 --> T143_03[TASK-143-03: Layer-0 Core Event Store & CDC Implementation]
    T143_03 --> T143_04[TASK-143-04: Export Core in src/core/index.ts]
    T143_04 --> T143_05[TASK-143-05: CLI Dispatcher cliEventStore.mjs & cliDevOps.mjs]
    T143_05 --> T143_06[TASK-143-06: Help Catalog & Developer Guide 375 Commands]
    T143_06 --> T143_07[TASK-143-07: Unit Test Suite test/eosBitemporalEventStore.test.mjs]
    T143_07 --> T143_08[TASK-143-08: Verification, Tip-Refresh, Commit, Seal & Push]
```

### Task Checklist

- [x] **TASK-143-01**: Record Intake, Change proposal, Formal Spec-281 (EARS FR-281-01..06, BDD-1461..1466), Architecture Plan, Tasks DAG.
- [ ] **TASK-143-02**: Author compliant sample bitemporal event stream in `templates/events/sample-bitemporal-event-stream.json`.
- [ ] **TASK-143-03**: Implement pure Layer-0 `src/core/eosBitemporalEventStore.ts`.
- [ ] **TASK-143-04**: Export `EosBitemporalEventStore` and types from `src/core/index.ts`.
- [ ] **TASK-143-05**: Implement `bin/commands/cliEventStore.mjs` and wire delegation into `bin/commands/cliDevOps.mjs`.
- [ ] **TASK-143-06**: Update `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` for 375 commands parity.
- [ ] **TASK-143-07**: Implement test suite `test/eosBitemporalEventStore.test.mjs` covering BDD-1461..1466.
- [ ] **TASK-143-08**: Run verification, hygiene audit, tip-refresh, commit, seal pin, and push.
