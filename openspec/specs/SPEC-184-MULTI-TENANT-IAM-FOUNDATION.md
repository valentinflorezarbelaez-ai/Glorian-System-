# SPEC-184: Multi-Tenant IAM Foundation

## Status

- **Status**: APPROVED
- **Date**: 2026-11-09
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Foundation
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution Law VI
- **Module**: `src/core/eosMultiTenantIamFoundation.ts`, `src/core/eosMcpIamCallGate.ts`
- **Enforcement surface**: `EosMcpServer` stdio `tools/call` (mutating write path)

---

## 1. Context and Rationale

Glorian needs a minimal Layer-0 multi-tenant IAM foundation so control-plane
actions can fail-closed on tenant mismatch before any IdP / OIDC product is
wired. This is software ABAC only — not SSO and not Level-5.

Big Tech / OWASP MCP practice: transport authentication is not tool
authorization. Every mutating `tools/call` must re-check principal, action,
and resource at the dispatch boundary and fail closed when context is missing.

## 2. Functional Requirements (EARS Syntax)

- **FR-924 (Ubiquitous - Tenant Isolation)**: `THE SYSTEM SHALL deny any access request where principal.tenantId differs from resource.tenantId.`

- **FR-925 (Unwanted Condition - Missing Policy)**: `IF no policy exists for the principal tenant, THEN THE SYSTEM SHALL deny with DENY_NO_POLICY.`

- **FR-926 (Event-Driven - Allow)**: `WHEN a tenant-scoped policy matches role, action, and optional resource prefix, THE SYSTEM SHALL allow with ALLOW and return a SHA-256 receipt.`

- **FR-927 (Unwanted Condition - Invalid Input)**: `IF required IAM fields are missing, THEN THE SYSTEM SHALL deny with DENY_INVALID_INPUT.`

- **FR-928 (Unwanted Condition - Malformed Principal or Policy)**: `IF principal.roles is missing or is not a non-empty list of non-empty strings, OR the policy list is not an array, OR any supplied policy is missing id, tenantId, roles, or actions, THEN THE SYSTEM SHALL deny with DENY_INVALID_INPUT and SHALL NOT throw.`

- **FR-929 (Unwanted Condition - Resource Boundary)**: `IF resource.resourceId or a policy resourcePrefix contains an empty segment, a parent segment '..', a backslash, or a double slash, THEN THE SYSTEM SHALL deny with DENY_INVALID_INPUT. WHEN a resourcePrefix is present and safe, THE SYSTEM SHALL allow only an exact resourceId match or a continuation on a path-segment boundary.`

- **FR-931 (Event-Driven - MCP Mutating Call Gate)**: `WHEN an MCP tools/call targets a mutation-capable tool AND the arguments request a write (apply=true, write=true, applyToDisk=true, applyChanges=true, autoApply=true, or dryRun=false), THE SYSTEM SHALL evaluate IAM before dispatching the tool handler.`

- **FR-932 (Ubiquitous - Read and Plan Bypass)**: `THE SYSTEM SHALL NOT require an IAM decision for read-only tools, nor for mutation-capable tools invoked in plan-only mode (no write flag).`

- **FR-933 (Unwanted Condition - Missing Caller Context)**: `IF a mutating write call lacks a valid principal (params._meta.iam, arguments._eosIam, or a configured default principal), THEN THE SYSTEM SHALL deny with DENY_INVALID_INPUT, return JSON-RPC error -32030, and SHALL NOT dispatch the tool.`

- **FR-934 (Event-Driven - Allow Mutating Call)**: `WHEN a registered policy grants action mcp.tools.call on resource mcp/tools/<toolName> for the caller's tenant and roles, THE SYSTEM SHALL allow the call and attach the IAM SHA-256 receipt to the decision audit field.`

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

SCENARIO: BDD-928 malformed roles fail-closed
  GIVEN a principal whose roles field is missing
  WHEN evaluateIamAccess is called
  THEN ok is false AND code is DENY_INVALID_INPUT
  AND the call does not throw

SCENARIO: BDD-929 prefix does not grant a sibling identifier
  GIVEN a policy whose resourcePrefix is ledger
  WHEN the principal requests read on ledger-secret
  THEN ok is false AND code is DENY_ACTION_NOT_PERMITTED

SCENARIO: BDD-930 parent-segment resource identifier is rejected
  GIVEN a policy whose resourcePrefix is ledger/
  WHEN the principal requests read on ledger/../secrets
  THEN ok is false AND code is DENY_INVALID_INPUT

SCENARIO: BDD-931 mutating write without principal is denied before dispatch
  GIVEN a mutation-capable tool called with apply=true and no IAM principal
  WHEN tools/call is handled
  THEN the response is JSON-RPC error -32030
  AND code is DENY_INVALID_INPUT
  AND the tool handler is not invoked

SCENARIO: BDD-932 plan-only mutation-capable call bypasses IAM
  GIVEN a mutation-capable tool called without write flags
  WHEN tools/call is handled
  THEN the tool handler may run
  AND no IAM deny error is returned

SCENARIO: BDD-933 granted policy allows mutating write
  GIVEN a principal with a matching mcp.tools.call policy for mcp/tools/eos_manage_worktree
  WHEN tools/call is handled with apply=true
  THEN IAM code is ALLOW
  AND the tool handler is dispatched
```

## 4. Non-Claims

Not NSA_GRADE · not Level-5 · not OIDC/SAML IdP · not federated SSO.
Not a substitute for OS sandboxing or GitHub branch protection.
