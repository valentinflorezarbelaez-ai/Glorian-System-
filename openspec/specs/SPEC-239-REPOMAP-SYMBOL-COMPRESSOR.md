# SPEC-239 — Layer-0 Polyglot RepoMap Symbol Compressor

## Metadata

- **SPEC ID**: SPEC-239
- **Change ID**: CHANGE-121
- **Intake ID**: INTAKE-121
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosRepoMapSymbolCompressorCore`

---

## 1. Overview

`EosRepoMapSymbolCompressorCore` builds token-budgeted symbol maps across polyglot repositories (`ts`, `mts`, `js`, `mjs`, `go`, `py`, `java`, `rs`) by extracting public signatures and import relationships, ranking modules by graph centrality (`inDegree * 3 + symbols.length`), and packing ranked summaries strictly within `maxTokenBudget`.

---

## 2. Functional Requirements (EARS Syntax)

**FR-239-001** (Event-Driven)
WHEN `buildCompressedRepoMap(options)` executes on a confined directory or `sourceFilesOverride`, THE SYSTEM SHALL extract exported/public symbols and relative imports, compute `inDegree` and `rankScore = inDegree * 3 + symbols.length`, sort descending, and pack `compressedMapMarkdown` without exceeding `maxTokenBudget` (`Math.ceil(chars / 4) <= maxTokenBudget`).

**FR-239-002** (Error / Unwanted Condition)
IF `targetDir` escapes `projectRoot` via path traversal, THEN THE SYSTEM SHALL fail closed by throwing `Path traversal outside projectRoot is forbidden`.

**FR-239-003** (Event-Driven)
WHEN token savings are computed across scanned files, THE SYSTEM SHALL report `estimatedOriginalTokens`, `estimatedCompressedTokens`, `tokenSavingsPercent`, `filesScanned`, `filesIncluded`, and a deterministic 64-hex `repoMapDigestSha256`.

**FR-239-004** (Ubiquitous)
THE SYSTEM SHALL recognize TypeScript/JavaScript (`export class|interface|type|function|const`), Go (`func `), Python (`def |class `), and Rust (`pub fn|pub struct|pub enum`) declarations without external parsers.

---

## 3. BDD Acceptance Scenarios

### BDD-1216 — Polyglot Symbol Extraction & Graph Centrality Ranking

```gherkin
SCENARIO: Prioritize high-inDegree core modules over leaf callers
  GIVEN sourceFilesOverride where moduleA is imported by moduleB and moduleC
  WHEN buildCompressedRepoMap executes
  THEN moduleA MUST show higher inDegree and higher rankScore than moduleB and moduleC
  AND rankedEntries[0].path MUST identify moduleA
```

### BDD-1217 — Strict Token Budget Enforcement

```gherkin
SCENARIO: Truncate packed entries so estimatedCompressedTokens stays <= maxTokenBudget
  GIVEN multiple large source modules and maxTokenBudget = 120
  WHEN buildCompressedRepoMap executes
  THEN estimatedCompressedTokens MUST be <= 120
  AND filesIncluded MUST be <= filesScanned
```

### BDD-1218 — Multi-Language Signature Extraction

```gherkin
SCENARIO: Extract public declarations from Go, Python, Rust, and TypeScript inputs
  GIVEN sourceFilesOverride entries ending in ".go", ".py", ".rs", and ".ts"
  WHEN buildCompressedRepoMap runs
  THEN extracted symbols MUST include declarations from each language
```

### BDD-1219 — Confined Disk Traversal & Traversal Rejection

```gherkin
SCENARIO: Scan confined targetDir on disk and reject escaping targetDir
  GIVEN real project directory "src/core" AND escaping path "../outside-dir"
  WHEN buildCompressedRepoMap is called
  THEN scanning "src/core" with maxFiles = 10 MUST return positive tokenSavingsPercent and valid SHA-256
  AND scanning "../outside-dir" MUST throw confinement error
```

### BDD-1220 — Deterministic Map Digest Repeatability

```gherkin
SCENARIO: Produce identical repoMapDigestSha256 for identical inputs
  GIVEN identical sourceFilesOverride and maxTokenBudget across two runs
  WHEN buildCompressedRepoMap executes twice
  THEN both repoMapDigestSha256 values MUST match identically
```
