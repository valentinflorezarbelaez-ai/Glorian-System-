# TASKS-237: Universal Multi-Asset Universe & Dynamic Payout Optimizer Implementation DAG

**Spec Target:** SPEC-375 / CHANGE-237  
**Gate:** Level 2 Authorization Gate

---

## Task DAG

```text
[Task 1: Intake & Specs Formalization] (COMPLETE)
       │
       ▼
[Task 2: TLA+ Formal Verification (Model 118)]
       │
       ▼
[Task 3: Author Layer-0 Engine & Types]
       │
       ▼
[Task 4: Barrel Exports & CLI Integration]
       │
       ▼
[Task 5: MCP Tool & Schema Validation]
       │
       ▼
[Task 6: BDD Test Suite Execution (BDD-2033..BDD-2040)]
       │
       ▼
[Task 7: Tip-Refresh, SecDevOps 7-Stage Gate & Push]
```

---

## Detailed Task Breakdown

1. **Task 1: Formal Specifications & Intake**
   - Ingest multi-class assets (Forex, Crypto, Commodities, Equities).
   - Define formal EARS requirements (FR-375-01..08) and BDD scenarios (BDD-2033..2040).

2. **Task 2: TLA+ Formal Specification (Model 118)**
   - Author `docs/formal/UniversalAssetPayoutOptimizer.tla` and `.cfg`.
   - Add to `scripts/run-tlc.mjs` and execute TLC formal model checking.

3. **Task 3: Implement Layer-0 Pure Core Engine**
   - Author `src/core/eosUniversalAssetPayoutOptimizerEngine.types.ts`.
   - Author `src/core/eosUniversalAssetPayoutOptimizerEngine.ts` with zero runtime dependencies.
   - Implement round-number relative distance detector, dynamic payout router, and Top-1 election governor.

4. **Task 4: Core Barrel & CLI Toolchain Wiring**
   - Re-export in `src/core/index.ts` maintaining line count $\le 788$.
   - Author `bin/commands/cliUniversalAssetPayoutEngine.mjs`.
   - Register commands in `bin/commands/cliHelpCatalog.mjs` maintaining 100% parity and headroom $\ge 12$.

5. **Task 5: MCP Tool Taxonomy & Handler**
   - Register `"eos_universal_asset_payout_audit"` in taxonomy and dispatch registry.
   - Verify via `npm run mcp:verify`.

6. **Task 6: BDD Test Suite**
   - Author `test/eosUniversalAssetPayoutOptimizerEngine.test.mjs`.
   - Verify BDD-2033..BDD-2040 passing with `node --test`.

7. **Task 7: Seal & Push**
   - Execute `npm run tip-refresh` and `--seal-pin`.
   - Execute `git push origin main` passing 7-stage pre-push gate.
