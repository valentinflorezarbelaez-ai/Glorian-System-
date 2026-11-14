# CHANGE-120 — Jarvis Polyglot Toolchain Adapter, Issue-to-PR Canary Bridge, Staff Adversarial Judge & CI/CD Hygiene

## Metadata

- **Change ID**: CHANGE-120
- **Target SPECs**: SPEC-235, SPEC-236, SPEC-237
- **Intake Ref**: INTAKE-120
- **Date**: 2026-11-13
- **Status**: APPROVED
- **Layer**: Layer-0 (Zero external runtime dependencies)

---

## 1. Description

Deliver the enterprise polyglot and release-safety companion triad to `SPEC-234`:

- **Module 50 (`SPEC-235`) — `EosPolyglotToolchainAdapterCore`**: Detects project toolchains (`java-maven`, `java-gradle`, `go`, `python`, `rust`, `typescript-node`) cleanly within `projectRoot`, builds exact build/test/coverage/lint/typecheck/security command matrices and Hexagonal Golden Path layouts, and parses raw CLI test/coverage outputs into canonical `JarvisValidationInput`.
- **Module 51 (`SPEC-236`) — `EosIssueToPrCanaryBridgeCore`**: Normalizes Jira/Linear/GitHub/manual issues into canonical requirements and tracks, audits `git diff` file changes + SQL DDL snippets for Beyoncé Rule and Expand-and-Contract zero-downtime migration safety, and compiles staged Canary rollout/rollback plans.
- **Module 52 (`SPEC-237`) — `EosStaffEngineerAdversarialJudgeCore`**: Simulates dual-judge Big Tech Staff Engineer review (`JudgeAlpha_ArchitectureAndResilience` + `JudgeBeta_SecurityAndOperability`) across 6 reliability/security pillars, yielding deterministic `APPROVED` / `CHANGES_REQUIRED` / `BLOCKED` verdicts with remediation checklists and SHA-256 attestations.
- **Pipeline Hygiene**: Enhance `scripts/tip-refresh.mjs`, `scripts/verify-cicd-pipeline.mjs`, and `.githooks/pre-push` so `AGENTS.md` and `docs/specs/openspec-catalog-index.json` sync cleanly before commit and push-time PTS covers pushed commit diffs swiftly.

---

## 2. Impact Analysis

- **Runtime**: Zero third-party runtime dependencies (`dependencies: {}` in `package.json`).
- **Module Size & MCP Budget**: Keeps Tier-0 core MCP count at `46`, routing new actions through `eosMcpPhase7EnterpriseFrontierHandlersExt2.ts` and keeping every file `<= 800` lines.
- **Compatibility**: Additive subpath exports (`./polyglot`, `./issue-bridge`, `./staff-judge`) and additive CLI commands (`polyglot:*`, `bridge:*`, `staff:*`) preserving full backward compatibility.
