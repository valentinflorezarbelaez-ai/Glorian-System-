# ATOMIC TASK DAG: SPOTIFY INSTITUTIONAL ENGINEERING CODEX (TASKS-017)

```mermaid
flowchart TD
    T1["Task 1: Intake & Specs (INTAKE-017, SPEC-024, CHANGE-017, PLAN-017)"] --> T2["Task 2: Core Engine (src/core/eosSpotifyInstitutionalCodex.ts)"]
    T2 --> T3["Task 3: Unit & BDD Tests (test/eosSpotifyInstitutionalCodex.test.mjs)"]
    T3 --> T4["Task 4: Context Matrix Elevation (AGENTS.md)"]
    T4 --> T5["Task 5: MCP & CLI Integration (src/mcp, bin/eos.mjs)"]
    T5 --> T6["Task 6: Master Pipeline Gate & SecDevOps Audit (npm test)"]
```

## Task Checklist

- [x] Task 1: Record Intake, Specification, Change Proposal, and ADR.
- [x] Task 2: Implement `src/core/eosSpotifyInstitutionalCodex.ts` with 6 Spotify Engineering pillars.
- [x] Task 3: Author test suite `test/eosSpotifyInstitutionalCodex.test.mjs` verifying BDD-054.
- [x] Task 4: Elevate `AGENTS.md` with Spotify Institutional Doctrine.
- [x] Task 5: Expose in MCP server and CLI (`eos spotify:institutional`).
- [x] Task 6: Verify 7/7 stages in `scripts/verify-cicd-pipeline.mjs` with exit code 0.
