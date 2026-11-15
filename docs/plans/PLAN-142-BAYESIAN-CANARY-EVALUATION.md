# PLAN-142: Bayesian Dynamic Canary Evaluation & Automated Rollback Gateway

## Progressive Delivery & Automated Canary Analysis (SPEC-280)

---

### 1. Architectural Strategy

- **Layer-0 Statistical Distribution Engine (`src/core/eosBayesianCanaryEvaluator.ts`)**:
  - Implements lightweight, pure TypeScript numeric aggregations without external statistical packages (`dependencies: {}`).
  - Sorts duration arrays to extract P50, P90, P95, P99 percentiles deterministically.
  - Computes mean, sample variance, and standard deviation.
  - Calculates relative percentile shifts:
    $$\Delta P_{99} = \frac{P_{99,\text{canary}} - P_{99,\text{baseline}}}{P_{99,\text{baseline}}}$$
  - Computes error rate differential:
    $$\Delta \text{ErrorRate} = \frac{\text{errors}_{\text{canary}}}{\text{total}_{\text{canary}}} - \frac{\text{errors}_{\text{baseline}}}{\text{total}_{\text{baseline}}}$$
  - Composite Health Score $S \in [0, 100]$:
    - Base score = 100.
    - Subtract points based on error rate delta ($S \leftarrow S - \Delta \text{ErrorRate} \times 1000$).
    - Subtract points based on latency regressions ($S \leftarrow S - \max(0, \Delta P_{99}) \times 100$).
    - Clamped to $[0, 100]$.
- **Automated Rollback Synthesizer**:
  - If verdict is `ROLLBACK_TRIGGERED`, synthesizes a `RollbackManifest`:
    - `targetRevision`: previous stable commit or tag (e.g. `baselineRevision`).
    - `reason`: composite reason list.
    - `timestamp`: ISO timestamp.
    - `action`: `INSTANT_TRAFFIC_DRAIN_AND_REVERT`.
- **CLI Subcommand Delegation**:
  - Dedicated CLI module in `bin/commands/cliCanaryEval.mjs` ($\le 140$ lines).
  - Subcommands `toolchain:canary:eval`, `toolchain:canary:score`, `toolchain:canary:rollback` wired into `bin/commands/cliDevOps.mjs`.

### 2. File Invariants

- `src/core/eosBayesianCanaryEvaluator.ts` ($\le 380$ lines).
- `bin/commands/cliCanaryEval.mjs` ($\le 140$ lines).
- `test/eosBayesianCanaryEvaluator.test.mjs` ($\le 250$ lines).
- Sample telemetry template in `templates/canary/sample-canary-telemetry.json`.
