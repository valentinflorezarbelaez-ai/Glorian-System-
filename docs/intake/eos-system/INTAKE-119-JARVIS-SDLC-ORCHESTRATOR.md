# INTAKE-119 — Layer-0 Jarvis Autonomous SDLC Orchestrator, Enterprise DNA Assimilation & Spotify Backstage Golden Path Engine

## Metadata

- **Intake ID**: INTAKE-119
- **Date**: 2026-11-13
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: APPROVED
- **Target SPEC**: SPEC-234
- **Target Change**: CHANGE-119

---

## 1. Problem Statement

Engineering across top-tier technology companies (such as Spotify, Nubank, Google, and Stripe) and high-velocity client teams requires strictly adapting to each organization's engineering handbook, Git workflow, testing philosophy, observability standards, and architectural boundaries:

1. **Fragmented IDE & Agent Execution**: Switching between Cursor, Antigravity, Claude Code, and Kiro without a unified specification-first autopilot rulebook produces Spec Drift, inconsistent PR hygiene, and broken architectural boundaries.
2. **Lack of Structured Enterprise DNA Assimilation**: Autonomous coding agents frequently ignore organization-specific practices—such as Spotify's Squad/Tribe ownership, Trunk-Based Development (short-lived branches <= 24-48h), dark-launched Feature Flags, the Testing Honeycomb, the Beyoncé Rule ("if you liked it, you should have put a test on it"), Backstage `catalog-info.yaml` descriptors, and Fleet Soundcheck quality gates.
3. **Unbounded Ticket-to-PR Execution**: Turning an unstructured Jira, Linear, or GitHub ticket into a verified, zero-regression Pull Request requires deterministic orchestration: translating the ticket into EARS/BDD contracts, establishing isolated worktree paths, enforcing bounded FDIR self-healing on verification failures, and producing a cryptographic approval digest (`--confirm-diff`) with an executive summary.

---

## 2. Solution Overview

`EosJarvisSdlcOrchestratorCore` implements a deterministic Layer-0 orchestration state machine with zero external runtime dependencies:

1. **Enterprise DNA Assimilation (`assimilateCompanyDna`)**: Synthesizes deterministic organizational profiles for `"spotify"`, `"nubank"`, `"google"`, and `"generic-enterprise"` (with optional local repository manifest scanning), emitting a canonical `CompanyDnaProfile` with Git strategy, Feature Flag rules, Testing Honeycomb/Pyramid thresholds, Hexagonal layer isolation rules, and a SHA-256 DNA fingerprint.
2. **Ticket-to-SDLC Mission Initiation (`initiateMission`)**: Converts any Jira/Linear/GitHub ticket into a `JarvisMissionState` containing formal EARS requirements, Gherkin BDD acceptance scenarios, impacted Hexagonal layers (blast radius), a dark-launch Feature Flag contract, short-lived branch naming, and an isolated `.worktrees/<workflowId>` path.
3. **Bounded FDIR Verification & Self-Healing (`verifyAndHealMission`)**: Evaluates validation metrics (tests passed, >= 85% coverage, Hexagonal domain isolation, zero plain secrets, zero external runtime dependencies, zero lint errors), emitting a structured `JarvisHealDiagnosis` for `"HEALING"` retries up to `maxAttempts` (default `3`), and failing closed to `"FAILED"` when retries are exhausted.
4. **Spotify Backstage Golden Path & Executive PR Synthesis**: When all gates pass, computes a 4-pillar Fleet Soundcheck scorecard (0-100), synthesizes a Backstage `catalog-info.yaml` descriptor, seals a 64-hex SHA-256 `--confirm-diff` approval hash, and generates a 3-bullet executive summary and PR draft.
5. **Unified IDE Autopilot Rule Compiler (`compileAutopilotRulesPackage`)**: Compiles deterministic `.eos/rules/jarvis-autopilot.md` directives with bindings for Cursor, Antigravity, Claude Code, and Kiro.

---

## 3. Scope and Deliverables

- `src/core/eosJarvisSdlcOrchestratorCore.types.ts`
- `src/core/eosJarvisSdlcOrchestratorCore.ts`
- `test/eosJarvisSdlcOrchestratorCore.test.mjs` (`BDD-1190`..`BDD-1195`)
- `bin/commands/cliJarvisSdlcMesh.mjs`
- Wiring in `bin/commands/cliPlatform.mjs`
- Wiring in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts` and `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
- Subpath exports `"./jarvis-sdlc"` and `"./autopilot"` in `package.json` and barrel exports in `src/core/index.ts`
- Developer Guide Module 49 (`docs/DEVELOPER_GUIDE.md`)
- OpenSpec catalog update (`docs/specs/openspec-catalog-index.json`) and freeze gate refresh (`scripts/tip-refresh.mjs`)
