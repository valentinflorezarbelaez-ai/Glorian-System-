# SPEC-378: Goal-Driven Development Loop, Immutable Verifier Guard, Parallel Worktree Software Factory & 3-Gate Pre-PR Engine

**Status**: `APPROVED`
**Version:** 1.0.0  
**Phase:** 8 (Layer-0 Pure Agentic Harness & Software Factory Governance)  
**TLA+ Model:** Model 121 (`docs/formal/GoalDrivenFactory.tla`)  
**Merge Gate:** `npm run verify:strict`

---

## 1. Scope & Functional Requirements (EARS)

### FR-378-01: Output Goal Contract Validator & Outcome Separation

- **WHEN** a `GoalContractInput` (`goalId`, `kind`, `description`, `metricName`, `operator`, `threshold`, `unit`, `verifyCommand`, `maxAttempts`, `maxDurationMs`, `maxCostUsd`, optional `outcomeFollowUp`) is validated via `validateGoalContract()`, **THE SYSTEM** shall reject (`valid: false`, `verdict: "REJECTED_VAGUE_GOAL"`) any contract containing vague prose indicators (`improve`, `better`, `faster`, `cleaner`, `optimize`, `good`, `nice`), non-finite `threshold`, empty `metricName` or `verifyCommand`, missing or non-positive execution caps (`maxAttempts`, `maxDurationMs`, `maxCostUsd`), or `kind === "OUTCOME"` without an accompanying verifiable `OUTPUT` verification contract (and when `outcomeFollowUp` is supplied, require `reviewAfterDays >= 15` while setting `sameDayClosable: false`).

### FR-378-02: Immutable Verifier Integrity & Anti-Cheating Guard

- **WHEN** a candidate implementation change set (`changedFiles`, optional `protectedPaths`, optional `beforeDigests` and `afterDigests`) is inspected by `verifyVerifierIntegrity()`, **THE SYSTEM** shall block (`verdict: "HARD_BLOCK_TAMPERED"`, `verifierIntact: false`) whenever any modified file matches `DEFAULT_PROTECTED_VERIFIER_PATHS` (`test/**`, `.github/workflows/**`, `scripts/verify-*.mjs`, `docs/specs/**`, `openspec/specs/**`, test runner configs) or custom `protectedPaths`, OR whenever any tracked digest in `afterDigests` differs from `beforeDigests`; otherwise **THE SYSTEM** shall return `verdict: "VERIFIER_INTACT"` with a 64-character SHA-256 attestation.

### FR-378-03: Bounded Output-Driven Verification Loop Engine

- **WHEN** `runBoundedGoalLoop()` evaluates a `GoalContractInput`, a `VerifierIntegrityInput`, and ordered `GoalAttemptRecord[]` entries against hard execution bounds (`maxAttempts`, `maxDurationMs`, `maxCostUsd`, optional `maxTotalTokens`), **THE SYSTEM** shall halt immediately with `status: "HALTED_INVALID_GOAL"` if the goal contract fails `FR-378-01`, halt with `status: "HALTED_VERIFIER_TAMPERED"` if any attempt triggers `FR-378-02`, halt with `status: "GOAL_MET"` (`deliveryClassification: "OUTPUT_VERIFIED"`, `outcomeVerified: false`) on the first attempt whose `commandExitCode === 0` and `observedValue` satisfies `compareGoalMetric(operator, threshold)` within budget, or halt with `status: "HALTED_BUDGET_EXHAUSTED"` naming the exhausted cap (`ATTEMPTS`, `DURATION`, `COST`, `TOKENS`, or `NO_PASSING_ATTEMPT`) and a complete audit `attemptLedger`.

### FR-378-04: Parallel Software Factory Disjoint Worktree & Budget Planner

- **WHEN** `planSoftwareFactoryRun()` schedules a batch of `FactoryTaskSpec[]` across up to `maxConcurrency` concurrent workers with `totalMaxCostUsd`, **THE SYSTEM** shall validate every task's goal contract, reject (`verdict: "CONFLICT_BLOCKED"`) any collision in `worktreePath`, `branchName`, or overlapping `editSurfacePaths`, reject (`verdict: "FACTORY_BUDGET_EXCEEDED"`) if the sum of task `maxCostUsd` caps exceeds `totalMaxCostUsd`, and otherwise return `verdict: "READY_FOR_FACTORY"` with conflict-free deterministic parallel `waves`.

### FR-378-05: Three-Gate Pre-PR Readiness Evaluator (Critical-Only Blocking)

- **WHEN** `evaluatePrePrGates()` inspects unit + E2E test execution (`unitTestsPassed`, `e2eTestsPassed`, `testsExecuted`), adversarial review (`implementerAgentId`, `reviewerAgentId`, `findings[]`), and `/verify` completeness (`verifyCommandExecuted`, `verifierIntact`, `incompleteTasks`), **THE SYSTEM** shall return `verdict: "READY_FOR_PR"` (`readyForPr: true`) if and only if all three gates pass (both unit and E2E tests executed and passed, an independent reviewer `reviewerAgentId !== implementerAgentId` found `0` `critical` issues, and `verifierIntact === true` with `incompleteTasks === 0`), while preserving `warning` and `suggestion` findings in `nonBlockingFindings` without blocking PR creation.

### FR-378-06: Non-Vacuous Invariant Audit & Hermetic SHA-256 Receipt Generation

- **WHEN** `EosGoalDrivenFactoryCore.audit()` is invoked, **THE SYSTEM** shall run live deterministic checks across all five core invariants (`vagueGoalRejected`, `verifierTamperBlocked`, `boundedLoopHaltsOnBudget`, `parallelFactoryDisjointEnforced`, `prePrGatesCriticalOnlyVerified`), compute a 64-character SHA-256 receipt hash, and persist the receipt via `resolveEvidencePath("GOAL_DRIVEN_FACTORY_RECEIPT.json", projectRoot)`.

