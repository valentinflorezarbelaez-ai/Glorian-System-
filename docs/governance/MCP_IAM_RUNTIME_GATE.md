# MCP Runtime IAM Gate (SPEC-184)

Epistemic state: `WITHIN_TESTED_SCOPE` · not OIDC · not Level-5

## Behavior

Stdio MCP `tools/call` evaluates IAM **before** dispatch when:

1. the tool is mutation-capable, and
2. arguments request a write (`apply`, `write`, `applyToDisk`, `applyChanges`, or `autoApply` is `true`, or `dryRun` is `false`).

Read-only tools and plan-only mutation tools skip IAM.

Denied calls return JSON-RPC error `-32030` with `data.code` and `data.sha256Receipt`. The handler is not invoked.

## Caller principal

Resolved in order:

1. `arguments._eosIam` (stripped before dispatch)
2. `params._meta.iam`
3. `EOS_MCP_IAM_PRINCIPAL_JSON` (optional local default)

## Policies

Loaded from `.eos/iam-policies.json` (array or `{ "policies": [...] }`).

Empty policy set ⇒ mutating writes are denied (`DENY_NO_POLICY` / `DENY_INVALID_INPUT`).

Example rule:

```json
{
  "id": "local-engineer-mcp-write",
  "tenantId": "tenant-local",
  "roles": ["engineer"],
  "actions": ["mcp.tools.call"],
  "resourcePrefix": "mcp/tools/"
}
```

## Non-claims

Does not replace Docker sandbox, GitHub branch protection, or an IdP.
