# TASKS-219: Implementation Tasks for Bitemporal Event Sourcing Hyper-Ledger

## Task Graph DAG

- [x] **Task 1: Intake & Specification Authorization**
  - Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md` (`AUTH-2026-11-19-BITEMPORAL-EVENT-SOURCING-LEDGER`).
- [ ] **Task 2: Core Type System Implementation**
  - Implement `src/core/eosBitemporalEventSourcingLedger.types.ts` defining `BitemporalDatom`, `LidrSdlcEventType`, `LidrSdlcEvent`, `BitemporalQueryFilter`, and `BitemporalAuditReceipt`.
- [ ] **Task 3: Core Domain Module Implementation**
  - Implement `src/core/eosBitemporalEventSourcingLedger.ts`:
    - `EosBitemporalDatomStore`: Immutable append-only fact log with SHA-256 block chaining and Merkle root calculation.
    - `EosBitemporalProjectionEngine`: 2D `asOf(txTime, validTime)` time-travel projection and state machine folding.
    - `EosBitemporalLedgerCore`: LIDR agentic SDLC lifecycle recorder, throughput benchmark runner, and formal audit driver.
  - Export in `src/core/index.ts`.
- [ ] **Task 4: Leslie Lamport TLA+ Model 100 Formal Verification**
  - Author `docs/formal/BitemporalEventLedger.tla` and `docs/formal/BitemporalEventLedger.cfg`.
  - Register in `scripts/run-tlc.mjs`.
- [ ] **Task 5: CLI Command Handlers & Toolchain Router Integration**
  - Implement `bin/commands/cliBitemporalEventLedger.mjs` (`toolchain:ledger:append`, `toolchain:ledger:asof`, `toolchain:ledger:bench`, `toolchain:ledger:audit`).
  - Wire into `bin/commands/cliToolchainRouter.mjs` and `bin/commands/cliHelpCatalog.mjs`.
- [ ] **Task 6: Phase 8 MCP Server Tool Integration**
  - Register `eos_bitemporal_ledger_audit` in `src/core/eosMcpToolTaxonomy.ts`, `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`, `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`, and `docs/contracts/mcp-tool-catalog.json`.
- [ ] **Task 7: Automated Test Suite & BDD Scenarios**
  - Implement `test/eosBitemporalEventSourcingLedger.test.mjs` verifying `BDD-1921` through `BDD-1926`.
- [ ] **Task 8: Ground Truth Synchronization, Supply Chain & 7-Stage SecDevOps Gate**
  - Run `node scripts/tip-refresh.mjs` (spec count 357, TLA+ count 100).
  - Run `npm run hygiene:audit`.
  - Run `npm run supply-chain:bind`.
  - Run `npm run verify:strict`, commit, seal freeze pin, and push.
