# TASKS-052: Conscious Witness & Hot-Patching Engine Implementation Checklist

**Specification**: SPEC-059  
**Change Reference**: CHANGE-052  
**Target Version**: 65.0.0  

---

## Task Breakdown (DAG Order)

- [ ] **Task 1: Formal Mathematical TLA+ Model**
  - Author `docs/formal/ConsciousWitnessHotPatching.tla`.
  - Register and simulate in `scripts/verify-formal-tla.mjs` (25th model, 5,200 simulation steps).

- [ ] **Task 2: Core Engine Implementation**
  - Create `src/core/eosConsciousWitness.ts` with intention interrogator, semantic grounding checker, and SHA-384 seal generator.
  - Create `src/core/eosHotPatchEngine.ts` with atomic method re-binder, interface diff verifier, and instant rollback mechanism.
  - Export both in `src/core/index.ts`.

- [ ] **Task 3: MCP Catalog & Server Dispatch**
  - Register `eos_conscious_witness` in `src/mcp/eosMcpToolCatalog.ts` (Tier-0 core profile).
  - Add dispatch handler in `src/mcp/eosMcpServer.ts`.

- [ ] **Task 4: CLI Surface Integration**
  - Wire `eos witness:interrogate` and `eos hotpatch` in `bin/eos.mjs`.

- [ ] **Task 5: Test Suite Authoring**
  - Create `test/eosConsciousWitnessHotPatch.test.mjs` implementing BDD-215 to BDD-220.

- [ ] **Task 6: Verification & Certification**
  - Run `npm run typecheck`.
  - Run `npm test` across all 67 test suites and 25 TLA+ models (7 stages exit code 0).
  - Update `IMPLEMENTATION_AUTHORIZATION.md`, `AGENTS.md`, and `package.json`.
