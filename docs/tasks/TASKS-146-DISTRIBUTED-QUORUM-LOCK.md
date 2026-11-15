# Atomic Tasks DAG: TASKS-146 — Multi-Region Quorum Lease & Distributed Lock Governor

- **Change Reference**: `CHANGE-146`
- **Spec Reference**: `SPEC-284`
- **Plan Reference**: `PLAN-146`
- **Date**: 2026-11-15

---

## Task DAG

```
[T-146-01: Sample Topology] ➔ [T-146-02: Core Lock Governor] ➔ [T-146-03: Export in Core Index]
                                       ↓
                           [T-146-04: Modular CLI Handler]
                                       ↓
                           [T-146-05: Delegate & Register in Help Catalog]
                                       ↓
                           [T-146-06: Unit Test BDD-1479..1484]
                                       ↓
                           [T-146-07: Hygiene Audit & Prettier]
                                       ↓
                           [T-146-08: Seal & Push]
```

## Checklist

- [ ] **T-146-01**: Create `templates/locks/sample-cluster-topology.json`.
- [ ] **T-146-02**: Implement `src/core/eosDistributedLockGovernor.ts` (< 350 lines).
- [ ] **T-146-03**: Export in `src/core/index.ts`.
- [ ] **T-146-04**: Implement `bin/commands/cliDistributedLock.mjs` (< 150 lines).
- [ ] **T-146-05**: Wire delegation in `bin/commands/cliDevOps.mjs`, update `cliHelpCatalog.mjs` & `docs/DEVELOPER_GUIDE.md` (384 commands).
- [ ] **T-146-06**: Write `test/eosDistributedLockGovernor.test.mjs` (BDD-1479..1484).
- [ ] **T-146-07**: Run hygiene audit, typecheck, lint, and prettier.
- [ ] **T-146-08**: Commit, seal freeze pin, and push.
