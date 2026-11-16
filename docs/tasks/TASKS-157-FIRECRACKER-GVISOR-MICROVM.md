# TASKS-157: MicroVM Hardware Sandboxing via Firecracker & gVisor (runsc)

- **Tasks ID**: `TASKS-157`
- **Change ID**: `CHANGE-157`
- **Spec Reference**: `SPEC-295`
- **Plan Reference**: `PLAN-157`
- **Target Module**: `src/core/eosFirecrackerMicroVmEngine.ts`
- **Status**: `READY`

---

## Task Decomposition Graph (DAG)

```
[TASK-157-01: Spec & Level 3 Authorization]
           │
           ▼
[TASK-157-02: Types & Core MicroVM Engine]
           │
           ▼
[TASK-157-03: Export Core & Verify Typecheck]
           │
           ▼
[TASK-157-04: CLI Commands & Toolchain Router Delegation]
           │
           ▼
[TASK-157-05: Documentation & Help Catalog (419 Commands)]
           │
           ▼
[TASK-157-06: BDD Test Suite (BDD-1545..1550)]
           │
           ▼
[TASK-157-07: CI/CD Integrity Audit & Cryptographic Seal]
```

---

## Atomic Task Checklist

- [ ] **TASK-157-01**: Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [ ] **TASK-157-02**: Author `src/core/eosFirecrackerMicroVmEngine.types.ts` and `src/core/eosFirecrackerMicroVmEngine.ts` adhering to Law V, line ceiling $\le 800$, and zero runtime dependencies.
- [ ] **TASK-157-03**: Export new types and functions in `src/core/index.ts` and verify with `npm run typecheck`.
- [ ] **TASK-157-04**: Author `bin/commands/cliMicroVmEngine.mjs` and connect delegation in `bin/commands/cliToolchainRouter.mjs`.
- [ ] **TASK-157-05**: Register CLI commands in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` (total 419 commands). Verify with `node bin/eos.mjs hygiene:audit`.
- [ ] **TASK-157-06**: Author and run `test/eosFirecrackerMicroVmEngine.test.mjs` for BDD-1545 through BDD-1550.
- [ ] **TASK-157-07**: Execute full 7-stage CI/CD gate, refresh tip metadata (`node scripts/tip-refresh.mjs`), seal freeze pin, and commit/push.
