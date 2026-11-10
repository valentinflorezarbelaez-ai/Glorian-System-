# SPEC-191: Neuro-Symbolic Runtime Invariant Verification Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Product / Core AI Safety
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / Hoare Logic / Horn Clause SAT / Constitutional AI
- **Module**: `src/core/eosNeuroSymbolicVerifier.ts`
- **Composes**: SPEC-001 (Constitution), SPEC-041 (Kernel Primitives), SPEC-186 (Enterprise Facade)

---

## 1. Context and Rationale

Autonomous AI coding agents generate tool calls, bash commands, and source code transformations based on probabilistic token predictions. Even state-of-the-art frontier models can hallucinate dangerous shell commands, violate structural invariants, leak credentials, or corrupt architectural boundaries.

This specification implements `EosNeuroSymbolicVerifier`, establishing a deterministic neuro-symbolic safety gate that mathematically evaluates all proposed LLM agent actions against formal Hoare logic preconditions/postconditions, propositional Horn-clause rules, and command injection patterns prior to execution.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-974 (Event-Driven - Pre-Execution Invariant Proof)**: `WHEN an agent proposes an action (command, file edit, or tool call), THE SYSTEM SHALL evaluate the action against active constitutional invariants, rejecting any action that violates required preconditions or guarantees.`

- **FR-975 (Ubiquitous - Horn Clause Rule Evaluation)**: `THE SYSTEM SHALL evaluate propositional logic rules structured as Horn clauses (conjunction of antecedents implying a consequent) to determine system safety status in bounded polynomial time.`

- **FR-976 (Ubiquitous - Injection and Traversal Neutralizer)**: `THE SYSTEM SHALL scan all proposed shell strings, arguments, and file paths, rejecting any payload exhibiting command chaining (;, &&, ||, subshells), directory traversal (../), or credential leakage patterns.`

- **FR-977 (Ubiquitous - Deterministic Verdict Attestation)**: `THE SYSTEM SHALL emit an immutable verification verdict containing status (VERIFIED_SAFE or REJECTED_VIOLATION), list of evaluated rules, identified violations, and a SHA-256 decision fingerprint.`

- **FR-978 (Ubiquitous - Zero Dependencies)**: `THE SYSTEM SHALL execute all SAT evaluation, pattern scanning, and invariant checking using native TypeScript and Node.js standard modules.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-974 Safe action verified with valid proof
  GIVEN an active EosNeuroSymbolicVerifier instance
  WHEN an action with valid preconditions and safe parameters is evaluated
  THEN verdict status is "VERIFIED_SAFE"
  AND violations list is empty
  AND sha256Fingerprint is a 64-character hex string

SCENARIO: BDD-975 Command injection attempt rejected fail-closed
  GIVEN a proposed shell command containing chained destructive subshells "echo hi; rm -rf /"
  WHEN the verifier evaluates the command
  THEN verdict status is "REJECTED_VIOLATION"
  AND violations list contains "COMMAND_INJECTION_DETECTED"

SCENARIO: BDD-976 Directory traversal attempt blocked
  GIVEN a proposed file mutation path "../../etc/shadow"
  WHEN the verifier evaluates the target path
  THEN verdict status is "REJECTED_VIOLATION"
  AND violations list contains "DIRECTORY_TRAVERSAL_DETECTED"

SCENARIO: BDD-977 Secret credential leak prevented
  GIVEN an agent payload containing an AWS secret key or RSA private key pattern
  WHEN the verifier evaluates the payload
  THEN verdict status is "REJECTED_VIOLATION"
  AND violations list contains "SECRET_LEAKAGE_DETECTED"

SCENARIO: BDD-978 Horn clause constraint propagation
  GIVEN rules [A, B] -> SAFE and fact A=true, B=true
  WHEN the SAT engine runs
  THEN the consequent SAFE is proven true
```
