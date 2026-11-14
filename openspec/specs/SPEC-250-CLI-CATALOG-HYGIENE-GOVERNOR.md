# SPEC-250 — Layer-0 CLI Catalog Parity & Module Headroom Governor

## Metadata

- **SPEC ID**: SPEC-250
- **Change ID**: CHANGE-125
- **Intake ID**: INTAKE-125
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosCliCatalogAndHygieneGovernorCore`

---

## 1. Overview

`EosCliCatalogAndHygieneGovernorCore` enforces continuous synchronization between all registered CLI commands in `bin/commands/*.mjs`, the interactive CLI help catalog (`bin/commands/cliHelpCatalog.mjs`), and `docs/DEVELOPER_GUIDE.md`, while auditing module line-count headroom across `src/`, `bin/`, and `scripts/` against the `800`-line hard limit.

---

## 2. Functional Requirements (EARS Syntax)

**FR-250-001** (Event-Driven)
WHEN `auditCliCatalogAndModuleHeadroom(input)` is invoked, THE SYSTEM SHALL resolve registered CLI commands from `bin/commands/*.mjs` (or `registeredCommands` override), excluding internal help aliases (`help`, `--help`, `-h`, `__default__`), and verify coverage in the CLI help catalog and developer guide to compute `catalogCoverageRatio` (`0..1`) and `missingFromHelpCatalog`.

**FR-250-002** (State-Driven)
THE SYSTEM SHALL measure line counts across all `.ts` and `.mjs` files under `src/`, `bin/`, and `scripts/` (or `moduleLineCounts` override) against `hardLimitLines` (default `800`) and `minRequiredHeadroomLines` (default `12`), reporting `maxLinesObserved`, `minHeadroomLines`, `nearCeilingModules`, and `breachedModules`.

**FR-250-003** (State-Driven & Error Condition)
IF `breachedModules.length > 0`, THEN THE SYSTEM SHALL classify `verdict` as `"HYGIENE_BREACH"`. WHILE `breachedModules.length === 0`, IF `nearCeilingModules.length > 0` OR `missingFromHelpCatalog.length > 0`, THEN `verdict` SHALL be `"HYGIENE_WARNING"`; OTHERWISE `verdict` SHALL be `"HYGIENE_GOVERNED"`. Path overrides outside `projectRoot` SHALL fail closed.

**FR-250-004** (Ubiquitous)
THE SYSTEM SHALL deep-freeze the governance report and compute a deterministic 64-hex `sha256Receipt`.

---

## 3. BDD Acceptance Scenarios

### BDD-1271 — Live Repository Audits As HYGIENE_GOVERNED With 100% Help Catalog Parity

```gherkin
SCENARIO: Audit live Glorian repository after CLI help sync and module decompression
  GIVEN synchronized bin/commands/cliHelpCatalog.mjs and all src/, bin/, scripts/ modules <= 788 lines
  WHEN EosCliCatalogAndHygieneGovernorCore.auditCliCatalogAndModuleHeadroom runs on process.cwd()
  THEN verdict is "HYGIENE_GOVERNED", missingFromHelpCatalog is empty, catalogCoverageRatio is 1, breachedModules is empty, nearCeilingModules is empty, and sha256Receipt is 64 hex chars
```

### BDD-1272 — Detects Uncatalogued CLI Command As HYGIENE_WARNING

```gherkin
SCENARIO: Detect CLI handler missing from help catalog
  GIVEN registeredCommands containing "undocumented:cmd" absent from helpCatalogText
  WHEN auditCliCatalogAndModuleHeadroom executes
  THEN verdict is "HYGIENE_WARNING", missingFromHelpCatalog includes "undocumented:cmd", and catalogCoverageRatio < 1
```

### BDD-1273 — Flags Near-Ceiling Module Below 12 Lines Headroom As HYGIENE_WARNING

```gherkin
SCENARIO: Detect module with < 12 lines headroom below 800-line hard limit
  GIVEN moduleLineCounts containing a module with 792 lines (8 lines headroom)
  WHEN auditCliCatalogAndModuleHeadroom executes
  THEN verdict is "HYGIENE_WARNING" and nearCeilingModules lists that module with headroomLines = 8
```

### BDD-1274 — Flags Module Exceeding 800 Lines As HYGIENE_BREACH

```gherkin
SCENARIO: Fail governance on module exceeding hard 800-line ceiling
  GIVEN moduleLineCounts containing a module with 812 lines
  WHEN auditCliCatalogAndModuleHeadroom executes
  THEN verdict is "HYGIENE_BREACH", breachedModules lists that module, and minHeadroomLines is -12
```

### BDD-1275 — CLI hygiene:audit JSON Output & Synchronized help --all Verification

```gherkin
SCENARIO: Execute CLI hygiene:audit and help --all
  GIVEN CLI handlers and cliHelpCatalog.mjs wired in bin/eos.mjs
  WHEN invoking "node bin/eos.mjs hygiene:audit --json" and "node bin/eos.mjs help --all"
  THEN hygiene:audit returns HYGIENE_GOVERNED JSON with 64-hex sha256Receipt and help --all includes hygiene:audit, ship, eda:prove, apollo:bundle, and aladdin:stress
```
