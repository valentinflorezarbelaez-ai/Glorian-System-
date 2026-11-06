# INTAKE-045: Leslie Lamport TLC Formal Model Checker & Exhaustive State Space Verification

## 1. Context & Business Intent
To achieve Level 5 Universal Sovereign standard (Leslie Lamport / AWS Automated Reasoning / NASA formal methods), EOS System must evolve beyond bounded JavaScript simulations into direct execution of the official Leslie Lamport TLC Model Checker (`tla2tools.jar`). When Java and `tla2tools.jar` are present (such as in automated CI/CD runners or developer workstations with JDK), the system performs exhaustive state-space model checking (`-modelcheck -deadlock`). When offline or running in minimal host environments lacking Java, the system transparently falls back to hermetic in-memory bounded JS simulations, reporting explicit epistemic status (`TLC_RUNTIME_UNAVAILABLE_FALLBACK_BOUNDED_JS`) and preserving 100% CI pass safety.

## 2. Invariants & Constraints
- **Layer-0 Purity**: 0 external runtime npm dependencies; Node 24 native APIs only (`node:child_process`, `node:fs`, `node:https`, `node:crypto`).
- **Dual-Mode Execution**:
  1. Full TLC execution if `java` and `tla2tools.jar` are accessible.
  2. Hermetic bounded JS simulation fallback if Java runtime is missing.
- **Fail-Closed Security**: Invariant violations caught by TLC or fallback simulator halt execution and record forensic traces in SQLite WAL ledger.
- **Cryptographic Receipting**: SHA-256 sealed attestation for every model checked.
