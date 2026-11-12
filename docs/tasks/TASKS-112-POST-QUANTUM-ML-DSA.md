# TASKS-112: Atomic Task DAG for NIST FIPS 204 ML-DSA-65 Implementation

- **Specification**: `SPEC-227`
- **Plan Reference**: `PLAN-112`
- **Change Reference**: `CHANGE-112`

## 1. Task DAG Overview

```
[TASK-112-1: Type Definitions]
          │
          ▼
[TASK-112-2: Ring Arithmetic & Decomposition]
          │
          ▼
[TASK-112-3: Core KeyGen, Sign, Verify Engine]
          │
          ▼
[TASK-112-4: Hybrid Signatures & CLI Handlers]
          │
          ▼
[TASK-112-5: BDD Unit Test Suite (BDD-1154..BDD-1158)]
          │
          ▼
[TASK-112-6: Facade, MCP Registration & OpenSpec Catalog]
          │
          ▼
[TASK-112-7: Documentation, Full Verification & Commit Seal]
```

## 2. Atomic Tasks Checklist

- [ ] **TASK-112-1**: Create `src/core/eosPostQuantumMlDsaCore.types.ts` declaring types for keys, signatures, hints, parameters, and results.
- [ ] **TASK-112-2**: Implement ring arithmetic modulo $q = 8380417$ and decomposition primitives (`power2Round`, `decompose`, `highBits`, `lowBits`, `makeHint`, `useHint`) in `src/core/eosPostQuantumMlDsaCore.ts`.
- [ ] **TASK-112-3**: Implement `ML-DSA-65` KeyGen, Sign (Fiat-Shamir with Aborts), and Verify algorithms conforming to NIST FIPS 204.
- [ ] **TASK-112-4**: Implement composite hybrid Ed25519 + ML-DSA dual signing and create CLI handler `bin/commands/cliMlDsaMesh.mjs`.
- [ ] **TASK-112-5**: Write BDD test suite `test/eosPostQuantumMlDsaCore.test.mjs` verifying BDD-1154 through BDD-1158.
- [ ] **TASK-112-6**: Export types and class in `src/core/index.ts`, register subcommands in `bin/commands/cliPlatform.mjs`, wire MCP actions in `eosMcpPhase7EnterpriseFrontierHandlersExt.ts`, and regenerate catalog.
- [ ] **TASK-112-7**: Update `docs/DEVELOPER_GUIDE.md` (Module 42), run `npm run typecheck`, full `npm test`, format, and seal commit with cryptographic evidence.
