# SPEC-234 — Layer-0 Jarvis Autonomous SDLC Orchestrator, Enterprise DNA Assimilation & Spotify Backstage Golden Path Engine

## Metadata

- **SPEC ID**: SPEC-234
- **Change ID**: CHANGE-119
- **Intake ID**: INTAKE-119
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosJarvisSdlcOrchestratorCore`

---

## 1. Overview

`EosJarvisSdlcOrchestratorCore` provides an autonomous, specification-driven SDLC orchestrator in pure Layer-0 TypeScript:

1. **Enterprise DNA Assimilation**: Models organizational engineering standards (`"spotify"`, `"nubank"`, `"google"`, `"generic-enterprise"`) including Squad/Tribe ownership, Trunk-Based Development branch lifetime limits, Feature Flag gating, Testing Honeycomb/Pyramid focus, Beyoncé Rule coverage minimums, and Hexagonal Architecture isolation rules.
2. **Ticket-to-Contract Initiation**: Converts any Jira/Linear/GitHub ticket into a bounded `JarvisMissionState` with formal EARS requirements, Gherkin BDD scenarios, impacted Hexagonal layers, a dark-launch Feature Flag key, short-lived branch slug, and isolated `.worktrees/<workflowId>` path.
3. **Bounded FDIR Verification & Healing Loop**: Evaluates execution metrics (`testsPassed`, `totalTests`, `coveragePercent`, `domainImportsInfrastructure`, `plainSecretsCount`, `runtimeDependenciesCount`, `lintErrorsCount`), generating surgical remediation diagnostics (`"HEALING"`) for bounded retries and failing closed to `"FAILED"` when `attempt >= maxAttempts`.
4. **Backstage & Fleet Soundcheck Synthesis**: Evaluates 4 Soundcheck pillars (Hexagonal isolation, zero plain secrets, SLSA Layer-0 purity, Beyoncé coverage >= threshold), generates a valid Backstage `catalog-info.yaml` descriptor, seals a 64-hex SHA-256 `--confirm-diff` approval hash, and produces a 3-bullet executive summary and PR markdown draft.
5. **Unified IDE Autopilot Rule Compilation**: Generates `.eos/rules/jarvis-autopilot.md` with cross-IDE bindings (Cursor, Antigravity, Claude Code, Kiro) and optional bounded persistence inside the repository root.

---

## 2. Functional Requirements (EARS Syntax)

**FR-234-001** (Event-Driven)
WHEN `assimilateCompanyDna(options)` is invoked with a supported `CompanyPresetId` (`"spotify"`, `"nubank"`, `"google"`, or `"generic-enterprise"`), THE SYSTEM SHALL synthesize a deterministic `CompanyDnaProfile` defining team topology, Git branching strategy, max branch lifetime hours, Feature Flag policy, testing model, minimum coverage threshold, supported stacks, Hexagonal isolation rules, AND compute a 64-hex SHA-256 `dnaDigestSha256`.

**FR-234-002** (Event-Driven)
WHEN `initiateMission(directive)` is invoked with a non-empty bounded `ticketId`, `ticketTitle`, and `ticketDescription`, THE SYSTEM SHALL assimilate the target `CompanyDnaProfile`, classify the execution track (`"FAST_TRACK_TDD"` or `"HEAVY_TRACK_SDD"`), synthesize formal EARS requirements, Gherkin BDD scenarios, impacted Hexagonal layers, a dark-launch Feature Flag guard, a short-lived branch name, an isolated worktree path, AND return a `JarvisMissionState` in `"AWAITING_IMPLEMENTATION"` status with a deterministic SHA-256 receipt.

**FR-234-003** (Event-Driven)
WHEN `verifyAndHealMission(state, validation)` is invoked and any quality, architectural, security, or coverage gate fails while `state.attempt + 1 < state.maxAttempts`, THE SYSTEM SHALL increment the attempt counter, classify all failing categories, generate surgical remediation steps (`JarvisHealDiagnosis` with `canRetry = true`), AND transition the mission status to `"HEALING"`.

**FR-234-004** (Error / Unwanted Condition)
SI `verifyAndHealMission(state, validation)` detects a failing gate when `state.attempt + 1 >= state.maxAttempts` OR encounters invalid/unbounded mission inputs or security violations (`plainSecretsCount > 0` or `domainImportsInfrastructure === true`) at the terminal retry, ENTONCES THE SYSTEM SHALL fail closed by setting `status = "FAILED"`, `canRetry = false`, AND omitting any approval hash or passing Soundcheck seal.

**FR-234-005** (Ubiquitous)
THE SYSTEM SHALL evaluate the 4-pillar Fleet Soundcheck scorecard (0-100), synthesize a Backstage `catalog-info.yaml` descriptor, emit a 64-hex SHA-256 `approvalDiffSha256` with a 3-bullet executive summary when all gates pass, AND provide `compileAutopilotRulesPackage(options)` to generate `.eos/rules/jarvis-autopilot.md` across Cursor, Antigravity, Claude Code, and Kiro without introducing external runtime dependencies.

---

## 3. Non-Functional Requirements

- **NFR-234-A** Zero external runtime dependencies; `dependencies` in `package.json` must remain `{}`.
- **NFR-234-B** Every function in `src/core/eosJarvisSdlcOrchestratorCore.ts` and `bin/commands/cliJarvisSdlcMesh.mjs` SHALL maintain cyclomatic complexity <= 15.
- **NFR-234-C** All module files SHALL remain strictly <= 800 lines.
- **NFR-234-D** All file write operations (such as `compileAutopilotRulesPackage` with `writeToDisk: true`) SHALL strictly validate path confinement within `projectRoot` and reject traversal outside the repository.
- **NFR-234-E** All ticket inputs SHALL be length-bounded and validated before processing.

---

## 4. BDD Acceptance Scenarios

### BDD-1190 — Spotify & Enterprise DNA Assimilation

```gherkin
SCENARIO: Assimilate Spotify engineering DNA profile with Backstage and Honeycomb defaults
  GIVEN preset "spotify", squadOwner "music-expression-squad", and tribe "music-expression"
  WHEN assimilateCompanyDna is executed
  THEN the profile MUST declare gitStrategy "TRUNK_BASED_DEVELOPMENT" with maxBranchLifetimeHours <= 48
  AND testingModel MUST be "TESTING_HONEYCOMB" with minCoveragePercent >= 85
  AND backstageEnabled MUST be true with a valid 64-hex dnaDigestSha256
