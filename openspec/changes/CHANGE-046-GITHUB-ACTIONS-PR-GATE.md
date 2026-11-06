# CHANGE-046 — Native GitHub Actions PR Gate & Check-Runs Attestation Bot

## Intent
Deliver SPEC-053 for EOS v59.0.0: Establish the native GitHub Actions Pull Request Gate (`.github/workflows/eos-gate.yml`), implement the GitHub Check-Runs REST API client with zero external dependencies (`src/core/eosGithubPrGate.ts`), enforce fail-closed contract compatibility pre-merge checks (`SPEC-050`), and emit cryptographic Markdown attestations.

## Modified Components
- `.github/workflows/eos-gate.yml` (NEW: GitHub Actions automated PR gate).
- `src/core/eosGithubPrGate.ts` (NEW: Layer-0 GitHub PR Gate engine).
- `src/mcp/eosMcpToolCatalog.ts` (Register `eos_github_gate` in tool catalog).
- `src/mcp/eosMcpServer.ts` (Handle `eos_github_gate` dispatch).
- `bin/eos.mjs` (Add `eos pr:check` command).
- `test/eosGithubPrGate.test.mjs` (Author BDD-179 through BDD-184 test suite).
- `docs/formal/GithubActionsPrGate.tla` (NEW: TLA+ specification for GitHub Actions PR Gate).
- `scripts/verify-formal-tla.mjs` (Add `verifyGithubActionsPrGateModel`).

## Invariants Preserved
- 0 external runtime npm dependencies (`node:https`, `node:fs`, `node:crypto`).
- Fail-closed security on breaking changes or test failures.
- Deterministic SHA-256 receipts recorded in SQLite WAL ledger.
