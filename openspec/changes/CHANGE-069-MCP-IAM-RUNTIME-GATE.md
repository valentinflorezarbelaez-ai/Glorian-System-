# CHANGE-069: MCP Runtime IAM Gate (SPEC-184 enforcement)

## Intent

Wire the Layer-0 multi-tenant IAM foundation into stdio MCP `tools/call` so
mutating writes fail closed at the dispatch boundary (Stripe / Anthropic /
OWASP MCP practice: auth ≠ authz).

## Scope

- Add `src/core/eosMcpIamCallGate.ts` (pure decision helper).
- Enforce in `EosMcpServer` before `dispatchTool` for write-flagged mutation tools.
- Hermetic BDD coverage for deny-without-principal, plan-only bypass, and allow.

## Non-goals

- No OIDC/SAML IdP.
- No change to the HTTP/SSE read-only allowlist (already non-mutating).
- No expansion of the mutating tool catalog.

## Status

APPROVED for implementation under owner directive to harden Glorian like Big Tech.
