# INTAKE-120 — Wave CHANGE-120: Polyglot Toolchain Adapter, Issue-to-PR Canary Bridge, Staff Adversarial Judge & CI/CD Hygiene

## Metadata

- **Intake ID**: INTAKE-120
- **Change ID**: CHANGE-120
- **Target Specs**: SPEC-235, SPEC-236, SPEC-237
- **Project**: Glorian System (EOS Control Plane)
- **Date**: 2026-11-13
- **Status**: `INTAKE_COMPLETE`
- **Authorization Level Required**: `LEVEL 3`

---

## 1. Context & Problem Statement

Building on `SPEC-234` (`EosJarvisSdlcOrchestratorCore`), real enterprise adoption across Big Tech and polyglot engineering organizations exposes four remaining operational gaps:

1. **Polyglot Ecosystem Normalization (`SPEC-235`)**: While Glorian natively audits TypeScript/JavaScript repositories, backend squads at Spotify, Nubank, and Google operate heavily in **Java (Maven / Gradle)**, **Go**, **Python**, and **Rust**. Teams need deterministic Layer-0 stack detection, canonical command matrices, Golden Path directory maps, and raw test/coverage parser adapters feeding `JarvisValidationInput`.
2. **Real Ticket Ingestion, Diff Blast-Radius & Canary Rollback (`SPEC-236`)**: Engineers receive structured payloads from Jira, Linear, or GitHub Issues and modify mixes of Domain, Application, Infrastructure, Database DDL, and Test files. The orchestrator must extract acceptance criteria, calculate blast radius, enforce the **Beyoncé Rule** on production code changes, validate **Expand-and-Contract** SQL migrations (zero-downtime DDL), and compile 4-stage Canary rollouts (`1% -> 10% -> 50% -> 100%`) with kill-switch and Blameless Postmortem playbooks.
3. **Dual-Judge Staff Engineer Adversarial Gate (`SPEC-237`)**: Prior to opening a PR or RFC, changes must pass adversarial scrutiny from two specialized architectural personas (**Architecture & Resilience** vs **Security & Operability**) across 6 core production pillars (idempotency/retries, resilience/backpressure, data/migration safety, observability/SLO, security/privacy, testing honeycomb).
4. **CI/CD Pre-Push & Doc-Sync Hygiene**: During `git push`, `scripts/verify-cicd-pipeline.mjs` mutated `AGENTS.md` and `docs/specs/openspec-catalog-index.json` post-commit and ran unfiltered slow full-coverage scans on every local push. Refreshing those artifacts in `scripts/tip-refresh.mjs` and enabling commit-diff PTS selection in `.githooks/pre-push` keeps working trees clean and iteration fast.

---

## 2. Success Criteria

- Zero third-party runtime dependencies (`dependencies: {}`).
- All core modules remain inside `src/core/`, strictly isolated (`import-boundary-gate`), `<= 800` lines per file, and cyclomatic complexity `<= 15` per function.
- Complete BDD test verification (`BDD-1196`..`BDD-1210`) + CLI + MCP facade integration + `eosReleaseDocConsistency.test.mjs` passing with exit code 0.
