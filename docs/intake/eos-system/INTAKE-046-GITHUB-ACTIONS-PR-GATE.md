# INTAKE-046: Native GitHub Actions PR Gate & Check-Runs Attestation Bot

## 1. Context & Business Intent
To transform EOS into a Tier-0 Big Tech cloud engineering platform matching Google Piper / Critique and GitHub Enterprise standards, EOS must enforce its 7 SecDevOps quality gates directly within GitHub Pull Requests. When a contributor or agent opens a Pull Request against any EOS repository, GitHub Actions triggers the EOS Sovereign PR Gate workflow. The gate executes all 7 quality dimensions, runs contract compatibility checks against the target base branch, publishes a GitHub Check Run (`EOS Sovereign Gate`) via native Node HTTPS, and formats an authoritative cryptographic Markdown comment with the SHA-256 Ledger attestation.

## 2. Invariants & Constraints
- **Layer-0 Purity**: Zero external runtime npm dependencies (`node:https`, `node:fs`, `node:crypto`).
- **Fail-Closed Gate**: If any test, typecheck, contract contraction, or security rule fails, the Check Run is set to `conclusion: "failure"`, blocking the PR merge.
- **Auditable Markdown Output**: Generates structured Markdown tables for Epistemic Taxonomy, Quality Dimensions, and Cryptographic Attestations.
- **Monotonic Ledger Recording**: Every PR check result is recorded in the durable SQLite WAL ledger under `VERIFICATION_RECEIPT` or `SECURITY_AUDIT`.
