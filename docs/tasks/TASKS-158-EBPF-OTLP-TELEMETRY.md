# TASKS-158: eBPF Kernel Probe Telemetry & Zero-Dependency Native OTLP Gateway

- **Tasks ID**: `TASKS-158`
- **Change ID**: `CHANGE-158`
- **Spec Reference**: `SPEC-296`
- **Plan Reference**: `PLAN-158`
- **Target Module**: `src/core/eosEbpfOtlpTelemetryGovernor.ts`
- **Status**: `READY`

---

## Task Decomposition Graph (DAG)

```
[TASK-158-01: Spec & Level 3 Authorization]
           │
           ▼
[TASK-158-02: Types & Core eBPF OTLP Engine]
           │
           ▼
[TASK-158-03: Export Core & Verify Typecheck]
           │
           ▼
[TASK-158-04: CLI Commands & Toolchain Router Delegation]
           │
           ▼
[TASK-158-05: Documentation & Help Catalog (423 Commands)]
           │
           ▼
[TASK-158-06: BDD Test Suite (BDD-1551..1556)]
           │
           ▼
[TASK-158-07: CI/CD Integrity Audit & Cryptographic Seal]
```

---

## Atomic Task Checklist

- [ ] **TASK-158-01**: Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [ ] **TASK-158-02**: Author `src/core/eosEbpfOtlpTelemetryGovernor.types.ts` and `src/core/eosEbpfOtlpTelemetryGovernor.ts` adhering to Law V, line ceiling $\le 800$, and zero runtime dependencies.
- [ ] **TASK-158-03**: Export new types and functions in `src/core/index.ts` and verify with `npm run typecheck`.
- [ ] **TASK-158-04**: Author `bin/commands/cliEbpfOtlpGovernor.mjs` and connect delegation in `bin/commands/cliToolchainRouter.mjs`.
- [ ] **TASK-158-05**: Register CLI commands in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` (total 423 commands). Verify with `node bin/eos.mjs hygiene:audit`.
- [ ] **TASK-158-06**: Author and run `test/eosEbpfOtlpTelemetryGovernor.test.mjs` for BDD-1551 through BDD-1556.
- [ ] **TASK-158-07**: Execute verification, refresh tip metadata (`node scripts/tip-refresh.mjs`), seal freeze pin, and commit/push.
