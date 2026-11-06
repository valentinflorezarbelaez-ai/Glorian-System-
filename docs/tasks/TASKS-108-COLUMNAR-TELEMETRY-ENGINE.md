# TASKS-108: Atomic Implementation DAG — In-Memory Columnar Telemetry Slice Engine

Governed by SPEC-108 and PLAN-108.

## Task Graph (Strictly Sequential Execution)

- [x] **TASK-108-1: Formal Specification & Architecture Plan Package**
  - Path: `openspec/specs/SPEC-108-COLUMNAR-TELEMETRY-ENGINE.md`, `docs/plans/PLAN-108-COLUMNAR-TELEMETRY-ENGINE.md`
  - Criteria: IEEE 830 EARS syntax, BDD scenarios, mathematical invariants, ADR with rejected alternatives.

- [x] **TASK-108-2: TLA+ Formal Verification Specification & Bounded Simulation**
  - Path: `docs/formal/ColumnarTelemetryEngine.tla`, `scripts/verify-formal-tla.mjs`
  - Criteria: Invariants `SafetyInvariant`, `ColumnarCapacityInvariant`, `DictionaryBijectionInvariant`.

- [x] **TASK-108-3: Core Module Implementation (`EosColumnarTelemetryEngine`)**
  - Path: `src/core/eosColumnarTelemetryEngine.ts`
  - Criteria: Pure Layer 0, zero external npm runtime deps, contiguous TypedArrays, dictionary encoding, sub-millisecond percentiles, streaming Z-score anomaly detection.

- [x] **TASK-108-4: Multi-Channel MCP Tool Exposure**
  - Path: `src/mcp/eosMcpServer.ts`, `src/mcp/eosMcpToolCatalog.ts`, `docs/contracts/mcp-tool-catalog.json`
  - Criteria: Tool `eos_columnar_telemetry_query` registered and callable with strict schemas.

- [x] **TASK-108-5: Unit & Integration Test Suite**
  - Path: `test/eosColumnarTelemetryEngine.test.mjs`
  - Criteria: 100% test pass on BDD-276, BDD-277, BDD-278, sub-millisecond query verification, zero memory leaks.

- [x] **TASK-108-6: Full 7-Stage Strict SecDevOps Verification Gate**
  - Commands: `npm run verify:strict`, `npm test`
  - Criteria: Exit code 0, 0 lint/secret/contract violations, 100% test suites green.
  - Commands: `npm run verify:strict`, `npm test`
  - Criteria: Exit code 0, 0 lint/secret/contract violations, 100% test suites green.
