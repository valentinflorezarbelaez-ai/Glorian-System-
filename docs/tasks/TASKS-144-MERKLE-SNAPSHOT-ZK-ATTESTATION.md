# Atomic Tasks DAG: TASKS-144 — Zero-Knowledge State Attestation & Merkle Tree Snapshot Governor

- **Change Reference**: `CHANGE-144`
- **Spec Reference**: `SPEC-282`
- **Plan Reference**: `PLAN-144`
- **Date**: 2026-11-15

---

## Task DAG

```
[T-144-01: Sample Dataset] ➔ [T-144-02: Core Merkle Governor] ➔ [T-144-03: Export in Core Index]
                                       ↓
                           [T-144-04: Modular CLI Handler]
                                       ↓
                           [T-144-05: Delegate & Register in Help Catalog]
                                       ↓
                           [T-144-06: Unit Test BDD-1467..1472]
                                       ↓
                           [T-144-07: Hygiene Audit & Prettier]
                                       ↓
                           [T-144-08: Seal & Push]
```

## Checklist

- [ ] **T-144-01**: Create `templates/snapshots/sample-state-snapshot.json`.
- [ ] **T-144-02**: Implement `src/core/eosMerkleSnapshotGovernor.ts` (< 350 lines).
- [ ] **T-144-03**: Export in `src/core/index.ts`.
- [ ] **T-144-04**: Implement `bin/commands/cliMerkleSnapshot.mjs` (< 150 lines).
- [ ] **T-144-05**: Wire delegation in `bin/commands/cliDevOps.mjs`, update `cliHelpCatalog.mjs` & `docs/DEVELOPER_GUIDE.md` (378 commands).
- [ ] **T-144-06**: Write `test/eosMerkleSnapshotGovernor.test.mjs` (BDD-1467..1472).
- [ ] **T-144-07**: Run hygiene audit, typecheck, lint, and prettier.
- [ ] **T-144-08**: Commit, seal freeze pin, and push.
