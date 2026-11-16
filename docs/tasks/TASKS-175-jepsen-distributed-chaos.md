# TASKS-175 — Jepsen-Grade Distributed Network Partition & Chaos Simulator

- **Specification**: `SPEC-313`
- **Milestone**: `v77.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)

---

## 1. Task DAG

- [x] **Task 1: Intake & Constitutional Authorization**
  - Record `INTAKE-175`, `CHANGE-175`, `SPEC-313`, `PLAN-175`.
  - Append formal Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.

- [ ] **Task 2: TLA+ Formal Verification (Model 57)**
  - Author `docs/formal/JepsenDistributedChaos.tla` and `docs/formal/JepsenDistributedChaos.cfg`.
  - Register in `scripts/run-tlc.mjs`.
  - Run TLC model checker, verify 0 invariant violations, and update `docs/evidence/TLC_RECEIPT.json`.

- [ ] **Task 3: Core Domain Implementation**
  - Author `src/core/eosJepsenDistributedChaos.types.ts`.
  - Author `src/core/eosJepsenDistributedChaos.ts` ($\le 800$ lines, $\ge 12$ lines headroom).
  - Export in `src/core/index.ts`.

- [ ] **Task 4: CLI Dispatcher & Catalog Parity Expansion**
  - Author `bin/commands/cliJepsenDistributedChaos.mjs`.
  - Wire route in `bin/commands/cliToolchainRouter.mjs`.
  - Register commands in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md`.
  - Validate hygiene parity (`node bin/eos.mjs hygiene:audit --json`).

- [ ] **Task 5: Test Suite & Evidence Collection**
  - Author `test/eosJepsenDistributedChaos.test.mjs` (BDD-1653..BDD-1658).
  - Execute test suite and emit signed receipt `docs/evidence/JEPSEN_DISTRIBUTED_CHAOS_RECEIPT.json`.

- [ ] **Task 6: SecDevOps Pipeline & Tip Refresh**
  - Run `npm run tip-refresh`.
  - Run `npx prettier --write` on all touched files.
  - Run full 7-stage CI pipeline (`node scripts/verify-cicd-pipeline.mjs`).
  - Commit, push, and update `walkthrough.md`.
