# TASKS-150: Autonomous Closed-Loop Self-Healing & AST Mutation Engine

## Task DAG & Execution Sequence

- [x] **TASK-150-01**: Implement `src/core/eosAutonomousSelfHealingEngine.ts`
  - Define healing archetypes: `NULL_POINTER_GUARD`, `TIMEOUT_BACKOFF_RETRY`, `GRID_SPACING_CONFORMANCE`, `IMPORT_CYCLE_BREAK`, `FALLBACK_VALUE_INJECT`.
  - Implement pattern-based AST fault scanner and surgical mutator.
  - Implement hermetic sandboxed test runner.
  - Implement closed-loop state machine with rollback and SQLite WAL ledger attestation.
  - Integrate OpenTelemetry span recording via `EosOtelTraceEngine`.
- [x] **TASK-150-02**: Implement Test Suite `test/eosAutonomousSelfHealingEngine.test.mjs`
  - Verify BDD-450: Fault isolation & causal blast radius extraction.
  - Verify BDD-451: Surgical AST patch synthesis preserving comments.
  - Verify BDD-452: Hermetic sandboxed patch verification.
  - Verify BDD-453: Fail-closed candidate discard on regression.
  - Verify BDD-454: Autonomous closed-loop promotion and ledger attestation.
  - Verify BDD-455: MCP tool dispatch & OpenTelemetry span linkage.
- [x] **TASK-150-03**: Integrate Self-Healing into `src/mcp/eosMcpServer.ts`
  - Register MCP tools: `eos_autonomous_heal_loop`, `eos_ast_mutation_synthesize`, `eos_self_healing_status`.
  - Update `docs/contracts/mcp-tool-catalog.json`.
- [x] **TASK-150-04**: Add CLI Commands to `bin/eos.mjs`
  - Add `eos heal:loop [targetFile]` and `eos heal:status`.
  - Update CLI operational manual banner.
- [x] **TASK-150-05**: Enhance Studio Console Cockpit in `src/ui/eosStudioConsole.html`
  - Add interactive "Autonomous Self-Healing Loop" visualizer card with stage stepper and real-time healing simulator.
- [x] **TASK-150-06**: Verify 7/7 Sovereign Local Gate & Supply Chain
  - Re-generate CycloneDX SBOM and in-toto SLSA Provenance.
  - Execute full local gate (`verify:strict`) with 0 warnings.
  - Commit and push to `origin/main`.
