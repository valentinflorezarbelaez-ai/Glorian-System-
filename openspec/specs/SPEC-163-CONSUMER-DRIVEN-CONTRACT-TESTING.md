# SPEC-163: Consumer-Driven Contract Test Engine with Backward-Compatibility Gating

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

When many consumers depend on a shared provider API, an unaware provider change can silently break downstream clients. Consumer-driven contract testing, as popularized by Pact and by Microsoft's internal contract practices, inverts the responsibility: each consumer records the interactions it relies upon, and the provider's actual responses are verified against those recorded contracts in CI before release. Verification is shape-based (field presence and type) rather than value-based, so legitimate data variation is tolerated while structural breakage is caught.

A contract suite alone is not enough: the same discipline must gate evolution. This module therefore includes a backward-compatibility check that compares a provider's proposed response shape against every registered contract, treating added fields as safe and flagging removed fields or type drift as breaking changes. A deterministic contract digest over the (order-independent) registered interactions provides a stable artifact for CI gating.

`EosContractTestEngine` implements these capabilities in Layer 0 with zero external dependencies, exposing `register`, `verify`, `checkCompatibility`, `listContracts` and `contractDigest`.

## 2. Functional Requirements (EARS Syntax)

- **FR-721 (Ubiquitous - Contract Registration and Immutability)**: `The EOS System shall register a ContractInteraction only when both the consumer and provider identifiers are non-empty, and shall store each registered interaction deep-frozen as an immutable record.`
- **FR-722 (Event-Driven - Interaction Verification)**: `When verify is invoked with a consumer, a description and an actual response, the EOS System shall locate the matching contract and compare the request method case-insensitively, the request path exactly, the response status exactly, and the presence and type of each expected response body field.`
- **FR-723 (Unwanted Condition - Mismatch Diagnostics)**: `If any comparison fails, then the EOS System shall return passed = false together with a mismatches list naming each offending dimension (method, path, status, "body field missing" or "body field type"), and shall return a single "CONTRACT_NOT_FOUND" mismatch when no contract matches the consumer and description.`
- **FR-724 (Event-Driven - Backward-Compatibility Gate)**: `When checkCompatibility is invoked for a provider with a proposed response shape, the EOS System shall treat added fields as compatible and shall report a breaking change for every field removed from, or whose declared type drifted from, any registered contract of that provider.`
- **FR-725 (Ubiquitous - Order-Independent Contract Digest)**: `The EOS System shall expose contractDigest as the SHA-256 digest over the registered contracts sorted by provider, consumer and description, so that the digest is independent of the order in which contracts were registered.`
- **FR-726 (Ubiquitous - Provider-Scoped Contract Listing)**: `The EOS System shall expose listContracts which returns all registered interactions, or only those belonging to a given provider when a provider filter is supplied.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-721 Matching Provider Response Passes Verification
  GIVEN a registered contract "web-app"/"get user by id" expecting GET /users/1 with status 200 and body fields id, name, email
  WHEN the provider returns status 200 with fields id, name and email of matching types
  THEN the verification result reports passed = true
```

```gherkin
SCENARIO: BDD-722 Missing Body Field Is Reported As a Mismatch
  GIVEN the same registered contract
  WHEN the provider returns status 200 but omits the email field
  THEN the verification result reports passed = false
  AND the mismatches list contains an entry naming the field "email"
```

```gherkin
SCENARIO: BDD-723 Status Code Mismatch Is Reported
  GIVEN the same registered contract
  WHEN the provider returns status 404 instead of 200
  THEN the verification result reports passed = false
  AND the mismatches list contains an entry naming "status"
```

```gherkin
SCENARIO: BDD-724 Backward Compatibility Tolerates Added Fields and Rejects Removed Fields
  GIVEN a registered contract for provider "user-api" with body fields id, name and email
  WHEN checkCompatibility is given a shape that adds an avatar field
  THEN the result reports compatible = true
  AND when the shape omits the email field, the result reports compatible = false with a breaking change naming "email"
```

## 4. Architecture Decision Records (ADRs)

- **ADR-163-1: Shape-Based Body Comparison Instead of Value Equality**
  - _Context_: Exact value matching produces brittle tests that fail on legitimate data variation.
  - _Decision_: Compare response bodies by field presence and field type derived from the value's JavaScript type, supporting object, array and null classifications.
  - _Consequence_: The engine catches structural breakage while tolerating value changes, but it does not validate value ranges, formats or nested-document structure.
- **ADR-163-2: Order-Independent Contract Digest for CI Gating**
  - _Context_: Contract suites are registered in arbitrary order, and CI needs a stable identity to detect changes.
  - _Decision_: Sort contracts by provider, consumer and description before hashing them into a SHA-256 digest.
  - _Consequence_: The digest changes only when the contract set changes, making it reliable as a cache key or gate signal regardless of registration order.

## 5. Atomic Task DAG

1. [x] **TASK-163-1**: Author SPEC-163 (this document) defining verification, diagnostics, compatibility and digest contracts.
2. [x] **TASK-163-2**: Implement `EosContractTestEngine` in `src/core/eosContractTestEngine.ts` with register, verify, checkCompatibility and listContracts.
3. [x] **TASK-163-3**: Implement shape extraction and the order-independent `contractDigest`.
4. [x] **TASK-163-4**: Verify the behavior with the SPEC-163 scenarios in `test/eosBigTechDistributed.test.mjs`.
