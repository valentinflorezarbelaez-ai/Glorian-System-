# SPEC-146: Peak Assurance Formal TCB & LADDER-14 High-Assurance Program

## 1. Specification Metadata
- **Specification ID**: `SPEC-146`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Ladder**: `LADDER-14` / `GATE-14` Peak Assurance (A Formal → B NIST Pack → C Adversarial)
- **Related Specs**: `SPEC-001`, `SPEC-034`, `SPEC-140`, `SPEC-143`, `SPEC-144`
- **Module Target**: `src/core/eosPeakAssuranceTcb.ts`, `docs/formal/McpStreamableSecurity.tla`, `test/eosPeakAssuranceTcb.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-430 (Unwanted / Origin Deny)**: `IF the request Origin is missing or not present in the configured allowlist, THEN THE SYSTEM SHALL fail-closed with HTTP 403 and reason ORIGIN_DENIED.`
- **FR-431 (Unwanted / Payload Bound)**: `IF the request payload byte length exceeds 1,048,576 bytes, THEN THE SYSTEM SHALL fail-closed with HTTP 413 and reason PAYLOAD_TOO_LARGE.`
- **FR-432 (Unwanted / Token Binding)**: `IF a session token hash is bound and the presented bearer token SHA-256 digest does not timingSafeEqual-match, THEN THE SYSTEM SHALL fail-closed with HTTP 401 and reason TOKEN_BINDING_MISMATCH.`
- **FR-433 (Unwanted / Law IV)**: `IF any of the six Law IV preconditions is false, THEN THE SYSTEM SHALL deny external writes with HTTP 403 and reason LAW_IV_INCOMPLETE.`
- **FR-434 (Ubiquitous / Formal)**: `THE SYSTEM SHALL maintain a TLA+ model McpStreamableSecurity whose SafetyInvariant is preserved under bounded JS simulation.`
- **FR-435 (Ubiquitous / Mutation)**: `THE SYSTEM SHALL require mutation score >= 80 on the TCB admit predicate snippet before Wave A seal.`

---

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: BDD-410 Origin deny-by-default
  GIVEN an empty or non-matching Origin allowlist
  WHEN evaluateMcpAdmission is invoked
  THEN admitted is false AND reason is ORIGIN_DENIED AND statusCode is 403

SCENARIO: BDD-411 Payload hard bound 1 MiB
  GIVEN payloadBytes = 1048577
  WHEN evaluateMcpAdmission is invoked with an allowed Origin
  THEN admitted is false AND reason is PAYLOAD_TOO_LARGE AND statusCode is 413

SCENARIO: BDD-412 Session token binding uses timing-safe compare
  GIVEN a sessionTokenHash bound to token A
  WHEN token B is presented
  THEN admitted is false AND reason is TOKEN_BINDING_MISMATCH

SCENARIO: BDD-413 Law IV incomplete blocks external write
  GIVEN any Law IV precondition false
  WHEN evaluateExternalWrite is invoked
  THEN admitted is false AND reason is LAW_IV_INCOMPLETE

SCENARIO: BDD-414 TLA+ McpStreamableSecurity bounded simulation PASS
  GIVEN docs/formal/McpStreamableSecurity.tla
  WHEN verify-formal-tla runs verifyMcpStreamableSecurityModel
  THEN simulationAssertionsPassed is true AND SafetyInvariant holds

SCENARIO: BDD-415 TCB mutation score floor
  GIVEN TCB_MUTATION_TARGET_SNIPPET
  WHEN EosMutationTester.evaluateTestSuite runs with a strict admit oracle
  THEN mutationScore >= 80 AND grade is TIER_S_CERTIFIED
```

---

## 4. Epistemic States

`NOT_INITIALIZED` → `FORMAL_TCB_VERIFIED_WITHIN_SCOPE` (Wave A) → `NIST_BINDER_READY` (Wave B) → `HIGH_ASSURANCE_CANDIDATE` (Wave C tip-seal). Never auto-issue `NSA_GRADE` or `AEROSPACE_CERTIFIED`.
