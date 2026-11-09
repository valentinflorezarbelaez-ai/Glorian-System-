# SPEC-156: Canary Analysis Engine with Non-Parametric Mann-Whitney Verdicts

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Promoting a canary to production requires an objective, statistically defensible verdict rather than a human eyeballing a dashboard. Raw averages miss distribution shifts, and parametric tests assume normality that real service telemetry rarely satisfies. A canary gate must therefore compare canary samples against a baseline using a distribution-free method and translate the result into an actionable pass/fail decision.

The engine follows the production pattern of Netflix Kayenta statistical canary analysis: per metric, compare the canary against the baseline with the Mann-Whitney U rank-sum test (non-parametric, no normality assumption) and classify each metric as PASS, MARGINAL, or FAIL. The `EosCanaryAnalysisEngine` implements this comparison plus hard/soft/marginal metric weighting.

Aggregated results yield a composite canary score (0-100) and an overall verdict, sealed with a deterministic SHA-256 receipt for evidence. The module depends only on kernel primitives, honoring Law V.

## 2. Functional Requirements (EARS Syntax)

- **FR-651 (Ubiquitous - Non-Parametric Per-Metric Comparison)**: `The EOS Canary Analysis Engine shall compare each configured metric's canary samples against its baseline samples using the Mann-Whitney U rank-sum test with a normal approximation, reporting the baseline mean, canary mean, delta, delta percent, and p-value.`
- **FR-652 (State-Driven - Bound Violation Forces FAIL)**: `While a metric config defines an upperBound or lowerBound, the engine shall assign a FAIL verdict to that metric when the canary mean exceeds the upper bound or falls below the lower bound, regardless of the p-value.`
- **FR-653 (Event-Driven - Statistical Threshold Verdicts)**: `When a metric has no bound violation, the engine shall assign FAIL to an HARD metric (or MARGINAL otherwise) when p < 0.01 and the absolute delta percent exceeds 10, assign MARGINAL when p < 0.05 and the absolute delta percent exceeds 5, and assign PASS otherwise.`
- **FR-654 (Ubiquitous - Composite Canary Score)**: `The system shall compute the canary score as 100 minus 40 per hard failure, 15 per soft failure, and 5 per marginal metric, floored at 0.`
- **FR-655 (State-Driven - Overall Verdict Aggregation)**: `While aggregating verdicts, the engine shall return FAIL when any HARD metric failed, MARGINAL when any SOFT metric failed or more than two metrics are marginal, and PASS otherwise.`
- **FR-656 (Ubiquitous - Deterministic Receipt and Frozen Result)**: `The system shall return a deeply frozen analysis result carrying a SHA-256 receipt computed over the canonical verdict, score, and metric count.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-651 Identical distributions yield PASS with score 100
GIVEN an EosCanaryAnalysisEngine and a HARD metric "latency"
WHEN baseline and canary samples are statistically identical
THEN the overall verdict is PASS
AND the canary score is 100

SCENARIO: BDD-652 Canary five times worse fails a hard metric
GIVEN an EosCanaryAnalysisEngine and a HARD metric "latency"
WHEN every canary sample is five times the baseline value
THEN the overall verdict is FAIL
AND the hardFailCount is at least 1

SCENARIO: BDD-653 Bound violation forces FAIL regardless of p-value
GIVEN an EosCanaryAnalysisEngine and a SOFT metric "errorRate" with upperBound 0.05
WHEN the canary mean exceeds the upper bound
THEN that metric verdict is FAIL

SCENARIO: BDD-654 Empty sample sets default to PASS
GIVEN an EosCanaryAnalysisEngine and a metric config with no baseline or canary samples
WHEN the analysis runs
THEN the metric is reported with verdict PASS
AND the result carries a non-empty sha256Receipt
```

## 4. Architecture Decision Records (ADRs)

- **ADR-156-1: Mann-Whitney U instead of parametric mean comparison**
  - _Context_: Service telemetry is skewed and non-normal, so t-tests and mean-only comparisons produce unreliable canary verdicts.
  - _Decision_: Use the Mann-Whitney U rank-sum test with a normal approximation to obtain a distribution-free p-value per metric.
  - _Consequence_: Verdicts are robust to non-normal distributions; the trade-off is a large-sample approximation that favors volume.
- **ADR-156-2: Weighted composite score with hard/soft/marginal classification**
  - _Context_: A single failed metric of differing importance should not weigh the same as another, yet the gate needs one number.
  - _Decision_: Deduct 40 for hard failures, 15 for soft failures, and 5 for marginal metrics to derive the 0-100 score, and drive the overall verdict from the hard/soft/marginal counts.
  - _Consequence_: Critical regressions dominate the score while minor deltas degrade it gracefully.

## 5. Atomic Task DAG

1. [x] **TASK-156-1**: Author SPEC-156 with EARS requirements FR-651..FR-656 and BDD scenarios BDD-651..BDD-654.
2. [x] **TASK-156-2**: Implement the `EosCanaryAnalysisEngine` module (Mann-Whitney U, verdict rules, composite score, receipt).
3. [x] **TASK-156-3**: Add unit tests covering identical distributions, hard failure, bound violation and empty samples.
4. [x] **TASK-156-4**: Integrate the scenario into the Big Tech Resilience test suite and confirm zero external dependencies.
