# TASKS-152: High-Speed AST Code Graph with Tree-sitter WebAssembly Engine

- **Tasks ID**: `TASKS-152`
- **Change ID**: `CHANGE-152`
- **Spec Reference**: `SPEC-290`
- **Plan Reference**: `PLAN-152`
- **Target Module**: `src/core/eosTreeSitterWasmEngine.ts`
- **Status**: `READY`

---

## Task Decomposition Graph (DAG)

```
[TASK-152-01: Spec & Authorizations]
           │
           ▼
[TASK-152-02: Core AST Engine Module]
           │
           ▼
[TASK-152-03: Export Core & Typecheck]
           │
           ▼
[TASK-152-04: CLI Commands & Dispatcher]
           │
           ▼
[TASK-152-05: Documentation & Help Catalog]
           │
           ▼
[TASK-152-06: BDD Test Suite (BDD-1515..1520)]
           │
           ▼
[TASK-152-07: CI/CD Integrity Audit & Release]
```

---

## Atomic Task Checklist

- [ ] **TASK-152-01**: Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [ ] **TASK-152-02**: Author `src/core/eosTreeSitterWasmEngine.ts` conforming to Law V, line ceiling $\le 800$, and zero runtime dependencies.
- [ ] **TASK-152-03**: Export new types and functions in `src/core/index.ts` and verify with `npm run typecheck`.
- [ ] **TASK-152-04**: Author `bin/commands/cliAstEngine.mjs` and connect delegation in `bin/commands/cliDevOps.mjs`.
- [ ] **TASK-152-05**: Register CLI commands in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` (total 402 commands). Verify with `node bin/eos.mjs hygiene:audit`.
- [ ] **TASK-152-06**: Author and run `test/eosTreeSitterWasmEngine.test.mjs` for BDD-1515 through BDD-1520.
- [ ] **TASK-152-07**: Execute full 7-stage CI/CD gate, refresh tip metadata (`node scripts/tip-refresh.mjs`), seal freeze pin, and commit/push.
