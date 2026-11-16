# TASKS-161: Spotify Backstage Soundcheck Real-Time Fleet Scorecards

- **Tasks ID**: `TASKS-161`
- **Change ID**: `CHANGE-161`
- **Spec Reference**: `SPEC-299`
- **Tier**: Fleet Governance, DORA Metrics & Institutional Health Certification
- **Status**: `READY`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-15T22:30:00Z

---

## Task Dependency Graph (DAG)

```text
[TASK-161-01: Types Definition]
       │
       ▼
[TASK-161-02: Core Soundcheck Engine Implementation]
       │
       ▼
[TASK-161-03: Core Re-export & Typecheck]
       │
       ▼
[TASK-161-04: CLI Subdispatcher Implementation]
       │
       ▼
[TASK-161-05: CLI Router & Catalog Registration]
       │
       ▼
[TASK-161-06: Test Suite (BDD-1569..BDD-1574)]
       │
       ▼
[TASK-161-07: Tip Refresh & Pre-Push Gate Sealing]
```

---

## Detailed Task Breakdown

### TASK-161-01: Types Definition

- Create `src/core/eosBackstageSoundcheckScorecard.types.ts`.
- Define `SoundcheckPillarId`, `CertificationTier`, `DoraVelocityTier`, `PillarScoreResult`.
- Define `RepositoryScorecard`, `FleetSoundcheckMatrix`, and `SoundcheckReceipt`.
- Done Criteria: Clean compilation under `tsc --noEmit`.

### TASK-161-02: Core Soundcheck Engine Implementation

- Create `src/core/eosBackstageSoundcheckScorecard.ts`.
- Implement `BackstageSoundcheckEngine` class:
  - Five-pillar evaluator: Law V, Test Coverage, Spec Drift, DORA Velocity, Security Posture.
  - Deterministic tier assignment: Bronze, Silver, Gold, Platinum.
  - DORA velocity metrics calculator (Deployment Frequency, Lead Time, Change Failure Rate, MTTR).
  - Drift diagnosis and step-by-step remediation generator.
  - Fleet-wide matrix aggregator scanning `docs/projects/registry.json`.
  - Evidence audit receipt generation at `docs/evidence/SOUNDCHECK_SCORECARD_RECEIPT.json`.
- Done Criteria: Module $\le 450$ lines, zero runtime dependencies.

### TASK-161-03: Core Re-export & Typecheck

- Export types and engine in `src/core/index.ts`.
- Run `npm run typecheck`.
- Done Criteria: Exit code 0, 0 type errors.

### TASK-161-04: CLI Subdispatcher Implementation

- Create `bin/commands/cliSoundcheckScorecard.mjs`.
- Implement commands:
  - `toolchain:soundcheck:score`
  - `toolchain:soundcheck:matrix`
  - `toolchain:soundcheck:drift`
  - `toolchain:soundcheck:audit`
- Done Criteria: Functional execution returning formatted JSON and human summary.

### TASK-161-05: CLI Router & Catalog Registration

- Wire `toolchain:soundcheck:` in `bin/commands/cliToolchainRouter.mjs`.
- Register in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md`.
- Run `node bin/eos.mjs hygiene:audit`.
- Done Criteria: 100.00% command parity verified.

### TASK-161-06: Test Suite (BDD-1569..BDD-1574)

- Create `test/eosBackstageSoundcheckScorecard.test.mjs`.
- Verify scenarios BDD-1569 through BDD-1574.
- Run `node --test test/eosBackstageSoundcheckScorecard.test.mjs`.
- Done Criteria: 100% tests passing, exit code 0.

### TASK-161-07: Tip Refresh & Pre-Push Gate Sealing

- Run `node scripts/tip-refresh.mjs` to synchronize active spec count (299) and test count (291).
- Format files with prettier.
- Seal freeze pin and push to `origin/main`.
- Done Criteria: All CI gates pass cleanly.
