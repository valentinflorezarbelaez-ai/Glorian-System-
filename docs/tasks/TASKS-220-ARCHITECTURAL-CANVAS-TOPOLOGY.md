# TASKS-220: Atomic Task Breakdown for Live Architectural Canvas & Bi-Directional Topology

**Task Document ID**: `TASKS-220-ARCHITECTURAL-CANVAS-TOPOLOGY`  
**Specification**: `SPEC-358`  
**Change Proposal**: `CHANGE-220`  
**Status**: `READY_FOR_EXECUTION`

---

## 1. Task Dependency Graph (DAG)

```
[TASK-220-01] Formal TLA+ Model 101 Specification & Config
      │
      ▼
[TASK-220-02] Core Types Definition (eosArchitecturalCanvas.types.ts)
      │
      ▼
[TASK-220-03] Core Domain Implementation (eosArchitecturalCanvas.ts)
      │
      ├───────────────────────────────┐
      ▼                               ▼
[TASK-220-04] CLI & Router Handler   [TASK-220-05] Phase 8 MCP Tool Wiring
      │                               │
      └──────────────┬────────────────┘
                     ▼
[TASK-220-06] Automated BDD Test Suite (eosArchitecturalCanvas.test.mjs)
      │
      ▼
[TASK-220-07] Leslie Lamport TLC Formal Model Check (Model 101)
      │
      ▼
[TASK-220-08] Full 7-Stage SecDevOps Verification, Freeze Seal & Push
```

---

## 2. Detailed Task Specifications

- **TASK-220-01**: Author `docs/formal/ArchitecturalCanvasTopology.tla` and `docs/formal/ArchitecturalCanvasTopology.cfg`. Register in `scripts/run-tlc.mjs`.
- **TASK-220-02**: Author `src/core/eosArchitecturalCanvas.types.ts` with all types, interfaces, enums, and geometric layouts.
- **TASK-220-03**: Author `src/core/eosArchitecturalCanvas.ts` implementing `EosTopologyHarvester`, `EosCanvasLayoutEngine`, `EosInteractiveTopologyManager`, `EosCanvasSvgRenderer`, and `EosArchitecturalCanvasCore`. Export in `src/core/index.ts`.
- **TASK-220-04**: Author `bin/commands/cliArchitecturalCanvas.mjs`. Wire into `bin/commands/cliToolchainRouter.mjs` and `bin/commands/cliHelpCatalog.mjs`.
- **TASK-220-05**: Register `eos_architectural_canvas_audit` in `src/core/eosMcpToolTaxonomy.ts`, `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`, `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`, and `docs/contracts/mcp-tool-catalog.json`.
- **TASK-220-06**: Author `test/eosArchitecturalCanvas.test.mjs` verifying `BDD-1927`..`BDD-1932`.
- **TASK-220-07**: Run TLC Model 101 model check and verify clean exit.
- **TASK-220-08**: Run `node scripts/tip-refresh.mjs`, `npm run hygiene:audit`, `npm run supply-chain:bind`, `npm run verify:strict`, commit, seal freeze pin, and push to `origin/main`.
