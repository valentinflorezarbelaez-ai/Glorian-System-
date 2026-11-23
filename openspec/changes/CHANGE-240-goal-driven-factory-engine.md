# CHANGE-240: Goal-Driven Development Loop, Immutable Verifier Guard, Parallel Worktree Software Factory & 3-Gate Pre-PR Engine

- **Spec Reference**: `SPEC-378`
- **Intake Reference**: `INTAKE-240`
- **Plan Reference**: `PLAN-240`
- **Tasks Reference**: `TASKS-240`
- **Status**: `APPROVED`
- **Date**: 2026-11-23

## Summary of Change

Introduces five deterministic Layer-0 governance primitives synthesizing **LIDR Agentic Engineer Starter 2027 Module 7 (Goal-Driven Development)**:

1. `src/core/eosGoalDrivenFactoryCore.types.ts` — Pure contracts, default protected verifier paths, deterministic hashing, glob matching, metric comparator, and vague-goal detectors.
2. `src/core/eosGoalDrivenFactoryCore.ts` — Output-driven verifiable goal validator (strictly separating same-day verifiable outputs from 15–30 day business outcomes), Immutable Verifier Integrity & Anti-Cheating Guard, Bounded Output Loop Evaluator (retry/time/cost/token halts), Parallel Disjoint `git worktree` Software Factory Planner, and 3-Gate Pre-PR Readiness Evaluator (tests, independent adversarial reviewer, `/verify` completeness with critical-only blocking).
3. `docs/formal/GoalDrivenFactory.tla` & `.cfg` — Formal TLA+ safety specification (Model 121) proving bounded budgets and unbypassable Pre-PR safety invariants, wired into `scripts/run-tlc.mjs`.
4. `bin/commands/cliGoalDrivenFactory.mjs`, `cliToolchainRouter.mjs`, `cliHelpCatalog.mjs` — CLI surfaces under `toolchain:gdd:*`.
5. Phase-8 MCP audit tool `eos_goal_driven_factory_audit` and `.agents/skills/eos-sdd-pipeline/SKILL.md` Section 6 operational policy.
6. Hermetic BDD test suite `test/eosGoalDrivenFactoryCore.test.mjs` (`BDD-2057..BDD-2064`) using `resolveEvidencePath()`.
