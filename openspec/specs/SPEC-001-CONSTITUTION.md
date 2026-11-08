# OPENPEC BASE SPECIFICATION: CONSTITUTIONAL GOVERNANCE (SPEC-001)

## 1. Scope & Authority

Governs all engineering agents, automated pipelines, and human developers operating within the EOS System ecosystem.

## 2. Inviolable Laws

- **Law I (Specification as Supreme Truth)**: Zero Vibe Coding. Code is derived exclusively from formal specifications.
- **Law II (Strict Gate)**: No implementation code before full specification package approval (Level 2+ Gate).
- **Law III (Evidence Over Claims)**: Verifiable cryptographic evidence required for all claims (`VERIFIED`, `PRODUCTION_READY`).
- **Law IV (External Write Barrier)**: External directory writes require satisfying all 6 preconditions in `docs/projects/registry.json`.
- **Law V (Architectural Purity)**: Clean Hexagonal Layer-0 isolation with zero external runtime dependencies (`dependencies: {}`).
- **Law VI (Absolute Security & Zero Plain Secrets)**: Zero hardcoded credentials; fail-closed scanning.
- **Law VII (Technical Artifact Discipline)**: Standard professional English in all codebase artifacts.

## 3. Epistemic Taxonomy

- `AUDIT_EXECUTED`
- `FINDINGS_IDENTIFIED`
- `REMEDIATION_REQUIRED`
- `REMEDIATION_IN_PROGRESS`
- `REVALIDATION_REQUIRED`
- `VERIFIED`
- `PRODUCTION_READY_WITHIN_TESTED_SCOPE`
- `PRODUCTION_READY`

## 4. Requirements (EARS)

- **UBIQUITOUS**: THE SYSTEM SHALL enforce all 7 Inviolable Laws across every pipeline run and code change.
- **ERROR / UNWANTED CONDITION**: IF an implementation introduces undeclared external runtime dependencies into package.json, THEN THE SYSTEM SHALL fail closed and block execution.
- **EVENT-DRIVEN**: WHEN an agent makes a verification claim, THE SYSTEM SHALL require verifiable cryptographic SHA-256 evidence.

## 5. Acceptance Criteria (BDD)

```gherkin
SCENARIO: Enforce Layer-0 Dependency Purity (Law V)
  GIVEN an engineering agent or automated pipeline modifying package.json
  WHEN the modified dependencies object contains non-empty external runtime packages
  THEN the pipeline fails closed with a non-zero exit code
  AND zero untrusted dependencies are admitted to the runtime environment.

SCENARIO: Cryptographic Evidence Requirement (Law III)
  GIVEN an assertion of verification or production readiness
  WHEN the attestation gate evaluates the artifact
  THEN verifiable cryptographic SHA-256 evidence must be present in the evidence directory
  AND the gate rejects unverified assertions without evidence.
```
