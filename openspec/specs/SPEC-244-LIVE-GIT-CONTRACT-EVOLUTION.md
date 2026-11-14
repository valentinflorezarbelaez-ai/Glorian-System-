# SPEC-244 — Layer-0 Live Git Contract Evolution Core

## Metadata

- **SPEC ID**: SPEC-244
- **Change ID**: CHANGE-123
- **Intake ID**: INTAKE-123
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosLiveGitContractEvolutionCore`

---

## 1. Overview

`EosLiveGitContractEvolutionCore` audits real TypeScript public API changes across a Git workspace by extracting the baseline file content from `<baseRef>` (`git show <baseRef>:<relPath>`) and comparing it against current workspace content on disk using `EosApiContractSemanticDiffCore`.

---

## 2. Functional Requirements (EARS Syntax)

**FR-244-001** (Event-Driven)
WHEN `auditLiveGitContracts(options)` is invoked with `filePairsOverride` OR against a confined Git workspace under `projectRoot`, THE SYSTEM SHALL compare every baseline/candidate TypeScript pair with `EosApiContractSemanticDiffCore.compareContracts` and aggregate `filesAuditedCount`, `totalBreakingChanges`, and `totalAdditiveChanges`.

**FR-244-002** (Error / Unwanted Condition)
IF `repoPath` resolves outside `projectRoot`, THEN THE SYSTEM SHALL fail closed by throwing `Path traversal outside projectRoot is forbidden`. IF `baseRef` begins with `-` or fails Git reference validation, THEN THE SYSTEM SHALL fail closed by throwing `Unsafe git reference rejected`.

**FR-244-003** (State-Driven)
WHILE any audited file reports a breaking change (`MAJOR`), THE SYSTEM SHALL set `backwardCompatible = false` and `overallSemverBump = "MAJOR"`; else if any additive change exists (`MINOR`), `overallSemverBump = "MINOR"`; otherwise `"PATCH"`.

**FR-244-004** (Ubiquitous)
THE SYSTEM SHALL deduplicate `expandAndContractAdvice`, deep-freeze the full report, and emit a deterministic 64-hex `evolutionDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1241 — Additive Live Contract Evolution Yields MINOR

```gherkin
SCENARIO: Audit additive TypeScript contract change as backward-compatible MINOR
  GIVEN filePairsOverride where src/core/a.ts adds an optional interface property and new exported helper
  WHEN EosLiveGitContractEvolutionCore.auditLiveGitContracts runs
  THEN backwardCompatible is true, overallSemverBump is "MINOR", and totalBreakingChanges is 0
```

### BDD-1242 — Breaking Live Contract Removal Yields MAJOR

```gherkin
SCENARIO: Detect public export removal across modified TypeScript pairs as MAJOR break
  GIVEN filePairsOverride where src/core/a.ts removes a previously exported function
  WHEN EosLiveGitContractEvolutionCore.auditLiveGitContracts runs
  THEN backwardCompatible is false, overallSemverBump is "MAJOR", and totalBreakingChanges >= 1
```

### BDD-1243 — Rejects Path Traversal On repoPath

```gherkin
SCENARIO: Fail closed when repoPath escapes projectRoot
  GIVEN repoPath = "../../external-repo"
  WHEN auditLiveGitContracts executes
  THEN the call throws "Path traversal outside projectRoot is forbidden"
```

### BDD-1244 — Rejects Unsafe Git Base Ref

```gherkin
SCENARIO: Fail closed on option-injection or unsafe characters in baseRef
  GIVEN baseRef = "--exec=rm -rf"
  WHEN auditLiveGitContracts executes
  THEN the call throws "Unsafe git reference rejected"
```

### BDD-1245 — Audits Live Workspace Git State With Repeatable SHA-256 Digest

```gherkin
SCENARIO: Audit live workspace against HEAD and emit repeatable evolutionDigestSha256
  GIVEN repository root and identical filePairsOverride executed twice
  WHEN auditLiveGitContracts runs twice
  THEN both reports produce identical 64-hex evolutionDigestSha256 hashes and live HEAD audit succeeds
```
