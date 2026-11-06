# OPENSPEC BASE SPECIFICATION: LOCAL HEALER BOUNDARIES (SPEC-005)

## 1. Scope
Governs local, heuristic formatting-remediation proposals and explicitly requested file writes. This component is not a model-driven autonomous repair loop, AST root-cause analyzer, or production FDIR system. Its local checks do not establish production readiness.

## 2. Requirements (EARS)
- **STATE-DRIVEN**: WHILE running without explicit apply mode, THE SYSTEM SHALL leave proposed target files unchanged.
- **EVENT-DRIVEN**: WHEN apply mode is explicitly requested, THE SYSTEM SHALL reject invalid proposals, stage valid proposals before replacement, re-check diagnosed file contents, replace each file atomically, and report conflicts or partial completion.
- **UBIQUITOUS**: THE SYSTEM SHALL bound healer source scans to 1 MiB per file, 2,000 files, and 50 MiB total.
- **EVENT-DRIVEN**: WHEN at least one proposal is applied, THE SYSTEM SHALL attempt to create a unique local JSON receipt with a SHA-256 digest without overwriting an existing receipt.
- **UBIQUITOUS**: THE SYSTEM SHALL label its local checks and receipts accurately; a local check result SHALL NOT imply production readiness, and a receipt digest SHALL NOT be described as a signature or immutable ledger.