---

## 2. BDD Acceptance Criteria (BDD-2057..BDD-2064)

### BDD-2057: Goal Contract Validator Rejects Vague Prose & Separates Outcome Review

- **GIVEN** a vague goal contract `"improve list performance"` lacking numeric threshold, `verifyCommand`, or cost cap, alongside a well-formed output contract (`latencyMs < 200`, `verifyCommand: "node scripts/bench-list.mjs"`, `maxAttempts: 4`, `maxDurationMs: 120000`, `maxCostUsd: 2.5`),
- **WHEN** `validateGoalContract()` evaluates both contracts (and checks `kind: "OUTCOME"` with `reviewAfterDays: 3`),
- **THEN** the vague contract returns `verdict: "REJECTED_VAGUE_GOAL"` (`valid: false`), `reviewAfterDays < 15` is flagged as invalid same-day outcome closure, and the concrete output contract returns `verdict: "VALID"` with `sameDayClosable: true`.

### BDD-2058: Immutable Verifier Guard Blocks Test & Workflow Tampering

- **GIVEN** an implementation diff touching `test/eosCore.test.mjs` and `.github/workflows/eos-sovereign-cicd.yml` or mutating a protected `beforeDigests` hash,
- **WHEN** `verifyVerifierIntegrity()` inspects the diff alongside a clean `src/core/billing.ts` diff,
- **THEN** the protected-path and digest-drift diffs return `verdict: "HARD_BLOCK_TAMPERED"` (`verifierIntact: false`), while `src/core/billing.ts` returns `verdict: "VERIFIER_INTACT"` with a 64-character SHA-256 `attestationHash`.

### BDD-2059: Bounded Output Loop Converges on Pass & Halts Fail-Closed on Budget

- **GIVEN** a bounded `GoalContractInput` with `maxAttempts: 3`, `maxCostUsd: 1.50` evaluated first against failing+passing attempts within budget and second against attempts exhausting `maxCostUsd`,
- **WHEN** `runBoundedGoalLoop()` executes both traces,
- **THEN** the converging trace halts with `status: "GOAL_MET"` and `outcomeVerified: false` (`deliveryClassification: "OUTPUT_VERIFIED"`), while the runaway trace halts with `status: "HALTED_BUDGET_EXHAUSTED"` and non-empty `attemptLedger` explaining attempted probes.

### BDD-2060: Parallel Software Factory Rejects Shared Worktrees & Plans Disjoint Waves

- **GIVEN** two factory tasks targeting overlapping `worktreePath`, `branchName`, or `editSurfacePaths`, and three disjoint tasks with bounded costs under `maxConcurrency: 2`,
- **WHEN** `planSoftwareFactoryRun()` evaluates both batches,
- **THEN** the colliding batch returns `verdict: "CONFLICT_BLOCKED"` naming the exact collision, while the disjoint batch returns `verdict: "READY_FOR_FACTORY"` partitioned into deterministic parallel `waves` respecting `maxConcurrency`.

### BDD-2061: Three-Gate Pre-PR Evaluator Blocks Critical/Same-Agent Reviews While Allowing Warnings

- **GIVEN** a delivery where unit + E2E tests ran and passed, `verifierIntact: true`, `incompleteTasks: 0`, reviewed by an independent agent: Case A has `0` critical findings and `2` warnings/suggestions, Case B has `1` critical finding, and Case C uses `reviewerAgentId === implementerAgentId`,
- **WHEN** `evaluatePrePrGates()` inspects all three cases,
- **THEN** Case A returns `verdict: "READY_FOR_PR"` (`readyForPr: true`) with `nonBlockingFindings.length === 2`, while Case B and Case C return `verdict: "BLOCKED"` (`readyForPr: false`).

### BDD-2062: CLI Toolchain Handlers Execute Cleanly Under `toolchain:gdd:*`

- **GIVEN** the CLI dispatcher `bin/commands/cliGoalDrivenFactory.mjs`,
- **WHEN** `toolchain:gdd:goal`, `toolchain:gdd:verifier`, `toolchain:gdd:loop`, `toolchain:gdd:factory`, `toolchain:gdd:gates`, and `toolchain:gdd:audit` are invoked via `bin/eos.mjs` with `--json`,
- **THEN** every command emits valid JSON and exits cleanly with code `0`.

### BDD-2063: TLA+ Model 121 (`GoalDrivenFactory.tla`) Formally Registered & Verified

- **GIVEN** `docs/formal/GoalDrivenFactory.tla` and `.cfg` registered in `scripts/run-tlc.mjs`,
- **WHEN** `GoalDrivenFactory` is checked by TLC / bounded formal checks,
- **THEN** all safety invariants (`TypeOK`, `SafetyNoReadyOnVagueGoal`, `SafetyNoReadyOnTamperedVerifier`, `SafetyNoReadyWithoutPrePrGates`, `SafetyBudgetBounded`) hold with `0` violations.

### BDD-2064: Hermetic SHA-256 Audit Receipt & Phase-8 MCP Registration

- **GIVEN** `EosGoalDrivenFactoryCore` and `PHASE8_TOOL_DEFINITIONS`,
- **WHEN** `eos_goal_driven_factory_audit` is invoked with `EOS_EVIDENCE_DIR` configured or default root,
- **THEN** it returns `status: "VERIFIED"`, all 5 invariant booleans `true`, a 64-character SHA-256 `receiptHash`, and writes `resolveEvidencePath("GOAL_DRIVEN_FACTORY_RECEIPT.json", projectRoot)`.
