# PLAN-045: Leslie Lamport TLC Formal Model Checker & Exhaustive State Space Verification

## Architecture Decision Record: ADR-058
- **Title**: Dual-Mode TLC Formal Verification Engine with Hermetic Bounded JS Fallback
- **Status**: ACCEPTED
- **Context**: EOS maintains 17 formal `.tla` specifications. Full exhaustive state space exploration requires Leslie Lamport's official TLC Model Checker (`tla2tools.jar`), but developer workstations and lightweight edge environments may not have Java installed.
- **Decision**:
  1. Implement `EosTlcFormalChecker` in `src/core/eosTlcFormalChecker.ts` using native Node APIs (`node:child_process`, `node:fs`, `node:https`, `node:crypto`).
  2. Implement dual-mode detection: if `java` is found and `tla2tools.jar` is located, invoke full TLC CLI; otherwise execute bounded JS simulation while reporting explicit epistemic status `TLC_RUNTIME_UNAVAILABLE_FALLBACK_BOUNDED_JS`.
  3. Provide native HTTPS download of `tla2tools.jar` to `./tools/` on demand.
  4. Seal each execution with 64-char SHA-256 receipts and persist in durable SQLite WAL ledger.
- **Consequences**:
  - Positive: Guarantees highest formal mathematical rigor when Java is present without breaking CI/CD or local test suites when Java is absent.
  - Zero external runtime npm dependencies preserved.
