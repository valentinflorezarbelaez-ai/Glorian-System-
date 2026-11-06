# PLAN-153: Cursor & Antigravity Session Hook Enforcement

## ADR-0191: Durable JSON ledger under `.eos/state`

- **Decision**: Persist sessions and `activeByIde` to `.eos/state/agent-sessions.json`. MCP and hook processes reload before authorize decisions.
- **Rejected**: In-memory-only Map (hooks cannot see MCP state).

## ADR-0192: Preferred IDEs get fail-closed write hooks; others stay MCP-first

- **Decision**: `cursor` and `antigravity` are `PREFERRED_IDE_FAMILIES`. SessionStart ensures a session; write tools call `evaluatePreferredWriteGate`. `claude-code` / `vscode` use MCP without mandatory project hooks.
- **Rejected**: Blocking all IDEs equally before Cursor/Antigravity paths are proven.
