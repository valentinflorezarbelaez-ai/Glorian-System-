# SPEC-237 — Layer-0 Staff Engineer Adversarial PR & System Design Dual-Judge

## Metadata

- **SPEC ID**: SPEC-237
- **Change ID**: CHANGE-120
- **Intake ID**: INTAKE-120
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosStaffEngineerAdversarialJudgeCore`

---

## 1. Overview

`EosStaffEngineerAdversarialJudgeCore` subjects pull requests and architectural proposals (RFC/ADR/diff audits) to deterministic adversarial dual-judge inspection modeled after Google Critique / Spotify Golden Path Staff Engineer reviews before merge approval.

---

## 2. Functional Requirements (EARS Syntax)

**FR-237-001** (Event-Driven)
WHEN `evaluateProposalOrPr(input)` is invoked with target metadata, 6-pillar scores (`idempotencyAndRetries`, `resilienceAndBackpressure`, `dataAndMigrationSafety`, `observabilityAndSlo`, `securityAndPrivacy`, `testingHoneycombAndBeyonceRule`), and critical risk flags, THE SYSTEM SHALL compute clamped `[0, 100]` pillar scores and construct dual independent evaluations for `JudgeAlpha_ArchitectureAndResilience` and `JudgeBeta_SecurityAndOperability`.

**FR-237-002** (Error / Unwanted Condition)
IF `plainSecretsDetected`, `unsafeMigrationDetected`, `missingTestsForProdChanges`, or `singlePointOfFailureDetected` is true OR any pillar score falls strictly below `70`, THEN THE SYSTEM SHALL return `verdict = "BLOCKED"` with concrete `blockingFindings` and `requiredRemediations`.

**FR-237-003** (State-Driven)
WHILE no blocking defect is present AND at least one pillar scores strictly between `70` and `84`, THE SYSTEM SHALL return `verdict = "CHANGES_REQUIRED"` listing actionable remediation steps for each sub-threshold pillar.

**FR-237-004** (Ubiquitous)
WHEN all 6 pillars achieve scores `>= 85` with zero critical flags, THE SYSTEM SHALL assign `verdict = "APPROVED"` with both judges passing (`passed: true`) and seal a 64-hex SHA-256 `attestationDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1206 — Clean Staff Approval Across Dual Judges

```gherkin
SCENARIO: Approve production-ready PR when all six Staff pillars score >= 85
  GIVEN pillarScores >= 90 across all six dimensions and zero critical defect flags
  WHEN evaluateProposalOrPr is invoked
  THEN verdict MUST equal "APPROVED"
  AND both judgeAlpha.passed and judgeBeta.passed MUST be true
  AND blockingFindings MUST be empty with a valid 64-hex attestationDigestSha256
```

### BDD-1207 — Actionable Changes Required for Sub-85 Non-Critical Pillars

```gherkin
SCENARIO: Request targeted changes when observability or resilience scores between 70 and 84
  GIVEN observabilityAndSlo = 78 and all other pillars = 92 with zero critical flags
  WHEN evaluateProposalOrPr executes
  THEN verdict MUST equal "CHANGES_REQUIRED"
  AND requiredRemediations MUST prescribe OpenTelemetry spans and SLO burn-rate alerts
```

### BDD-1208 — Fail-Closed Block on Plain Secrets or Unsafe DDL Migration

```gherkin
SCENARIO: Block PR immediately when security secrets or unsafe migrations are flagged
  GIVEN plainSecretsDetected = true OR unsafeMigrationDetected = true
  WHEN evaluateProposalOrPr executes
  THEN verdict MUST equal "BLOCKED"
  AND relevant judge findings MUST identify the critical violation regardless of high default scores
```

### BDD-1209 — Fail-Closed Block on Beyoncé Rule Violation or SPOF

```gherkin
SCENARIO: Block PR when production code lacks tests or introduces a single point of failure
  GIVEN missingTestsForProdChanges = true OR singlePointOfFailureDetected = true
  WHEN evaluateProposalOrPr executes
  THEN verdict MUST equal "BLOCKED"
  AND judgeAlpha or judgeBeta passed flag MUST be false
```

### BDD-1210 — Input Score Clamping & Deterministic Attestation Digest

```gherkin
SCENARIO: Clamp out-of-range scores to [0, 100] and generate repeatable attestation digests
  GIVEN scores outside [0, 100] such as 140 or -20
  WHEN evaluateProposalOrPr runs twice with identical inputs
  THEN normalized pillarScores MUST be clamped to [0, 100]
  AND both runs MUST emit identical 64-hex attestationDigestSha256 values
```
