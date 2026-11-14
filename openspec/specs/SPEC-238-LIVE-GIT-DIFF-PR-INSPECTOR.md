# SPEC-238 — Layer-0 Live Git Diff PR Inspector & Bundle Packager

## Metadata

- **SPEC ID**: SPEC-238
- **Change ID**: CHANGE-121
- **Intake ID**: INTAKE-121
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosLiveGitDiffPrInspectorCore`

---

## 1. Overview

`EosLiveGitDiffPrInspectorCore` executes live inspection of local Git diffs (`numstat` and added lines) inside `projectRoot`, detects leaked credential signatures, runs `EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety` on touched files and SQL DDL, and builds a ready-to-paste PR verification bundle.

---

## 2. Functional Requirements (EARS Syntax)

**FR-238-001** (Event-Driven)
WHEN `inspectLiveGitDiff(options)` is executed on a confined `repoPath` or explicit `numstatOverride`/`patchOverride`, THE SYSTEM SHALL parse changed files (`additions`, `deletions`, `path`), scan added lines for leaked credentials and SQL DDL statements, invoke `analyzeDiffAndMigrationSafety`, and compute `readyToShip` (`secretMatchesCount === 0 && diffAudit.blockingRisks.length === 0`) with a 64-hex `inspectionDigestSha256`.

**FR-238-002** (Error / Unwanted Condition)
IF `repoPath` or `bundleRelPath` resolves outside `projectRoot` via path traversal or invalid resolution, THEN THE SYSTEM SHALL fail closed by throwing `Path traversal outside projectRoot is forbidden`.

**FR-238-003** (Error / Unwanted Condition)
IF added diff lines match leaked credential patterns OR production source modifications omit test files OR destructive SQL DDL appears, THEN THE SYSTEM SHALL set `readyToShip = false` and retain detailed findings in `secretMatchesCount` and `diffAudit.blockingRisks`.

**FR-238-004** (Event-Driven)
WHEN `writeBundle === true`, THE SYSTEM SHALL write `prBundleMarkdown` atomically to the confined target path (default `.eos/pr-ready-bundle.md`) and return `writtenBundlePath`.

---

## 3. BDD Acceptance Scenarios

### BDD-1211 — Clean Numstat & Patch Inspection Marked Ready to Ship

```gherkin
SCENARIO: Inspect clean diff with matching tests and safe SQL as READY TO SHIP
  GIVEN numstat containing "src/core/service.ts" and "test/service.test.mjs" plus additive SQL ADD COLUMN
  WHEN inspectLiveGitDiff executes
  THEN secretMatchesCount MUST be 0
  AND diffAudit.beyonceRuleSatisfied MUST be true
  AND readyToShip MUST be true with a 64-hex inspectionDigestSha256
```

### BDD-1212 — Path Traversal Rejection on repoPath and bundleRelPath

```gherkin
SCENARIO: Reject repository or bundle paths escaping projectRoot
  GIVEN repoPath "../outside-repo" OR bundleRelPath "../../etc/passwd" with writeBundle = true
  WHEN inspectLiveGitDiff runs
  THEN it MUST throw "Path traversal outside projectRoot is forbidden"
```

### BDD-1213 — Detect Credential Pattern on Added Diff Lines

```gherkin
SCENARIO: Block shipping when a synthetic credential token appears on an added patch line
  GIVEN patchOverride containing an added line with a synthetic token matching credential signature
  WHEN inspectLiveGitDiff runs
  THEN secretMatchesCount MUST be >= 1
  AND readyToShip MUST be false
```

### BDD-1214 — Fail Closed on Beyoncé Violation or Breaking DDL in Patch

```gherkin
SCENARIO: Block shipping when patch introduces DROP TABLE or modifies prod files without tests
  GIVEN numstat modifying "src/core/ledger.ts" without tests OR patch adding "DROP TABLE sessions;"
  WHEN inspectLiveGitDiff executes
  THEN readyToShip MUST be false and diffAudit.blockingRisks MUST be non-empty
```

### BDD-1215 — Optional Confined Bundle Persistence

```gherkin
SCENARIO: Persist PR readiness markdown bundle inside confined .eos subpath
  GIVEN writeBundle = true and confined bundleRelPath inside ".eos/"
  WHEN inspectLiveGitDiff completes
  THEN writtenBundlePath MUST resolve inside ".eos/" and contain prBundleMarkdown on disk
```
