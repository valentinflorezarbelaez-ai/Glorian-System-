# SPEC-241 — Layer-0 API Contract Semantic Diff Core

## Metadata

- **SPEC ID**: SPEC-241
- **Change ID**: CHANGE-122
- **Intake ID**: INTAKE-122
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosApiContractSemanticDiffCore`

---

## 1. Overview

`EosApiContractSemanticDiffCore` statically extracts public TypeScript exports (functions, interfaces, classes, type aliases, and exported constants) from baseline and candidate source strings and computes semantic compatibility, required semver bump levels, Expand-and-Contract remediation advice, and a deterministic SHA-256 contract diff digest.

---

## 2. Functional Requirements (EARS Syntax)

**FR-241-001** (Event-Driven)
WHEN `extractPublicSymbols(source)` parses a source string, THE SYSTEM SHALL extract exported functions with required parameter arity (excluding parameters marked optional with `?` or initialized with `=`), exported interfaces with required field lists (excluding `?:`), and exported classes, types, and constants.

**FR-241-002** (Event-Driven)
WHEN `compareContracts(input)` compares `baselineSource` against `candidateSource` and detects any removed public symbol (`REMOVED_PUBLIC_SYMBOL`), increased required parameter count (`ARITY_INCREASED_BREAKING`), or removed required interface field (`REMOVED_REQUIRED_FIELD`), THE SYSTEM SHALL mark `backwardCompatible = false`, set `semverBumpRequired = "MAJOR"`, and emit non-empty Expand-and-Contract remediation advice.

**FR-241-003** (State-Driven)
WHILE `breakingChanges` is empty and at least one new exported symbol or non-breaking field addition is present (`ADDITIVE_NON_BREAKING`), THE SYSTEM SHALL set `backwardCompatible = true` and `semverBumpRequired = "MINOR"`.

**FR-241-004** (Ubiquitous)
THE SYSTEM SHALL set `semverBumpRequired = "PATCH"` when no breaking or additive symbol deltas exist, deep-freeze all returned structures, and compute a repeatable 64-hex `contractDiffDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1226 — Additive Public Symbol Marked Backward Compatible MINOR

```gherkin
SCENARIO: Detect additive public symbol export without breaking baseline callers
  GIVEN baseline exports function computeScore(id: string)
  AND candidate retains computeScore(id: string) and adds export function computeDigest(id: string)
  WHEN EosApiContractSemanticDiffCore.compareContracts executes
  THEN backwardCompatible is true, semverBumpRequired is "MINOR", and additiveChanges records ADDITIVE_NON_BREAKING
```

### BDD-1227 — Removed Public Function Flagged Breaking MAJOR

```gherkin
SCENARIO: Flag removal of an exported function as MAJOR breaking change
  GIVEN baseline exports computeScore and verifyToken
  AND candidate removes verifyToken
  WHEN EosApiContractSemanticDiffCore.compareContracts executes
  THEN breakingChanges includes REMOVED_PUBLIC_SYMBOL for verifyToken, backwardCompatible is false, and semverBumpRequired is "MAJOR"
```

### BDD-1228 — Increased Required Arity Flagged Breaking MAJOR

```gherkin
SCENARIO: Flag adding a required function parameter as ARITY_INCREASED_BREAKING
  GIVEN baseline exports issueReceipt(id: string) with 1 required parameter
  AND candidate defines issueReceipt(id: string, tenantId: string) with 2 required parameters
  WHEN EosApiContractSemanticDiffCore.compareContracts executes
  THEN breakingChanges includes ARITY_INCREASED_BREAKING for issueReceipt and semverBumpRequired is "MAJOR"
```

### BDD-1229 — Removed Required Interface Field Flagged With Expand-and-Contract Guidance

```gherkin
SCENARIO: Flag removal of a required interface field and emit remediation
  GIVEN baseline exports interface ShipVerdict { id: string; score: number }
  AND candidate removes field score from ShipVerdict
  WHEN EosApiContractSemanticDiffCore.compareContracts executes
  THEN breakingChanges includes REMOVED_REQUIRED_FIELD for ShipVerdict and expandAndContractAdvice includes deprecation remediation
```

### BDD-1230 — Identical Contracts Yield PATCH And Repeatable SHA-256 Digest

```gherkin
SCENARIO: Yield PATCH semver bump and identical digests for unchanged contracts
  GIVEN identical baselineSource and candidateSource strings
  WHEN EosApiContractSemanticDiffCore.compareContracts runs twice
  THEN semverBumpRequired is "PATCH", backwardCompatible is true, and both contractDiffDigestSha256 values are 64-hex and equal
```
