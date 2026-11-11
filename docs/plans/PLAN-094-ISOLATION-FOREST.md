# PLAN-094: Layer-0 Streaming Isolation Forest Anomaly Detector (SPEC-209)

- **Date**: 2026-11-10
- **Architect**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Status**: APPROVED

---

## 1. Technical Strategy

1. **Isolation Tree Data Structure (`EosIsolationTree`)**:
   - `InternalNode`: `{ splitFeature: number, splitValue: number, left: Node, right: Node }`
   - `LeafNode`: `{ size: number }`
   - Recursion stopping criteria:
     - `currentDepth >= maxDepth` ($h_{\max} = \lceil \log_2(\psi) \rceil$)
     - `dataset.length <= 1`
     - All points in node have identical values across all features
2. **Path Length Calculation $h(x)$**:
   - Traverse tree from root until leaf.
   - At leaf of size $S$: path length is $e + c(S)$ where $e$ is edge count traversed, and $c(S)$ is the BST unsuccessful search correction.
3. **BST Average Path Length $c(n)$**:
   - For $n > 2$: $c(n) = 2 \cdot (\ln(n - 1) + 0.5772156649) - \frac{2(n - 1)}{n}$
   - For $n = 2$: $c(2) = 1.0$
   - For $n \le 1$: $c(n) = 0.0$
4. **Ensemble Anomaly Scoring**:
   - $\mathbb{E}(h(x)) = \frac{1}{T} \sum_{t=1}^T h_t(x)$
   - $s(x, \psi) = 2^{-\frac{\mathbb{E}(h(x))}{c(\psi)}}$
   - Anomaly flag: $s(x, \psi) \ge \text{threshold}$ (default 0.60)
5. **Streaming Sliding Window (`EosStreamingIsolationForest`)**:
   - Fixed-size circular buffer of vector observations `[x_1, x_2, ...]`
   - `ingest(vector: number[])`: appends vector to window.
   - Automatically retrains or updates forest when buffer fills or every $K$ samples.
   - `score(vector: number[])`: evaluates anomaly score in real time.
6. **Feature Contribution Explanation**:
   - Measures which feature splits reduced path length most severely for outlier points.
7. **DbC & Receipts**:
   - `generateReceipt`: produces SHA-256 cryptographic receipt of forest state and anomaly report.
