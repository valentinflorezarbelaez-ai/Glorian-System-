# INTAKE-153: Cursor & Antigravity Session Hook Enforcement

- **Intake ID**: `INTAKE-153`
- **Parent**: `SPEC-152`
- **Status**: `INTAKE_COMPLETE`
- **Date**: 2026-11-04

## Problem

SPEC-152 sessions live in the MCP process memory. Cursor and Antigravity lifecycle hooks run in separate Node processes, so they cannot see `authorize_write` state. Writes in those two IDEs remain voluntary.

## Outcome

1. Durable session ledger under `.eos/state/agent-sessions.json` shared by MCP and hooks.
2. Preferred IDEs `cursor` and `antigravity` auto-open or resume a session on SessionStart.
3. Write tools in those IDEs are denied until the mandatory DAG is complete.
4. General IDEs (`claude-code`, `vscode`) keep the same MCP contract; hooks are optional.
5. No Level 5 claims.
