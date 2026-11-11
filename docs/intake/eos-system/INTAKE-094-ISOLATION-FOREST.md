# INTAKE-094: Layer-0 Streaming Isolation Forest Anomaly Detector

- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Lifecycle Tier**: Core / Observability, Telemetry & Unsupervised Anomaly Detection
- **Governed Spec**: `SPEC-209`
- **Governed Change**: `CHANGE-094`
- **Standard**: Liu, Ting & Zhou (IEEE ICDM 2008 / ACM TKDD 2012) Isolation Forest

---

## 1. Context and Problem Statement

Production telemetry pipelines, distributed SRE metrics, SLO latency bounds, and security breach monitors require robust, unsupervised multidimensional anomaly detection without labeled ground truth.

Traditional distance-based or density-based clustering techniques (k-NN, DBSCAN, LOF) exhibit $O(N^2)$ quadratic complexity and struggle with high dimensional noise, while deep autoencoders require external ML frameworks violating zero-dependency requirements (Law V).

Isolation Forest isolates anomalous data points directly via recursive random feature partitioning trees (iTrees), offering linear time complexity $O(T \cdot \psi \log \psi)$ and minimal memory footprint.

---

## 2. Strategic Objectives

1. Implement pure TypeScript Layer-0 Isolation Forest and Isolation Tree (iTree) structures over multi-featured vector data.
2. Calculate exact average path length $c(\psi)$ using the Euler-Mascheroni constant $\gamma \approx 0.5772156649$.
3. Compute normalized anomaly scores $s(x, \psi) \in [0, 1]$, where scores $\ge 0.6$ flag anomalous points.
4. Provide a streaming sliding window detector that dynamically updates the ensemble as new data arrives.
5. Guarantee 100% deterministic reproducibility when initialized with random seed nonces.
6. Emit tamper-evident SHA-256 anomaly detection receipts.
7. Conform strictly to the Seven Inviolable Laws of EOS (Law V: `"dependencies": {}`).
