# SPEC-236 — Layer-0 Issue-to-PR Bridge, Diff Blast-Radius Auditor & Canary Rollback Governor

## Metadata

- **SPEC ID**: SPEC-236
- **Change ID**: CHANGE-120
- **Intake ID**: INTAKE-120
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosIssueToPrCanaryBridgeCore`

---

## 1. Overview

`EosIssueToPrCanaryBridgeCore` provides deterministic parsing of real Jira, Linear, and GitHub issue payloads into SDLC specifications, audits `git diff` file inventories and SQL DDL snippets against the Beyoncé Rule and Expand-and-Contract zero-downtime migration doctrine, and compiles staged Canary rollout/rollback playbooks.

---

## 2. Functional Requirements (EARS Syntax)

**FR-236-001** (Event-Driven)
WHEN `parseIssuePayload(raw)` receives a Jira, Linear, GitHub, or manual issue object, THE SYSTEM SHALL normalize `ticketId`, `title`, `description`, Markdown checklist `acceptanceCriteria`, normalized `priority` (`P0`..`P3`), corresponding `slaHours`, `affectedComponents`, and `suggestedTrack` (`"HEAVY_TRACK_SDD"` vs `"FAST_TRACK_TDD"`) with a 64-hex `issueDigestSha256`.

**FR-236-002** (Event-Driven)
WHEN `analyzeDiffAndMigrationSafety(input)` evaluates `changedFiles` and optional `sqlMigrationSnippet`, THE SYSTEM SHALL map touched files to Hexagonal layers, compute `beyonceRuleSatisfied` (requiring test changes whenever production code changes), classify SQL DDL into `"NONE"`, `"SAFE_EXPAND_AND_CONTRACT"`, or `"UNSAFE_BREAKING_DDL"`, calculate `blastRadiusScore` (0..100), and emit explicit `blockingRisks`.

**FR-236-003** (Error / Unwanted Condition)
IF `sqlMigrationSnippet` contains breaking DDL statements (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `ADD COLUMN ... NOT NULL` without `DEFAULT`) OR production files change without corresponding test files, THEN THE SYSTEM SHALL record concrete `blockingRisks` so pre-PR verification blocks unsafe merges.

**FR-236-004** (Event-Driven)
WHEN `compileCanaryAndRollbackPlan(input)` is invoked for an approved change, THE SYSTEM SHALL output a 4-stage progressive traffic rollout schedule (`1%`, `10%`, `50%`, `100%`), SLO rollback guardrails, exact `killSwitchCommands` tied to the Feature Flag and worktree/branch, a Blameless Postmortem template, and a 64-hex `planDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1201 — Jira, Linear & GitHub Issue Normalization

```gherkin
SCENARIO: Normalize Jira/GitHub payload with checklists and priority into canonical track
  GIVEN a Jira/GitHub issue with key "PAY-881", priority "Critical", and Markdown checklist "- [ ] Validate idempotency key\n- [ ] Emit metrics"
  WHEN parseIssuePayload executes
  THEN priority MUST map to "P1" with slaHours = 24
  AND acceptanceCriteria MUST extract both checklist items
  AND suggestedTrack MUST classify as "HEAVY_TRACK_SDD" with a valid 64-hex issueDigestSha256
```

### BDD-1202 — Beyoncé Rule Enforcement on Production Diffs

```gherkin
SCENARIO: Flag production changes lacking test coverage while passing changes accompanied by tests
  GIVEN a diff modifying "src/core/billingEngine.ts" with zero test files touched
  WHEN analyzeDiffAndMigrationSafety runs
  THEN beyonceRuleSatisfied MUST be false and blockingRisks MUST report missing test coverage
  AND when "test/billingEngine.test.mjs" is included, beyonceRuleSatisfied MUST become true
```

### BDD-1203 — Safe Expand-and-Contract DDL Verification

```gherkin
SCENARIO: Approve additive backward-compatible SQL migrations
  GIVEN a diff modifying a migration file with "ALTER TABLE invoices ADD COLUMN idempotency_key TEXT; CREATE INDEX CONCURRENTLY idx_inv_idem ON invoices(idempotency_key);"
  WHEN analyzeDiffAndMigrationSafety executes
  THEN migrationPattern MUST equal "SAFE_EXPAND_AND_CONTRACT"
  AND unsafeDdlStatements MUST be empty
```

### BDD-1204 — Breaking DDL Rejection (DROP / TRUNCATE / NOT NULL without DEFAULT)

```gherkin
SCENARIO: Flag destructive or lock-inducing DDL statements as unsafe breaking migrations
  GIVEN a SQL snippet containing "ALTER TABLE users DROP COLUMN legacy_pin; ALTER TABLE orders ADD COLUMN region TEXT NOT NULL;"
  WHEN analyzeDiffAndMigrationSafety executes
  THEN migrationPattern MUST equal "UNSAFE_BREAKING_DDL"
  AND unsafeDdlStatements MUST list the breaking statements and populate blockingRisks
```

### BDD-1205 — 4-Stage Canary Rollout & Kill-Switch Compilation

```gherkin
SCENARIO: Compile progressive Canary schedule, SLO thresholds, and emergency rollback commands
  GIVEN ticketId "PAY-881", featureFlagKey "ff_pay_881_idempotency", and 64-hex approvalDiffSha256
  WHEN compileCanaryAndRollbackPlan is invoked
  THEN stages MUST define [1, 10, 50, 100] percent steps
  AND killSwitchCommands MUST expose disableFeatureFlagCmd, gitRevertBranchCmd, and worktreeCleanupCmd
  AND blamelessPostmortemTemplate MUST contain Blameless Postmortem sections with valid planDigestSha256
```
