# TASKS-140: OpenTelemetry OTLP Collector Gateway Execution DAG

## Big Tech Distributed Observability Infrastructure (SPEC-278)

---

```mermaid
flowchart TD
    T140_01[TASK-140-01: Intake, Change, Spec, Plan, Tasks] --> T140_02[TASK-140-02: Sample OTLP Traces Template]
    T140_02 --> T140_03[TASK-140-03: Layer-0 Core Collector Gateway Implementation]
    T140_03 --> T140_04[TASK-140-04: Export Core in src/core/index.ts]
    T140_04 --> T140_05[TASK-140-05: CLI Dispatcher cliOtelGateway.mjs & cliDevOps.mjs]
    T140_05 --> T140_06[TASK-140-06: Help Catalog & Developer Guide 366 Commands]
    T140_06 --> T140_07[TASK-140-07: Unit Test Suite test/eosOtlpCollectorGateway.test.mjs]
    T140_07 --> T140_08[TASK-140-08: Verification, Tip-Refresh, Commit, Seal & Push]
```

### Task Checklist

- [x] **TASK-140-01**: Record Intake, Change proposal, Formal Spec-278 (EARS FR-278-01..06, BDD-1443..1448), Architecture Plan, Tasks DAG.
- [ ] **TASK-140-02**: Author compliant sample OTLP trace batch in `templates/otel/sample-otlp-traces.json`.
- [ ] **TASK-140-03**: Implement pure Layer-0 `src/core/eosOtlpCollectorGateway.ts`.
- [ ] **TASK-140-04**: Export `EosOtlpCollectorGateway` from `src/core/index.ts`.
- [ ] **TASK-140-05**: Implement `bin/commands/cliOtelGateway.mjs` and wire delegation into `bin/commands/cliDevOps.mjs`.
- [ ] **TASK-140-06**: Update `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` for 366 commands parity.
- [ ] **TASK-140-07**: Implement test suite `test/eosOtlpCollectorGateway.test.mjs` covering BDD-1443..1448.
- [ ] **TASK-140-08**: Run verification, hygiene audit, tip-refresh, commit, seal pin, and push.
