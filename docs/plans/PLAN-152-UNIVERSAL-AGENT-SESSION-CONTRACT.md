# PLAN-152: Universal Agent Session Contract & Product Golden Path Enforcement

## ADR-0189: Session contract reuses Antigravity mission classification

- **Context**: Four IDE families need the same write policy.
- **Decision**: `EosUniversalAgentSessionContract.openSession` calls `EosAntigravityDirector.directMission`. The session stores `ideFamily`, `sessionId` (CSPRNG UUID), `sessionReceipt` (SHA-256 over ide + plan receipt + sessionId), the mandatory DAG tool names, and a completed-tool set. `authorizeWrite` is fail-closed.
- **Rejected**: Per-IDE forks of the DAG builder. One policy engine, many adapters.

## ADR-0190: Real gates on materialization; hermetic only for dry-run defaults

- **Context**: Hermetic turbo stubs always exit 0 with `LAYER0_DEPENDENCIES_EMPTY`.
- **Decision**: `createRealVerificationGatePort(projectRoot)` reads `package.json` `dependencies`, runs secret pattern detection, and evaluates mutation floor. `deliverProduct` selects it when `dryRun === false` and no gates port is injected. Scorecard `< 80` returns `BLOCKED` / `SCORECARD_FLOOR`.
- **Rejected**: Spawning the full 7-stage CI on every dogfood write inside unit tests as the only path. Process spawn remains optional; package.json inspection is mandatory for real gates.

## Consequences

MCP exposes `eos_agent_session_contract` with actions `open`, `record_tool`, `authorize_write`, `status`. Layer-0 purity preserved.
