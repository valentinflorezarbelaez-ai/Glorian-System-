# OPENSPEC BASE SPECIFICATION: UNIVERSAL POLYGLOT REPOSITORY ADAPTER (SPEC-019)

## 1. Scope
Governs bounded local repository inventory, polyglot stack fingerprinting (TypeScript, Go, Rust, Python, Flutter, C/C++, Java), structural file and pattern heuristics, and optional template drafts for recognized stacks. Inventory is limited to directory depth 3 and skips symbolic links; it is not a complete architectural or security analysis.

## 2. Requirements (EARS)
- **UBIQUITOUS**: THE SYSTEM SHALL fingerprint project archetype, language, package manager, test framework, and containerization setup across 20+ software stacks with zero external runtime dependencies (`dependencies: {}`).
- **EVENT-DRIVEN**: WHEN a local repository is audited, THE SYSTEM SHALL evaluate five groups of local structural signals and output a bounded local signal score (0-100) and a SHA-256 report digest. The report SHALL label production readiness as NOT_ASSESSED and SHALL disclose that file and pattern heuristics do not execute tests, verify CI results, or replace SAST, dependency, or secrets scanners.
- **CONSTRAINT**: The local signal score SHALL NOT be presented as a health rating, maturity tier, security certification, or production-readiness decision.
- **ERROR-DRIVEN**: IF the analyzed project lacks standardized Golden Path descriptors, THEN THE SYSTEM SHALL synthesize stack-tailored Backstage RFC-42 descriptors (`catalog-info.yaml`), GitHub Actions CI workflows (`.github/workflows/ci.yml`), pre-commit secret scanners, and agent context files (`AGENTS.md`/`CLAUDE.md`).
- **STATE-DRIVEN**: WHILE evaluating codebases in dry-run mode, THE SYSTEM SHALL guarantee zero external write mutations, returning detailed diagnostic telemetry and remediation plans.
