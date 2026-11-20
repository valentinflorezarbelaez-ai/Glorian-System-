# TASKS-230: Implementation Checklist for Adversarial Red-Team Crucible & Minimax Exploit-Patch Game

**Document ID**: `TASKS-230-ADVERSARIAL-RED-TEAM-CRUCIBLE`  
**Specification Target**: `SPEC-368` / `CHANGE-230`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `VERIFIED`

---

## 1. Specification & Formal Verification Gate

- [x] **Task 1.1**: Author `docs/intake/eos-system/INTAKE-230-ADVERSARIAL-RED-TEAM-CRUCIBLE.md`.
- [x] **Task 1.2**: Author `openspec/changes/CHANGE-230-adversarial-red-team-crucible.md`.
- [x] **Task 1.3**: Author `openspec/specs/SPEC-368-adversarial-red-team-crucible.md` with formal EARS and BDD.
- [x] **Task 1.4**: Author `docs/plans/PLAN-230-ADVERSARIAL-RED-TEAM-CRUCIBLE.md` with ADR-230-001.
- [x] **Task 1.5**: Author `docs/tasks/TASKS-230-ADVERSARIAL-RED-TEAM-CRUCIBLE.md`.
- [x] **Task 1.6**: Record Level 3 Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **Task 1.7**: Author Leslie Lamport TLA+ Model 111 (`docs/formal/AdversarialRedTeamCrucible.tla` and `.cfg`).
- [x] **Task 1.8**: Register in `scripts/run-tlc.mjs` and execute TLC validation (Exit Code 0).

---

## 2. Core Implementation

- [x] **Task 2.1**: Author `src/core/eosAdversarialRedTeamCrucible.types.ts` defining attacks, payloads, counterexamples, defensive patches, tournament metrics, and receipts ($\le 800$ lines).
- [x] **Task 2.2**: Author `src/core/eosAdversarialRedTeamCrucible.ts` implementing attack generators, CEGIS patch synthesizers, isolated harness, and minimax engine ($\le 800$ lines).
- [x] **Task 2.3**: Export in `src/core/index.ts`.

---

## 3. Toolchain & CLI Integration

- [x] **Task 3.1**: Author `bin/commands/cliAdversarialRedTeamCrucible.mjs` supporting `toolchain:crucible:attack`, `toolchain:crucible:patch`, `toolchain:crucible:tournament`, and `toolchain:crucible:audit`.
- [x] **Task 3.2**: Register dispatcher in `bin/commands/cliToolchainRouter.mjs`.
- [x] **Task 3.3**: Document commands in `bin/commands/cliHelpCatalog.mjs`.

---

## 4. Phase 8 MCP Tool Wiring

- [x] **Task 4.1**: Register `eos_adversarial_red_team_crucible_audit` in `src/core/eosMcpToolTaxonomy.ts`.
- [x] **Task 4.2**: Define tool schema in `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`.
- [x] **Task 4.3**: Implement handler in `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`.
- [x] **Task 4.4**: Update `docs/contracts/mcp-tool-catalog.json`.

---

## 5. Automated Verification & Delivery

- [x] **Task 5.1**: Author `test/eosAdversarialRedTeamCrucible.test.mjs` verifying `BDD-1987` through `BDD-1992`.
- [x] **Task 5.2**: Run test suite and verify 100% pass rate.
- [x] **Task 5.3**: Run `node scripts/tip-refresh.mjs` and `npm run hygiene:audit`.
- [x] **Task 5.4**: Run Prettier and supply chain bind.
- [x] **Task 5.5**: Git commit, seal release pin, and push to `origin/main`.
