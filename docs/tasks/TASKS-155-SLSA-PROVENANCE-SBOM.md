# TASKS-155: SLSA Level 3/4 Attestations, In-Toto Provenance & Cryptographic SBOM Governor

- **Tasks ID**: `TASKS-155`
- **Change ID**: `CHANGE-155`
- **Spec Reference**: `SPEC-293`
- **Plan Reference**: `PLAN-155`
- **Target Module**: `src/core/eosSlsaProvenanceGovernor.ts`
- **Status**: `READY`

---

## Task Decomposition Graph (DAG)

```
[TASK-155-01: Spec & Level 3 Authorization]
           │
           ▼
[TASK-155-02: Types & Core SLSA Provenance Module]
           │
           ▼
[TASK-155-03: Export Core & Verify Typecheck]
           │
           ▼
[TASK-155-04: CLI Commands & Dispatcher Delegation]
           │
           ▼
[TASK-155-05: Documentation & Help Catalog (411 Commands)]
           │
           ▼
[TASK-155-06: BDD Test Suite (BDD-1533..1538)]
           │
           ▼
[TASK-155-07: CI/CD Integrity Audit & Cryptographic Seal]
```

---

## Atomic Task Checklist

- [ ] **TASK-155-01**: Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [ ] **TASK-155-02**: Author `src/core/eosSlsaProvenanceGovernor.types.ts` and `src/core/eosSlsaProvenanceGovernor.ts` adhering to Law V, line ceiling $\le 800$, and zero runtime dependencies.
- [ ] **TASK-155-03**: Export new types and functions in `src/core/index.ts` and verify with `npm run typecheck`.
- [ ] **TASK-155-04**: Author `bin/commands/cliSlsaGovernor.mjs` and connect delegation in `bin/commands/cliDevOps.mjs`.
- [ ] **TASK-155-05**: Register CLI commands in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` (total 411 commands). Verify with `node bin/eos.mjs hygiene:audit`.
- [ ] **TASK-155-06**: Author and run `test/eosSlsaProvenanceGovernor.test.mjs` for BDD-1533 through BDD-1538.
- [ ] **TASK-155-07**: Execute full 7-stage CI/CD gate, refresh tip metadata (`node scripts/tip-refresh.mjs`), seal freeze pin, and commit/push.
