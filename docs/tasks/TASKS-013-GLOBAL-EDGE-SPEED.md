# ATOMIC TASK DAG: GLOBAL EDGE ANYCAST ARBITER & SPEED MESH (TASKS-013)

```mermaid
flowchart TD
    T1["Task 1: Intake & Specs (INTAKE-013, SPEC-020, CHANGE-013, PLAN-013)"] --> T2["Task 2: Core Engine (src/core/eosGlobalEdgeArbiter.ts)"]
    T2 --> T3["Task 3: Unit & Chaos Tests (test/eosGlobalEdgeArbiter.test.mjs)"]
    T3 --> T4["Task 4: MCP & CLI Integration (src/mcp, bin/eos.mjs, src/cli)"]
    T4 --> T5["Task 5: Landing Page Global Map & Hedged Request UI (index.html, js/eos.js)"]
    T5 --> T6["Task 6: Master Pipeline Gate & SecDevOps Audit (npm test)"]
```

## Task Checklist

- [x] Task 1: Record Intake, Specifications, Change Proposal, and ADR.
- [ ] Task 2: Implement `EosGlobalEdgeArbiter` with 8 POPs, Haversine RTT, Hedged Requests, HLC, and Edge Cache.
- [ ] Task 3: Author comprehensive test suite `test/eosGlobalEdgeArbiter.test.mjs` verifying BDD-050.
- [ ] Task 4: Expose `eos_global_edge_route` in MCP and `eos edge` in CLI.
- [ ] Task 5: Integrate Global Edge UI into `index.html` and `js/eos.js`.
- [ ] Task 6: Verify 7/7 stages in `scripts/verify-cicd-pipeline.mjs` with exit code 0.
