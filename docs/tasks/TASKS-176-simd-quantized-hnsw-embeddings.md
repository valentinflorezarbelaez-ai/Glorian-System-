# TASKS-176 — SIMD Quantized Vector Embedding Engine (i8x16 / f32x4) for Sub-Millisecond HNSW Search

- **Specification**: `SPEC-314`
- **Milestone**: `v78.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)

---

## 1. Task DAG

- [x] **Task 1: Intake & Constitutional Authorization**
  - Record `INTAKE-176`, `CHANGE-176`, `SPEC-314`, `PLAN-176`.
  - Append formal Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.

- [x] **Task 2: TLA+ Formal Verification (Model 58)**
  - Author `docs/formal/SimdQuantizedHnsw.tla` and `docs/formal/SimdQuantizedHnsw.cfg`.
  - Register in `scripts/run-tlc.mjs`.
  - Run TLC model checker, verify 0 invariant violations, and update `docs/evidence/TLC_RECEIPT.json`.

- [x] **Task 3: Core Domain Implementation**
  - Author `src/core/eosSimdQuantizedHnsw.types.ts`.
  - Author `src/core/eosSimdQuantizedHnsw.ts` ($\le 800$ lines, $\ge 12$ lines headroom).
  - Export in `src/core/index.ts`.

- [x] **Task 4: CLI Dispatcher & Catalog Parity Expansion**
  - Author `bin/commands/cliSimdQuantizedHnsw.mjs`.
  - Wire route in `bin/commands/cliToolchainRouter.mjs`.
  - Register commands in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md`.
  - Validate hygiene parity (`node bin/eos.mjs hygiene:audit --json`).

- [x] **Task 5: Test Suite & Evidence Collection**
  - Author `test/eosSimdQuantizedHnsw.test.mjs` (BDD-1659..BDD-1664).
  - Execute test suite and emit signed receipt `docs/evidence/SIMD_QUANTIZED_HNSW_RECEIPT.json`.

- [ ] **Task 6: SecDevOps Pipeline & Tip Refresh**
  - Run `npm run tip-refresh`.
  - Run `npx prettier --write` on all touched files.
  - Run full 7-stage CI pipeline.
  - Commit, push, and update `walkthrough.md`.
