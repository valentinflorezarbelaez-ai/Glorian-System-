# SPEC-209: Layer-0 Streaming Isolation Forest Anomaly Detector

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Core / Observability, Telemetry & Unsupervised Anomaly Detection
- **Standard**: Liu, Ting & Zhou (IEEE ICDM 2008 / ACM TKDD 2012) Isolation Forest
- **Module**: `src/core/eosIsolationForestDetector.ts`

---

## 1. Context and Rationale

Real-time telemetry analysis, distributed tracing anomaly detection, SRE error budget burndown alerts, and adversarial packet filtering require unsupervised anomaly detection with linear complexity and zero external runtime dependencies.

`EosIsolationForestDetector` implements Dr. Fei Tony Liu's Isolation Forest algorithm in pure TypeScript, isolating outliers directly via recursive random sub-sampling trees and emitting tamper-evident cryptographic receipts.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-1064 (Ubiquitous - Recursive Isolation Tree Construction)**: `THE SYSTEM SHALL build an ensemble of n_trees binary iTrees up to max depth ceil(log2(subsample_size)) by randomly selecting split dimensions and uniform split points.`

- **FR-1065 (Ubiquitous - Path Length & BST Unsuccessful Search Correction)**: `THE SYSTEM SHALL calculate traversal path length h(x) and normalize by the average BST path length c(n) = 2*(ln(n-1) + gamma) - 2*(n-1)/n.`

- **FR-1066 (Ubiquitous - Anomaly Scoring & Threshold Classification)**: `WHEN scoring an instance x, THE SYSTEM SHALL compute s(x, n) = 2^(-E(h(x))/c(n)) and classify as anomalous when s(x, n) >= threshold (default 0.6).`

- **FR-1067 (Event-Driven - Streaming Sliding Window Ingestion)**: `WHEN new metric vectors arrive in a stream, THE SYSTEM SHALL append them to a fixed-capacity sliding window and retrain the forest when window updates exceed a drift threshold.`

- **FR-1068 (Ubiquitous - Tamper-Evident Anomaly Receipts)**: `THE SYSTEM SHALL output immutable SHA-256 anomaly detection receipts detailing scored points, anomalies identified, anomaly scores, and feature explanations.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-1064 Isolation Tree recursive partitioning and depth bounding
  GIVEN a training sample of multidimensional vectors
  WHEN an iTree is grown with subsample size psi
  THEN tree depth is bounded by ceil(log2(psi))
  AND leaf nodes isolate unique instances or identical feature values.

SCENARIO: BDD-1065 Path length evaluation and BST normalization
  GIVEN an ensemble of trained iTrees
  WHEN instances are evaluated across all trees
  THEN outlier points exhibit significantly shorter mean path lengths than inliers
  AND normalization by c(psi) produces monotonic scores in [0, 1].

SCENARIO: BDD-1066 Outlier separation and anomaly threshold classification
  GIVEN a dataset containing a dense cluster of inliers and extreme outliers
  WHEN anomaly scores are evaluated with threshold 0.6
  THEN inliers score below 0.5 and outliers score strictly above 0.6.

SCENARIO: BDD-1067 Streaming sliding window updates and drift detection
  GIVEN a streaming detector with window capacity W
  WHEN new metric vectors arrive continuously
  THEN the sliding window preserves the most recent W observations
  AND anomalous bursts trigger immediate detection.

SCENARIO: BDD-1068 End-to-end CLI execution and cryptographic anomaly receipt
  GIVEN an array of telemetry vectors passed to glorian anomaly:detect
  WHEN the detection pipeline evaluates the points
  THEN the CLI reports anomaly counts, highest scored outliers, and feature contributions
  AND outputs an immutable SHA-256 anomaly receipt.
```

---

## 4. Architectural Boundaries and Invariants

1. **Law V Compliance**: Strictly zero external runtime dependencies (`"dependencies": {}`).
2. **Determinism**: Fully deterministic when supplied with pseudo-random seed generator.
3. **Immutability & Safety**: All returned anomaly reports and receipts are frozen with `deepFreeze`.
