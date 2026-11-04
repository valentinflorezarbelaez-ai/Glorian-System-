# SPEC-154: Glorian ↔ Gentleman Gentle-AI Stack Co-Governance Bind

## 1. Specification Metadata
- **Specification ID**: `SPEC-154`
- **Status**: `APPROVED`
- **Related Specs**: `SPEC-044`, `SPEC-045`, `SPEC-152`, `SPEC-153`
- **External canon**: Gentleman Programming Gentle-AI Stack — site https://gentlemanprogramming.com/, GitHub https://github.com/Gentleman-Programming, YouTube main https://www.youtube.com/@gentlemanprogramming/videos, YouTube VODs https://www.youtube.com/@GentlemanProgrammingVods (Alan Buscaglia). Doctrine encoded in `EosGentlemanStackBridge.EXTERNAL_CANON` (ODD, Engram, focused agents, GGA review, verification over generation).
- **Module Target**: `src/core/eosUniversalAgentSessionContract.ts`, `src/core/eosGentlemanStackBridge.ts`, `scripts/eos-ide-session-hook.mjs`, `integrations/antigravity/eos-governance/scripts/eos-hook.mjs`, `src/mcp/eosMcpServer.ts`, `test/eosGentleAiCogovernanceBind.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-496 (Ubiquitous / Division of labor)**: `THE SYSTEM SHALL treat Glorian/EOS as the constitutional control plane and the Gentleman Programming Gentle-AI Stack (gentle-ai, engram, gga, context7, agent-teams-lite) as the complementary memory-workflow-review plane, with zero role collision.`

- **FR-497 (Event-Driven / Align on preferred ensure)**: `WHEN ensurePreferredIdeSession runs for cursor or antigravity, THE SYSTEM SHALL align the Gentleman stack via EosGentlemanStackBridge.auditStack and persist readinessScore, status, and sha256Receipt on the durable session ledger.`

- **FR-498 (Event-Driven / SessionStart injection)**: `WHEN a preferred IDE SessionStart hook runs, THE SYSTEM SHALL inject the six-phase co-governance protocol from EosGentlemanStackBridge.CO_GOVERNANCE_PROTOCOL together with sessionId and Gentleman readiness.`

- **FR-499 (Event-Driven / MCP align action)**: `WHEN eos_agent_session_contract is invoked with action align_gentleman, THE SYSTEM SHALL return the Gentleman audit report fields required for agents to continue Engram recall and GGA review.`

- **FR-500 (Ubiquitous / Scope)**: `THE SYSTEM SHALL NOT replace gentle-ai, engram, or gga binaries, and SHALL NOT claim Level 5 autonomy.`

---

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: BDD-472 Preferred ensure persists Gentleman alignment
  GIVEN project root with Gentleman stack installed
  WHEN ensurePreferredIdeSession is called for cursor
  THEN the ledger contains gentlemanAlignment.readinessScore as a number
  AND gentlemanAlignment.status is a non-empty string
  AND gentlemanAlignment.sha256Receipt matches /^[a-f0-9]{64}$/

SCENARIO: BDD-473 SessionStart message cites Engram and GGA
  GIVEN scripts/eos-ide-session-hook.mjs sessionStart for antigravity
  THEN the injected text includes engram
  AND includes gga
  AND includes eos_agent_session_contract
  AND includes gentle-ai or Gentleman

SCENARIO: BDD-474 MCP align_gentleman dispatch
  GIVEN EosMcpServer
  WHEN eos_agent_session_contract action align_gentleman is called
  THEN readinessScore is between 0 and 100
  AND coGovernanceProtocol length equals 6
```
