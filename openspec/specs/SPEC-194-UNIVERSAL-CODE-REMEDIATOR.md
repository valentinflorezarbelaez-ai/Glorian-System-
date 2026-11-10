# SPEC-194: Universal Code Remediation & Modernizer Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Product / Core Tooling
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / Google Rosie LSC / Meta SapFix
- **Module**: `src/core/eosUniversalCodeRemediator.ts`
- **Composes**: SPEC-193 (Project Doctor), SPEC-012 (Polyglot Adapter), SPEC-186 (Enterprise Facade)

---

## 1. Context and Rationale

Diagnosing software defects and architectural gaps is only the first half of the engineering lifecycle. In large-scale operations across Google (Piper Rosie), Meta (SapFix), and Spotify (Soundcheck Golden Path Programs), autonomous systems must be capable of remediating and modernizing repositories without breaking developer workflows.

`EosUniversalCodeRemediator` provides a deterministic remediation engine that elevates unhardened codebases across 7 major software ecosystems to production-grade standards with zero external dependencies.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-989 (Event-Driven - Stack-Aware `.gitignore` Remediation)**: `WHEN a repository lacks a .gitignore file, THE SYSTEM SHALL generate a hermetic .gitignore populated with ignored patterns specific to the detected stack (e.g., node_modules/, target/, __pycache__/, .dart_tool/, build/, bin/).`

- **FR-990 (Event-Driven - Automated Test Harness Scaffolding)**: `WHEN a repository lacks an automated test suite, THE SYSTEM SHALL scaffold a standard testing directory structure and boilerplate smoke test customized to the stack (e.g., test/index.test.js for Node, tests/test_smoke.py for Python, tests/smoke_test.rs for Rust, etc.).`

- **FR-991 (Event-Driven - Governance & Licensing Scaffolding)**: `WHEN a repository lacks README.md or LICENSE, THE SYSTEM SHALL generate standard governance files incorporating project archetype metadata and standard Apache-2.0 or MIT license text.`

- **FR-992 (Event-Driven - Full Automated Remediation Engine)**: `WHEN remediateProject is invoked, THE SYSTEM SHALL execute all non-destructive scaffolding actions, recalculate the Soundcheck score, and return a tamper-evident remediation receipt with SHA-256 digest.`

- **FR-993 (Ubiquitous - Dry-Run Simulation)**: `THE SYSTEM SHALL support dry-run simulation mode returning the list of planned remediation files without modifying disk.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-989 Stack-aware .gitignore synthesis
  GIVEN a Python repository without a .gitignore file
  WHEN remediateProject is executed
  THEN a .gitignore file is synthesized containing "__pycache__", ".pytest_cache", and "*.pyc"

SCENARIO: BDD-990 Automated test scaffolding across polyglot stacks
  GIVEN a Go repository without a test directory
  WHEN remediateProject is executed
  THEN a smoke test file is created containing a passing unit test

SCENARIO: BDD-991 Governance and license scaffolding
  GIVEN a repository without README.md or LICENSE
  WHEN remediateProject is executed
  THEN a professional README.md and LICENSE file are created

SCENARIO: BDD-992 End-to-end repository remediation and score elevation
  GIVEN an empty unhardened repository with an initial score under 50
  WHEN remediateProject is executed in non-dry-run mode
  THEN all missing foundational files are scaffolded
  AND postRemediationScore increases to at least 80
  AND a deterministic sha256Receipt is emitted

SCENARIO: BDD-993 Dry-run mode simulation without disk modification
  GIVEN an unhardened repository
  WHEN remediateProject is executed with dryRun=true
  THEN plannedActions are returned
  AND no files are written to the target filesystem
```

---

## 4. Architectural Invariants

1. **Law I (Zero Vibe Coding)**: All scaffolding rules are deterministic and bounded.
2. **Law V (Zero Runtime Dependencies)**: Only Node.js built-ins (`node:fs`, `node:path`, `node:crypto`).
3. **Law VII (Layer-0 Isolation)**: `EosUniversalCodeRemediator` does not import higher-layer modules.
