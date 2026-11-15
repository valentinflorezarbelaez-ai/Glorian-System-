# Atomic Tasks DAG: TASKS-147 — Distributed Deadlock Detection & Wait-For Graph (WFG) Cycle Governor

- **Change Reference**: `CHANGE-147`
- **Spec Reference**: `SPEC-285`
- **Plan Reference**: `PLAN-147`
- **Date**: 2026-11-15

---

## Task DAG

```
[T-147-01: Sample WFG Data] ➔ [T-147-02: Core Deadlock Governor] ➔ [T-147-03: Export in Core Index]
                                       ↓
                           [T-147-04: Modular CLI Handler]
                                       ↓
                           [T-147-05: Delegate & Register in Help Catalog]
                                       ↓
                           [T-147-06: Unit Test BDD-1485..1490]
                                       ↓
                           [T-147-07: Hygiene Audit & Prettier]
                                       ↓
                           [T-147-08: Seal & Push]
```

## Checklist

- [ ] **T-147-01**: Create `templates/concurrency/sample-deadlock-wfg.json`.
- [ ] **T-147-02**: Implement `src/core/eosDeadlockDetectionGovernor.ts` (< 350 lines).
- [ ] **T-147-03**: Export in `src/core/index.ts`.
- [ ] **T-147-04**: Implement `bin/commands/cliDeadlock.mjs` (< 150 lines).
- [ ] **T-147-05**: Wire delegation in `bin/commands/cliDevOps.mjs`, update `cliHelpCatalog.mjs` & `docs/DEVELOPER_GUIDE.md` (387 commands).
- [ ] **T-147-06**: Write `test/eosDeadlockDetectionGovernor.test.mjs` (BDD-1485..1490).
- [ ] **T-147-07**: Run hygiene audit, typecheck, lint, and prettier.
- [ ] **T-147-08**: Commit, seal freeze pin, and push.
