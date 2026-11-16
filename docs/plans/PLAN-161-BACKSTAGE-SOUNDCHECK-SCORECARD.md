# PLAN-161: Spotify Backstage Soundcheck Real-Time Fleet Scorecards

- **Plan ID**: `PLAN-161`
- **Change ID**: `CHANGE-161`
- **Spec Reference**: `SPEC-299`
- **Tier**: Fleet Governance, DORA Metrics & Institutional Health Certification
- **Status**: `APPROVED`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-15T22:30:00Z

---

## 1. Architectural Strategy & ADRs

### ADR-161-01: Zero-Dependency Soundcheck Governance Engine

- **Context**: Spotify Backstage Soundcheck typically runs as a TypeScript/React plugin hosted in a full Backstage Node/PostgreSQL service, requiring hundreds of npm packages.
- **Decision**: Implement a pure Layer-0 sovereign Soundcheck engine in `src/core/eosBackstageSoundcheckScorecard.ts` using Node.js standard modules (`node:fs`, `node:crypto`, `node:path`). Evaluate local registry projects in `docs/projects/registry.json` directly.
- **Alternatives Considered & Rejected**:
  - _Deploying Backstage instance_: Rejected because it requires hundreds of megabytes of third-party packages, breaching **Law V** and Vercel limits.
  - _Ad-hoc bash scripting_: Rejected due to lack of type safety, non-reproducible grading, and inability to integrate with MCP servers.

### ADR-161-02: Weighted Five-Pillar Scoring Model

- **Context**: A single score obscures whether an application is failing due to security vulnerabilities, slow deployment cycles, or missing specs.
- **Decision**: Structure scoring into 5 distinct pillars:
  1. `Law V Conformance` (25% weight)
  2. `Test Coverage` (25% weight)
  3. `Security Posture` (20% weight)
  4. `Specification Drift` (15% weight)
  5. `DORA Velocity` (15% weight)
     Composite score: $S = \sum (w_i \cdot s_i)$. If Law V fails ($s_1 < 100\%$), the project cannot achieve higher than `LEVEL_1_BRONZE`.

### ADR-161-03: Deterministic DORA Metrics Assessment

- **Context**: Measuring DORA metrics typically requires SaaS agents (Datadog, Dynatrace, LinearB).
- **Decision**: Derive DORA metrics deterministically from git commit timestamps, tag intervals, and test verification timestamps stored in `.eos/` or repository metadata:
  - _Deployment Frequency_: Daily/weekly releases derived from tagged git commits.
  - _Lead Time for Changes_: Time from commit SHA to tip-refresh seal.
  - _Change Failure Rate_: Ratio of rollback/failed verification receipts to total audits.
  - _Mean Time to Restore (MTTR)_: Time between failed audit and subsequent clean pass.

---

## 2. Component Layout & Module Structure

```text
src/core/
  ├── eosBackstageSoundcheckScorecard.types.ts  (~130 lines) -> Pillar, Tier, Scorecard, DORA, Receipt types
  └── eosBackstageSoundcheckScorecard.ts        (~400 lines) -> Engine, 5-pillar scoring, DORA calculator, receipt

bin/commands/
  └── cliSoundcheckScorecard.mjs                (~150 lines) -> CLI subcommands (score, matrix, drift, audit)

test/
  └── eosBackstageSoundcheckScorecard.test.mjs  (~200 lines) -> BDD-1569..BDD-1574 verification
```

---

## 3. Strict Quality Gates

- Line count ceiling: All modules $\le 800$ lines with $\ge 12$ lines of headroom.
- Zero npm runtime dependencies (Law V).
- 100% command parity verified by `hygiene:audit`.
