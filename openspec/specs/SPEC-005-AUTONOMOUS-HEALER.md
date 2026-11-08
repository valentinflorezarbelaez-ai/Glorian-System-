# OPENSPEC BASE SPECIFICATION: LOCAL HEALER BOUNDARIES (SPEC-005)

## 1. Scope

Governs local, heuristic formatting-remediation proposals and explicitly requested file writes. This component is not a model-driven autonomous repair loop, AST root-cause analyzer, or production FDIR system. Its local checks do not establish production readiness.

## 2. Requirements (EARS)

- **STATE-DRIVEN**: WHILE running without explicit apply mode, THE SYSTEM SHALL leave proposed target files unchanged.
- **EVENT-DRIVEN**: WHEN apply mode is explicitly requested, THE SYSTEM SHALL reject invalid proposals, stage valid proposals before replacement, re-check diagnosed file contents, replace each file atomically, and report conflicts or partial completion.
- **UBIQUITOUS**: THE SYSTEM SHALL bound healer source scans to 1 MiB per file, 2,000 files, and 50 MiB total.
- **EVENT-DRIVEN**: WHEN at least one proposal is applied, THE SYSTEM SHALL attempt to create a unique local JSON receipt with a SHA-256 digest without overwriting an existing receipt.
- **UBIQUITOUS**: THE SYSTEM SHALL label its local checks and receipts accurately; a local check result SHALL NOT imply production readiness, and a receipt digest SHALL NOT be described as a signature or immutable ledger.

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: Diagnostic & Remediation Synthesis (BDD-026)
  GIVEN a codebase with formatting defects such as trailing whitespace or CRLF endings
  WHEN the healer diagnoses the target files
  THEN it accurately detects the defects and generates bounded remediation proposals
  AND clean conforming files require zero remediations.

SCENARIO: Closed-Loop FDIR Healing & Cryptographic Ledger (BDD-027)
  GIVEN remediation proposals produced by the healer
  WHEN executed in default dry-run mode without explicit apply opt-in
  THEN files remain unchanged on disk
  AND when explicit apply is granted, changes are written atomically with a local JSON result receipt.
```
