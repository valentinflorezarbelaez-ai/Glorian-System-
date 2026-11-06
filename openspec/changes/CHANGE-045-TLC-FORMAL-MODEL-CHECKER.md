# CHANGE-045 — Leslie Lamport TLC Formal Model Checker & Exhaustive State Space Verification

## Intent
Deliver SPEC-052 for EOS v58.0.0: Integrate the official Leslie Lamport TLC Model Checker (`tla2tools.jar`) with dual-mode execution (TLC model check when Java runtime is present; hermetic bounded JS simulation fallback when offline) and SQLite WAL ledger recording.

## Modified Components
- `src/core/eosTlcFormalChecker.ts` (NEW: Layer-0 TLC formal model checking engine).
- `src/mcp/eosMcpToolCatalog.ts` (Register `eos_tlc_checker` in tool catalog).
- `src/mcp/eosMcpServer.ts` (Handle `eos_tlc_checker` dispatch).
- `bin/eos.mjs` (Add `eos tlc [check|status|install]` command).
- `test/eosTlcFormalChecker.test.mjs` (Author BDD-173 through BDD-178 test suite).
- `docs/formal/TlcFormalModelChecker.tla` (NEW: TLA+ specification for TLC dual-mode checker).
- `scripts/verify-formal-tla.mjs` (Add `verifyTlcFormalModelCheckerModel`).

## Invariants Preserved
- 0 external runtime npm dependencies.
- Node 24 strip-only TypeScript execution.
- Deterministic cryptographic receipts (SHA-256).
