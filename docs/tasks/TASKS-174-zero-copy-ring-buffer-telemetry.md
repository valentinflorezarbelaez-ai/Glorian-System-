# TASKS-174 — Zero-Copy Circular Ring-Buffer Telemetry & OTLP Streaming Bridge

- **Specification**: `SPEC-312`
- **Owner**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Status**: `IN_PROGRESS`
- **Date**: 2026-11-16

---

## Atomic Task Breakdown

- [x] **Task 1: Intake & Specifications**
  - Create `INTAKE-174`, `CHANGE-174`, `SPEC-312`, `PLAN-174`.
  - Authorize milestone in `IMPLEMENTATION_AUTHORIZATION.md` (Level 3).

- [ ] **Task 2: TLA+ Formal Verification**
  - Create `docs/formal/ZeroCopyRingBuffer.tla` and `docs/formal/ZeroCopyRingBuffer.cfg`.
  - Register `"ZeroCopyRingBuffer"` in `scripts/run-tlc.mjs`.
  - Run TLC model checker and verify `SafetyInvariant` and `Spec`.

- [ ] **Task 3: Core Implementation**
  - Create `src/core/eosZeroCopyRingBuffer.types.ts`.
  - Create `src/core/eosZeroCopyRingBuffer.ts` with lock-free atomic sequencers, zero-copy slot parsing, and streaming bridge.
  - Export in `src/core/index.ts`.

- [ ] **Task 4: CLI Wiring & Catalog Parity**
  - Create `bin/commands/cliZeroCopyRingBuffer.mjs`.
  - Wire into `bin/commands/cliToolchainRouter.mjs`.
  - Update `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` (`483 -> 488` commands).
  - Verify `hygiene:audit` passes with `HYGIENE_GOVERNED`.

- [ ] **Task 5: Test Suites & Signed Receipt**
  - Create `test/eosZeroCopyRingBuffer.test.mjs` verifying `BDD-1647`..`BDD-1652`.
  - Generate and sign `docs/evidence/ZERO_COPY_RING_BUFFER_RECEIPT.json`.
  - Execute full test suite and verify 0 failures.
