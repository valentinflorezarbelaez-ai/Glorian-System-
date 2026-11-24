# Verify

The canonical SecDevOps merge gate for this control plane is:

```bash
npm run verify:strict
```

That alias runs `node bin/eos.mjs verify` (7-stage gate; exit code 0 required).

Cloud agents: treat this CLI as gate SoT even when MCP `eos-system` is unavailable — see [governance/MCP_AGENT_OPERABILITY.md](governance/MCP_AGENT_OPERABILITY.md).

Operator detail: [eos-operational-runbook.md](runbooks/eos-operational-runbook.md) · [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
