# PLAN-240: Architecture Plan & ADRs — Goal-Driven Development Loop & Parallel Software Factory (`SPEC-378`)

- **Spec**: `SPEC-378` (`CHANGE-240`)
- **Date**: 2026-11-23
- **Architecture Layer**: Layer-0 Pure Core (`src/core/`), CLI Adapter (`bin/commands/`), MCP Adapter (`src/mcp/tools/`)

---

## 1. Hexagonal Architecture & Module Boundaries

- **Domain / Core (Layer-0 Pure)**:
  - `src/core/eosGoalDrivenFactoryCore.types.ts` (`<= 280` lines): Pure contracts, protected verifier path globs, metric comparison helpers, and SHA-256 utility.
  - `src/core/eosGoalDrivenFactoryCore.ts` (`<= 650` lines): Stateless pure evaluators (`validateGoalContract`, `verifyVerifierIntegrity`, `runBoundedGoalLoop`, `planSoftwareFactoryRun`, `evaluatePrePrGates`), `EosGoalDrivenFactoryCore` static facade, and hermetic `audit()` writing `GOAL_DRIVEN_FACTORY_RECEIPT.json` via `resolveEvidencePath()`.
  - Zero external npm packages (Law V); Node 24 strip-only TypeScript; cyclomatic complexity `<= 15`.
- **Presentation / Adapters**:
  - CLI: `bin/commands/cliGoalDrivenFactory.mjs` routed via `toolchain:gdd:` prefix in `bin/commands/cliToolchainRouter.mjs`.
  - MCP: `eos_goal_driven_factory_audit` registered in `eosMcpToolTaxonomy.ts`, `eosMcpPhase8ToolDefinitions.ts`, and `eosMcpPhase8AgiHandlers.ts`.
  - Skill Policy: `.agents/skills/eos-sdd-pipeline/SKILL.md` Section 6.

---

## 2. Architecture Decision Records (ADRs)

### ADR-240-001: Deterministic Layer-0 GDD Guardrails vs. Prompt-Only Loop Instructions

- **Decision**: Enforce verifiable numeric thresholds, protected verifier path/digest immutability, bounded attempt/time/cost caps, and disjoint worktree wave planning in pure deterministic TypeScript backed by TLA+ Model 121.
- **Rejected Alternative**: Instruct agents in markdown prompts not to touch tests or run past budget.
  - _Reason Rejected_: Probabilistic prompts routinely drift when unattended parallel workers hit stubborn failures, mutating assertions or burning unconstrained cloud token spend.

### ADR-240-002: Explicit Separation Between Same-Day Output Verification and Multi-Week Business Outcomes

- **Decision**: Require every goal loop to close on a measurable **output** contract (`verifyCommand` + numeric metric/threshold + caps), while forcing `kind: "OUTCOME"` contracts to anchor on a concrete output contract and deferring business outcome review (`reviewAfterDays >= 15`, `sameDayClosable: false`, `outcomeVerified: false`).
- **Rejected Alternative**: Allow autonomous coding loops to self-certify business conversion or KPI outcomes on Day 0.
  - _Reason Rejected_: Production conversion requires real user traffic over 15–30 days and belongs to human Product decision-making, not an ungrounded coding loop claim.

### ADR-240-003: Critical-Only Pre-PR Gate Blocking (`READY_FOR_PR` Allows Warnings & Suggestions)

- **Decision**: Block PR readiness exclusively on unexecuted/failing unit+E2E tests, non-independent review (`reviewerAgentId === implementerAgentId`), `critical` review findings, `incompleteTasks > 0`, or tampered verifiers (`verifierIntact === false`), surfacing `warning` and `suggestion` items cleanly in `nonBlockingFindings`.
- **Rejected Alternative**: Block `/verify` loops on all `warning` and `suggestion` comments.
  - _Reason Rejected_: Treating stylistic suggestions as hard blockers triggers infinite cosmetic churn, burning budget without improving correctness or security.
