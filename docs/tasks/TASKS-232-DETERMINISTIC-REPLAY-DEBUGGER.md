# TASKS-232: Implementation Checklist for Deterministic Replay Debugger & MCTS Time-Travel Studio

**Document ID**: `TASKS-232-DETERMINISTIC-REPLAY-DEBUGGER`  
**Specification Target**: `SPEC-370` / `CHANGE-232`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `VERIFIED`

---

## 1. Specification & Formal Verification Gate

- [x] **Task 1.1**: Author `docs/intake/eos-system/INTAKE-232-DETERMINISTIC-REPLAY-DEBUGGER.md`.
- [x] **Task 1.2**: Author `openspec/changes/CHANGE-232-deterministic-replay-debugger.md`.
- [x] **Task 1.3**: Author `openspec/specs/SPEC-370-deterministic-replay-debugger.md` with formal EARS and BDD.
- [x] **Task 1.4**: Author `docs/plans/PLAN-232-DETERMINISTIC-REPLAY-DEBUGGER.md` with ADR-232-001.
- [x] **Task 1.5**: Author `docs/tasks/TASKS-232-DETERMINISTIC-REPLAY-DEBUGGER.md`.
- [x] **Task 1.6**: Record Level 3 Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **Task 1.7**: Author Leslie Lamport TLA+ Model 113 (`docs/formal/DeterministicReplayDebugger.tla` and `.cfg`).
- [x] **Task 1.8**: Register in `scripts/run-tlc.mjs` and execute TLC validation (Exit Code 0).

---

## 2. Core Implementation

- [x] **Task 2.1**: Author `src/core/eosDeterministicReplayDebugger.types.ts` defining checkpoints, trajectories, MCTS nodes, UCT metrics, and receipts ($\le 800$ lines).
- [x] **Task 2.2**: Author `src/core/eosDeterministicReplayDebugger.ts` implementing checkpoint recording, bit-exact rewind, counterfactual branching, and time-slider scrubbing ($\le 800$ lines).
- [x] **Task 2.3**: Export in `src/core/index.ts`.

---

## 3. Toolchain & CLI Integration

- [x] **Task 3.1**: Author `bin/commands/cliDeterministicReplayDebugger.mjs` supporting `toolchain:replay:record`, `toolchain:replay:step`, `toolchain:replay:branch`, and `toolchain:replay:audit`.
- [x] **Task 3.2**: Register dispatcher in `bin/commands/cliToolchainRouter.mjs`.
- [x] **Task 3.3**: Document commands in `bin/commands/cliHelpCatalog.mjs`.

---

## 4. Phase 8 MCP Tool Wiring

- [x] **Task 4.1**: Register `eos_deterministic_replay_debugger_audit` in `src/core/eosMcpToolTaxonomy.ts`.
- [x] **Task 4.2**: Define tool schema in `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`.
- [x] **Task 4.3**: Implement handler in `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`.
- [x] **Task 4.4**: Update `docs/contracts/mcp-tool-catalog.json`.

---

## 5. Automated Verification & Delivery

- [x] **Task 5.1**: Author `test/eosDeterministicReplayDebugger.test.mjs` verifying `BDD-1999` through `BDD-2004`.
- [x] **Task 5.2**: Run test suite and verify 100% pass rate.
- [x] **Task 5.3**: Run `node scripts/tip-refresh.mjs` and `npm run hygiene:audit`.
- [x] **Task 5.4**: Run Prettier and supply chain bind.
- [x] **Task 5.5**: Git commit, seal release pin, and push to `origin/main`.
