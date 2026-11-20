# TASKS-238: Quant Cockpit, Second-59.8 Trigger & Walk-Forward Calibrator DAG

**Spec Target:** SPEC-376 / CHANGE-238  
**Gate:** Level 3 Authorization Gate

---

## Task DAG

1. **Task 1: Specification & Authorization Package** — Author `INTAKE-238`, `CHANGE-238`, `SPEC-376`, `PLAN-238`, `TASKS-238`, and append `AUTH-2026-11-20-QUANT-COCKPIT-WALK-FORWARD` to `IMPLEMENTATION_AUTHORIZATION.md`.
2. **Task 2: Formal Verification (TLA+ Model 119)** — Author `QuantCockpitWalkForwardEngine.tla`/`.cfg`, wire into `scripts/run-tlc.mjs`, verify 81/81 TLC specs pass.
3. **Task 3: Pure Layer-0 Core & Barrel Consolidation** — Implement `eosQuantCockpitWalkForwardEngine.types.ts`, `eosQuantCockpitWalkForwardEngine.ts`, and `eosTradingSuiteBarrel.ts`, updating `src/core/index.ts` and `eosSpecDriftDetector.ts`.
4. **Task 4: CLI Cockpit Commands, Help Catalog & MCP Wiring** — Implement `cliQuantCockpitWalkForwardEngine.mjs` (`cockpit`, `trigger`, `walkforward`, `cockpit-audit`), update `cliHelpCatalog.mjs`, register `eos_quant_cockpit_walk_forward_audit`.
5. **Task 5: BDD Verification Suite (`BDD-2041..BDD-2048`)** — Author and pass `test/eosQuantCockpitWalkForwardEngine.test.mjs`, TypeScript check, `mcp:verify`, and `hygiene:audit`.
6. **Task 6: Tip Refresh, Seal Pin & Push** — Run 7-stage pre-push SecDevOps gate to `origin/main`.
7. **Task 7: Live IQ Option Snapshot Cockpit Run & Report** — Execute Cockpit against live 153-asset IQ Option snapshot and report to Architect.
