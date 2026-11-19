# TASKS-212: Autonomous Zero-Knowledge Circuit Synthesizer & Arithmetization Engine (`SPEC-350`)

- **Change ID**: `CHANGE-212`
- **Spec**: `SPEC-350`
- **Status**: `READY_FOR_EXECUTION`

---

## Task Dependency Graph (DAG)

```text
[TASK-212-01: Auth Gate] ──────────┐
                                   ▼
[TASK-212-02: TLA+ Model] ─────────┼─► [TASK-212-04: Core Synthesizer] ─► [TASK-212-05: CLI & MCP] ─► [TASK-212-06: Test Suite] ─► [TASK-212-07: Verify & Seal]
                                   ▲
[TASK-212-03: Types Definition] ──┘
```

---

## Atomic Tasks

- [x] **TASK-212-01**: Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **TASK-212-02**: Author TLA+ formal model `docs/formal/ZkCircuitSynthesizer.tla` and `docs/formal/ZkCircuitSynthesizer.cfg` (Model 93).
- [x] **TASK-212-03**: Create TypeScript interfaces in `src/core/eosZkCircuitSynthesizer.types.ts`.
- [x] **TASK-212-04**: Implement `EosZkCircuitSynthesizerCore` in `src/core/eosZkCircuitSynthesizer.ts` ($\le 800$ lines, $\ge 12$ headroom, zero dependencies).
- [x] **TASK-212-05**: Implement CLI handler `bin/commands/cliZkCircuitSynthesizer.mjs` and register in `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, and Phase 8 MCP tools.
- [x] **TASK-212-06**: Implement automated test suite `test/eosZkCircuitSynthesizer.test.mjs` verifying BDD-1879..BDD-1884.
- [x] **TASK-212-07**: Execute `npm run verify:strict`, seal freeze gate with `npm run tip-refresh && npm run tip-refresh:seal`, commit and push to `origin/main`.
