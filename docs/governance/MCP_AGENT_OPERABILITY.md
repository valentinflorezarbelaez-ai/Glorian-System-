# MCP / cloud agent operability

**Status:** normative for Cursor Cloud and other agents without a live `eos-system` MCP session  
**Remediation:** P2-2 / PR-K  
**Related:** [`MCP_TIER0_TOKEN_ECONOMY.md`](./MCP_TIER0_TOKEN_ECONOMY.md), [`CURSOR_ENVIRONMENT_FLEET_POSTURE.md`](./CURSOR_ENVIRONMENT_FLEET_POSTURE.md), [`docs/verify.md`](../verify.md)

## Gate truth (SoT)

Cloud agents **must** treat the CLI merge gate as the sole source of truth for SecDevOps readiness:

```bash
npm run verify:strict
# equivalent:
node bin/eos.mjs verify
```

| Claim | Allowed when |
| --- | --- |
| Gate green / 7-stage PASS | `npm run verify:strict` (or `node bin/eos.mjs verify`) exits **0** with receipts |
| MCP tools available | Host actually wires stdio `eos-system` (see below) |
| Live fleet Soundcheck | Only under `FLEET_VERIFIED` posture — see fleet posture doc |

**Do not** invent, simulate, or assume MCP tools (`eos_semantic_search`, `eos_audit_fleet`, `eos_health_check`, `eos_tmr_consensus`, …) as proof of gate truth. Missing MCP is **not** a broken gate; use the CLI.

## Optional: wire MCP stdio `eos-system`

When the host can run a local Node subprocess (desktop IDE / Antigravity / configured cloud MCP), agents may attach the EOS MCP server for *assistive* tools. This is optional and never replaces `verify:strict`.

### Quick local start

```bash
npm run mcp
# → node src/mcp/eosMcpServer.ts (stdio JSON-RPC, 1 MiB request ceiling)
```

### Cursor / Antigravity mcpServers sketch

Register server name **`eos-system`** with Node pointing at this repo’s stdio entry. Prefer the installer when available:

```bash
node scripts/install-antigravity-mcp.mjs
```

Manual sketch (paths are illustrative — use the checkout root):

```json
{
  "mcpServers": {
    "eos-system": {
      "command": "node",
      "args": ["src/mcp/eosMcpServer.ts"],
      "env": {
        "EOS_PROJECT_ROOT": "<absolute-checkout-root>",
        "EOS_MCP_PROFILE": "core"
      }
    }
  }
}
```

`EosAntigravityDirector.synthesizeAntigravityMcpEntry` builds the same shape (project root + optional `EOS_FLEET_*_PATH` bindings). Default profile is Tier-0 **`core`**.

### Profiles (do not duplicate)

Tier-0 vs `essential` vs `full` is already specified here — **link, do not copy tables**:

→ [`docs/governance/MCP_TIER0_TOKEN_ECONOMY.md`](./MCP_TIER0_TOKEN_ECONOMY.md)

Default agent turns: `EOS_MCP_PROFILE=core` (~46 tools). Prefer `gh` / Cursor GitHub tools for routine GitHub reads.

## Audit playbook (cloud without MCP)

1. Run `npm run verify:strict` — exit 0 is gate SoT.
2. Honor fleet posture: unset `EOS_FLEET_*_PATH` ⇒ `CONTROL_PLANE_ONLY` (no live Soundcheck claims).
3. If MCP is absent, continue with CLI + `gh` / local ripgrep; do not block audits waiting for invented MCP.
4. If MCP is present, treat it as assistive context only; still require `verify:strict` before merge claims.

## Pointers

- Canonical verify page: `docs/verify.md`
- Fleet / env posture: `docs/governance/CURSOR_ENVIRONMENT_FLEET_POSTURE.md`
- MCP IAM on mutating stdio calls: `docs/governance/MCP_IAM_RUNTIME_GATE.md`
- CLI scripts: `package.json` → `verify:strict`, `mcp`, `mcp:stream`
