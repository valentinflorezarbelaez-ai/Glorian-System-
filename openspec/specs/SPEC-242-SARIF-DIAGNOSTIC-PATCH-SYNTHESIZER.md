# SPEC-242 — Layer-0 SARIF 2.1.0 Diagnostic & Unified Patch Synthesizer

## Metadata

- **SPEC ID**: SPEC-242
- **Change ID**: CHANGE-122
- **Intake ID**: INTAKE-122
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosSarifDiagnosticPatchSynthesizerCore`

---

## 1. Overview

`EosSarifDiagnosticPatchSynthesizerCore` compiles structured verification findings into OASIS SARIF 2.1.0 JSON documents with deduplicated rules, `physicalLocation` coordinates, machine-applicable fix descriptors, and unified diff remediation patches, while confining optional disk output inside `projectRoot`.

---

## 2. Functional Requirements (EARS Syntax)

**FR-242-001** (Event-Driven)
WHEN `synthesizeSarifAndPatches(options)` runs with structured findings, THE SYSTEM SHALL produce a canonical OASIS SARIF `2.1.0` JSON document (`$schema: "https://json.schemastore.org/sarif-2.1.0.json"`, `version: "2.1.0"`) containing deduplicated `tool.driver.rules`, mapped `results` with `locations[0].physicalLocation`, and counts for total, error, and warning items.

**FR-242-002** (Event-Driven)
WHEN a finding specifies both `originalLine` and `replacementLine`, THE SYSTEM SHALL attach a SARIF `fixes` entry on the result AND append a unified diff hunk (`--- a/<filePath>\n+++ b/<filePath>\n@@ -<line>,1 +<line>,1 @@\n-<originalLine>\n+<replacementLine>`) to `synthesizedUnifiedDiff`.

**FR-242-003** (Error / Unwanted Condition)
IF `writeSarifToDisk === true` and `outputRelPath` resolves outside `projectRoot` via `..` traversal or an external path, THEN THE SYSTEM SHALL fail closed by throwing `Path traversal outside projectRoot is forbidden`.

**FR-242-004** (Event-Driven)
WHEN `writeSarifToDisk === true` and `outputRelPath` is confined within `projectRoot` (defaulting to `.eos/glorian-ship.sarif.json`), THE SYSTEM SHALL persist formatted SARIF 2.1.0 JSON atomically, return `writtenSarifPath`, and emit a deterministic 64-hex `sarifDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1231 — Synthesizes OASIS SARIF 2.1.0 Document With Deduplicated Rules And Locations

```gherkin
SCENARIO: Generate standards-compliant SARIF 2.1.0 output from diagnostic findings
  GIVEN two findings sharing rule EOS-BEYONCE-001 and one warning rule EOS-DDL-002
  WHEN EosSarifDiagnosticPatchSynthesizerCore.synthesizeSarifAndPatches runs
  THEN sarifDocument.version is "2.1.0", driver.rules has 2 unique entries, and results has 3 entries with physicalLocation
```

### BDD-1232 — Generates Unified Diff Patch Hunks For Remediable Findings

```gherkin
SCENARIO: Build unified diff hunks and SARIF fixes when replacement lines exist
  GIVEN a finding on src/core/example.ts line 12 with originalLine and replacementLine
  WHEN EosSarifDiagnosticPatchSynthesizerCore.synthesizeSarifAndPatches executes
  THEN the SARIF result includes fixes and synthesizedUnifiedDiff contains a valid unified diff hunk
```

### BDD-1233 — Persists SARIF Report Inside Confined Project Root

```gherkin
SCENARIO: Write SARIF 2.1.0 JSON inside .eos directory when writeSarifToDisk is true
  GIVEN an isolated temporary projectRoot and writeSarifToDisk = true
  WHEN EosSarifDiagnosticPatchSynthesizerCore.synthesizeSarifAndPatches executes
  THEN writtenSarifPath exists on disk and parses as valid SARIF 2.1.0 JSON
```

### BDD-1234 — Blocks Path Traversal On SARIF Output Path

```gherkin
SCENARIO: Reject outputRelPath traversal outside projectRoot
  GIVEN writeSarifToDisk = true and outputRelPath = "../outside-escape.sarif.json"
  WHEN EosSarifDiagnosticPatchSynthesizerCore.synthesizeSarifAndPatches executes
  THEN the call throws "Path traversal outside projectRoot is forbidden"
```

### BDD-1235 — Produces Deterministic SHA-256 Digest Across Repeated Invocations

```gherkin
SCENARIO: Repeat identical sarifDigestSha256 for identical findings
  GIVEN the same SynthesizeSarifOptions input without disk mutation
  WHEN synthesizeSarifAndPatches runs twice
  THEN both reports return identical 64-hex sarifDigestSha256 hashes
```