```

### BDD-1191 — Ticket-to-SDLC Mission Initiation with Dark-Launch Feature Flag

```gherkin
SCENARIO: Transform an engineering ticket into a formal SDLC mission in isolated worktree
  GIVEN a ticket directive with ticketId "SPOT-402", title, description, and preset "spotify"
  WHEN initiateMission is executed
  THEN status MUST be "AWAITING_IMPLEMENTATION"
  AND track MUST be classified deterministically ("FAST_TRACK_TDD" or "HEAVY_TRACK_SDD")
  AND earsRequirements, bddScenarios, impactedLayers, and featureFlagGuard MUST be populated
  AND worktreePath MUST target ".worktrees/" with a valid 64-hex receiptSha256
```

### BDD-1192 — Bounded FDIR Self-Healing Loop on Test or Boundary Failures

```gherkin
SCENARIO: Detect failing gates on attempt 1 and emit structured healing diagnosis
  GIVEN a mission in "AWAITING_IMPLEMENTATION" with maxHealAttempts = 3
  WHEN verifyAndHealMission receives coveragePercent 72 and domainImportsInfrastructure true
  THEN status MUST transition to "HEALING" at attempt 1
  AND lastDiagnosis.canRetry MUST be true
  AND failureCategories MUST include "BEYONCE_COVERAGE_BELOW_THRESHOLD" and "HEXAGONAL_BOUNDARY_VIOLATION"
  AND approvalDiffSha256 MUST remain undefined
```

### BDD-1193 — Fail-Closed Terminal Escalation at Max Heal Attempts

```gherkin
SCENARIO: Escalate to FAILED when retries reach maxAttempts with open violations
  GIVEN a mission with attempt = 2 and maxAttempts = 3
  WHEN verifyAndHealMission receives plainSecretsCount = 1
  THEN status MUST transition to "FAILED" at attempt 3
  AND lastDiagnosis.canRetry MUST be false
  AND approvalDiffSha256 MUST remain undefined
```

### BDD-1194 — 100/100 Fleet Soundcheck, Backstage Catalog & Approval Diff Synthesis

```gherkin
SCENARIO: Seal mission READY_FOR_APPROVAL with 100/100 Soundcheck and Backstage descriptor
  GIVEN a mission after healing where all tests pass, coverage >= 85%, zero secrets, zero runtime deps, and clean hexagonal boundaries
  WHEN verifyAndHealMission is executed
  THEN status MUST be "READY_FOR_APPROVAL"
  AND soundcheck.passed MUST be true with score 100
  AND soundcheck.backstageCatalogYaml MUST contain "apiVersion: backstage.io/v1alpha1"
  AND approvalDiffSha256 MUST be a 64-hex digest paired with exactly 3 executiveSummaryBullets
```

### BDD-1195 — Unified IDE Autopilot Rule Compilation & Path Confinement

```gherkin
SCENARIO: Compile and optionally write jarvis-autopilot.md across Cursor, Antigravity, Claude, and Kiro
  GIVEN a confined projectRoot and companyPreset "spotify"
  WHEN compileAutopilotRulesPackage is invoked
  THEN targetIdeBindings MUST cover Cursor, Antigravity, Claude Code, and Kiro
  AND markdownContent MUST reference Layer-0 purity, EARS/BDD, and --confirm-diff approval
  AND path traversal outside projectRoot MUST be rejected fail-closed
```
