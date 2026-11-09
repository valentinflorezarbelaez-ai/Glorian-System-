# ATOMIC TASK DAG: NUBANK INSTITUTIONAL ENGINEERING CODEX (TASKS-016)

```mermaid
flowchart TD
    T1["Task 1: Intake & Specs (INTAKE-016, SPEC-023, CHANGE-016, PLAN-016)"] --> T2["Task 2: Core Engine (src/core/eosNubankCodex.ts)"]
    T2 --> T3["Task 3: Unit & BDD Tests (test/eosNubankCodex.test.mjs)"]
    T3 --> T4["Task 4: Context Matrix Elevation (AGENTS.md)"]
    T4 --> T5["Task 5: MCP & CLI Integration (src/mcp, bin/eos.mjs)"]
    T5 --> T6["Task 6: Master Pipeline Gate & SecDevOps Audit (npm test)"]
```

## Task Checklist

- [x] Task 1: Record Intake, Specification, Change Proposal, and ADR.
- [x] Task 2: Implement `src/core/eosNubankCodex.ts` with 6 Building Nu pillars.
- [x] Task 3: Author test suite `test/eosNubankCodex.test.mjs` verifying BDD-053.
- [x] Task 4: Elevate `AGENTS.md` with Nubank Institutional Doctrine.
- [x] Task 5: Expose in MCP server and CLI (`eos nubank`).
- [x] Task 6: Verify 7/7 stages in `scripts/verify-cicd-pipeline.mjs` with exit code 0.
