# SPEC-184: Multi-Tenant IAM Foundation

## Status

- **Status**: APPROVED
- **Date**: 2026-11-09
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Foundation
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution Law VI
- **Module**: `src/core/eosMultiTenantIamFoundation.ts`

---

## 1. Context and Rationale

Glorian needs a minimal Layer-0 multi-tenant IAM foundation so control-plane
actions can fail-closed on tenant mismatch before any IdP / OIDC product is
wired. This is software ABAC only — not SSO and not Level-5.

## 2. Functional Requirements (EARS Syntax)

- **FR-924 (Ubiquitous - Tenant Isolation)**: `THE SYSTEM SHALL deny any access request where principal.tenantId differs from resource.tenantId.`

- **FR-925 (Unwanted Condition - Missing Policy)**: `IF no policy exists for the principal tenant, THEN THE SYSTEM SHALL deny with DENY_NO_POLICY.`

- **FR-926 (Event-Driven - Allow)**: `WHEN a tenant-scoped policy matches role, action, and optional resource prefix, THE SYSTEM SHALL allow with ALLOW and return a SHA-256 receipt.`

- **FR-927 (Unwanted Condition - Invalid Input)**: `IF required IAM fields are missing, THEN THE SYSTEM SHALL deny with DENY_INVALID_INPUT.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-IAM-001 cross-tenant access fail-closed
  GIVEN principal tenant A and resource tenant B
  WHEN evaluateIamAccess is called
  THEN ok is false AND code is DENY_TENANT_MISMATCH

SCENARIO: BDD-IAM-002 matching policy allows action
  GIVEN tenant T with role engineer and action read on resource prefix ledger/
  WHEN principal engineer requests read on ledger/demo
  THEN ok is true AND code is ALLOW
```

## 4. Non-Claims

Not NSA_GRADE · not Level-5 · not OIDC/SAML IdP · not federated SSO.
