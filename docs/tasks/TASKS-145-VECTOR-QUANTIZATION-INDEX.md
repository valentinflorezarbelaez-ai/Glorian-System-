# Atomic Tasks DAG: TASKS-145 — Sharded Vector Indexing & SIMD-Style Quantization Governor

- **Change Reference**: `CHANGE-145`
- **Spec Reference**: `SPEC-283`
- **Plan Reference**: `PLAN-145`
- **Date**: 2026-11-15

---

## Task DAG

```
[T-145-01: Sample Dataset] ➔ [T-145-02: Core Vector Governor] ➔ [T-145-03: Export in Core Index]
                                       ↓
                           [T-145-04: Modular CLI Handler]
                                       ↓
                           [T-145-05: Delegate & Register in Help Catalog]
                                       ↓
                           [T-145-06: Unit Test BDD-1473..1478]
                                       ↓
                           [T-145-07: Hygiene Audit & Prettier]
                                       ↓
                           [T-145-08: Seal & Push]
```

## Checklist

- [ ] **T-145-01**: Create `templates/vectors/sample-embeddings.json`.
- [ ] **T-145-02**: Implement `src/core/eosVectorQuantizationGovernor.ts` (< 350 lines).
- [ ] **T-145-03**: Export in `src/core/index.ts`.
- [ ] **T-145-04**: Implement `bin/commands/cliVectorIndex.mjs` (< 150 lines).
- [ ] **T-145-05**: Wire delegation in `bin/commands/cliDevOps.mjs`, update `cliHelpCatalog.mjs` & `docs/DEVELOPER_GUIDE.md` (381 commands).
- [ ] **T-145-06**: Write `test/eosVectorQuantizationGovernor.test.mjs` (BDD-1473..1478).
- [ ] **T-145-07**: Run hygiene audit, typecheck, lint, and prettier.
- [ ] **T-145-08**: Commit, seal freeze pin, and push.
