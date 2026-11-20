# CHANGE-238: Quant Cockpit, Second-59.8 Atomic Trigger & Walk-Forward Calibrator

**Spec Target:** `SPEC-376`  
**Intake:** `INTAKE-238`  
**Plan:** `PLAN-238`  
**Tasks:** `TASKS-238`  
**TLA+ Formal Model:** Model 119 (`docs/formal/QuantCockpitWalkForwardEngine.tla`)  
**Status:** PROPOSED_AND_AUTHORIZED

---

## Summary of Change

Introduces `EosQuantCockpitWalkForwardEngine` in Layer-0 (`src/core/`), consolidating:

1. Unbounded dynamic ingestion and categorization of all live IQ Option MCP assets (`153+` across 6 categories) and raw `{ open, max, min, close, from, to }` candles.
2. Institutional 6-factor elite trader funnel rejecting manipulation spikes, noise, and negative expected value below break-even, electing at most one Top-1 Sniper at `60s` expiry.
3. Improvement B: Atomic Second-59.8 / 00 boundary trigger with strict clock-drift and network-latency aborts.
4. Improvement C: Walk-Forward Quarter-Kelly stake calibrator (`0.5%..2.0%`), Zero-Martingale clamp, and Alpha-Decay `< 52%` quarantine.
5. Improvement D: Bloomberg-style Live Antigravity Cockpit HUD (`toolchain:trading:cockpit`) and non-vacuous MCP audit (`eos_quant_cockpit_walk_forward_audit`).
6. Consolidates `SPEC-371..SPEC-376` re-exports into `src/core/eosTradingSuiteBarrel.ts` and condenses `toolchain:trading:*` help lines in `bin/commands/cliHelpCatalog.mjs` to preserve `SPEC-250` `MinHeadroom >= 12` discipline.
