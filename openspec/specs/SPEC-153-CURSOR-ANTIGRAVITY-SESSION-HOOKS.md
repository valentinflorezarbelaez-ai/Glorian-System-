# SPEC-153: Cursor & Antigravity Session Hook Enforcement

## 1. Specification Metadata
- **Specification ID**: `SPEC-153`
- **Status**: `APPROVED`
- **Related Specs**: `SPEC-152`, `SPEC-043`, `SPEC-147`
- **Architectural Decisions**: `ADR-0191`, `ADR-0192`
- **Module Target**: `src/core/eosUniversalAgentSessionContract.ts`, `integrations/antigravity/eos-governance/scripts/eos-hook.mjs`, `.cursor/hooks.json`, `scripts/eos-ide-session-hook.mjs`, `test/eosIdeSessionHooks.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-490 (Ubiquitous / Durable ledger)**: `THE SYSTEM SHALL persist agent sessions to .eos/state/agent-sessions.json including activeByIde pointers for cursor and antigravity so MCP and IDE hooks share one ledger.`

- **FR-491 (Event-Driven / Preferred SessionStart)**: `WHEN a SessionStart hook runs for ideFamily cursor or antigravity, THE SYSTEM SHALL ensure an active session exists (resume or open) and inject the sessionId, sessionReceipt, and mandatory tool list.`

- **FR-492 (Unwanted condition / Preferred write gate)**: `IF a write-class tool is invoked in cursor or antigravity while the active session is missing, expired, Law-IV blocked, or has incomplete mandatory DAG tools, THEN THE SYSTEM SHALL deny the write.`

- **FR-493 (Event-Driven / MCP DAG auto-record)**: `WHEN the MCP server successfully dispatches a tool that appears in an active session DAG, THE SYSTEM SHALL record that tool against every live session that lists it.`

- **FR-494 (Ubiquitous / General IDE parity)**: `THE SYSTEM SHALL keep claude-code and vscode supported via eos_agent_session_contract without requiring project hooks; Cursor and Antigravity are the preferred enforcement surfaces.`

- **FR-495 (Ubiquitous / Scope)**: `THE SYSTEM SHALL NOT claim Level 5 autonomy under this specification.`

---

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: BDD-467 Durable ledger shared across processes
  GIVEN a contract that opens a cursor session
  WHEN a second contract instance loads the same projectRoot
  THEN getActiveSessionForIde("cursor") returns the same sessionId and sessionReceipt

SCENARIO: BDD-468 Preferred SessionStart ensure
  GIVEN ideFamily antigravity
  WHEN ensurePreferredIdeSession is called
  THEN an active session exists with mandatoryTools length >= 1

SCENARIO: BDD-469 Cursor/Antigravity write deny then allow
  GIVEN an ensured cursor session with incomplete DAG
  WHEN evaluatePreferredWriteGate("cursor") is called
  THEN decision equals deny
  WHEN all mandatory tools are recorded
  AND evaluatePreferredWriteGate("cursor") is called again
  THEN decision equals allow

SCENARIO: BDD-470 Antigravity hook SessionStart mentions session contract
  GIVEN evaluateHookEvent SessionStart with projectRoot
  THEN the injected system message includes eos_agent_session_contract
  AND includes sessionId

SCENARIO: BDD-471 Cursor hook script denies Write without DAG
  GIVEN a fresh project ledger with incomplete cursor session
  WHEN scripts/eos-ide-session-hook.mjs runs for cursor preToolUse Write
  THEN permission equals deny
```
