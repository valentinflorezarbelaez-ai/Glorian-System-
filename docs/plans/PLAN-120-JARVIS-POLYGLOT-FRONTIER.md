# PLAN-120 — Architecture & Implementation Plan (`SPEC-235`, `SPEC-236`, `SPEC-237`)

## Metadata

- **Plan ID**: PLAN-120
- **Change ID**: CHANGE-120
- **Specs**: SPEC-235, SPEC-236, SPEC-237
- **Date**: 2026-11-13
- **Status**: APPROVED

---

## 1. Architecture Design

All three engines reside in pure Layer-0 (`src/core/`) with zero runtime dependencies (`dependencies: {}`), composable directly with `SPEC-234` (`EosJarvisSdlcOrchestratorCore`):

1. **`EosPolyglotToolchainAdapterCore` (`SPEC-235`)**: Pure ecosystem matrix lookup + path-confined manifest inspection + deterministic regex log normalization outputting `JarvisValidationInput`.
2. **`EosIssueToPrCanaryBridgeCore` (`SPEC-236`)**: Pure ticket parser + Hexagonal layer/diff blast-radius & SQL DDL Expand-and-Contract auditor + 4-stage Canary & Blameless Postmortem compiler.
3. **`EosStaffEngineerAdversarialJudgeCore` (`SPEC-237`)**: Pure 6-pillar scoring engine split across two adversarial Staff Engineer personas (`JudgeAlpha` and `JudgeBeta`) with fail-closed blocking rules.
4. **CI/CD Hygiene**: Extend `scripts/tip-refresh.mjs` to auto-sync `AGENTS.md` OpenSpec count and `docs/specs/openspec-catalog-index.json` prior to commit, and update `scripts/verify-cicd-pipeline.mjs` + `.githooks/pre-push` so push-time PTS covers recently committed files without multi-hour full-coverage stalls locally (while keeping opt-in `EOS_FULL_PREPUSH=1` for complete runs).

---

## 2. Architectural Decision Records (ADRs)

### ADR-120-001: Deterministically Parse Multi-Language Logs Offline Without Bundling Foreign Toolchains

- **Decision**: Support Maven Surefire, Gradle, Go test/coverage, Pytest, Cargo test, and Node/TS via zero-dependency adapters and bounded regex normalization into `JarvisValidationInput`.
- **Rejected Alternative**: Spawning external package-manager binaries dynamically inside `src/core/`, which violates Layer-0 deterministic portability and creates flakiness when foreign compilers are absent.

### ADR-120-002: Enforce Beyoncé Rule & Expand-and-Contract Migration Checks Deterministically on Diff Metadata

- **Decision**: Treat missing test-layer entries when production layers change, or destructive SQL (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, non-default `NOT NULL`), as explicit `blockingRisks` in `DiffAndMigrationAuditReport`.
- **Rejected Alternative**: Leaving DDL safety to prose checklists only.

### ADR-120-003: Split Staff Engineer Evaluation Into Dual Personas (`JudgeAlpha` vs `JudgeBeta`)

- **Decision**: Compute independent verdicts for Architecture/Resilience (`JudgeAlpha`: idempotency, resilience, migration safety) and Security/Operability (`JudgeBeta`: observability, security/privacy, testing honeycomb), failing closed to `BLOCKED` if either detects critical flags or sub-70 scores.
- **Rejected Alternative**: Averaging all 6 pillars into one scalar score that could mask critical plain-secret or migration failures behind high scores elsewhere.

### ADR-120-004: Sync `AGENTS.md` and `openspec-catalog-index.json` in `tip-refresh.mjs` & Fast PTS Pre-Push Default

- **Decision**: Run catalog index export and `AGENTS.md` OpenSpec count update inside `scripts/tip-refresh.mjs` before sealing commits, and configure `.githooks/pre-push` with PTS commit-diff fallback (`HEAD~2..HEAD`) + `SKIP_COVERAGE=1` by default (overridable via `EOS_FULL_PREPUSH=1`).
- **Rejected Alternative**: Leaving `verify-cicd-pipeline.mjs` to run full uncached 1678-second V8 coverage sweeps and dirty `AGENTS.md`/`openspec-catalog-index.json` after every push.
