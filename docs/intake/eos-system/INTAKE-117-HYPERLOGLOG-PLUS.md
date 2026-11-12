# INTAKE-117 — Layer-0 HyperLogLog++ (HLL++) Cardinality Estimation Engine

## Metadata

- **Intake ID**: INTAKE-117
- **Date**: 2026-11-12
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: APPROVED
- **Target SPEC**: SPEC-232
- **Target Change**: CHANGE-117

---

## 1. Problem Statement

Modern large-scale distributed systems, enterprise ledgers, and telemetry collectors require counting
the number of unique entities (distinct transactions, active peer nodes, unique API callers, or DDoS attackers)
over massive data streams with billions of events. Storing raw identity sets consumes gigabytes of RAM
($O(N)$ memory), creating severe memory bottlenecks, cache thrashing, and unscalable network serialization.

Standard HyperLogLog provides $O(\log \log N)$ space cardinality estimation, but suffers from two classical weaknesses:

1. Significant estimation bias and large relative error for small cardinalities ($N < 5m$).
2. 32-bit hash collision bounds that fail when cardinalities exceed $2^{32} \approx 4.29 \times 10^9$ elements.

---

## 2. Solution Overview

`EosHyperLogLogPlusCore` implements Google's HyperLogLog++ algorithm (Heule, Nunkesser, Hall 2013) in Layer-0
pure TypeScript for Node.js 24 with:

1. **64-bit Cryptographic Hashing**: Using 64-bit truncated SHA-256 to support cardinalities exceeding $10^{18}$ with zero hash collisions.
2. **Configurable Precision $p$ ($4 \le p \le 18$)**: Providing $m = 2^p$ registers with standard error $\sigma \approx 1.04 / \sqrt{m}$ (e.g., $p = 14 \implies 16,384$ registers, standard error $< 0.82\%$).
3. **LinearCounting Thresholding**: Automatically switching to linear counting $m \ln(m / V)$ when $E \le \frac{5}{2}m$ and zero registers $V > 0$ exist, achieving near-zero error on small sets.
4. **Empirical Bias Correction**: Polynomial/piecewise bias interpolation for small-to-medium ranges to eliminate the asymptotic overestimation bias of raw harmonic means.
5. **Commutative, Associative Sketch Union**: Merging multiple sketches across distributed nodes via coordinate-wise maximum $\max(M_A[j], M_B[j])$ in $O(m)$ time with zero accuracy loss.
6. **Zero-Copy Binary Serialization**: Fast binary packing of 6-bit or 8-bit register arrays with magic header and versioning.

---

## 3. Scope and Deliverables

- `src/core/eosHyperLogLogPlusCore.types.ts`
- `src/core/eosHyperLogLogPlusCore.ts`
- `test/eosHyperLogLogPlusCore.test.mjs` (BDD-1179..BDD-1183)
- `bin/commands/cliHllMesh.mjs`
- Wiring in `cliPlatform.mjs` and `eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
- Subpath exports `"./hll"` and `"./hyperloglog"` in `package.json` and barrel exports in `src/core/index.ts`
- Developer Guide Module 47
- OpenSpec catalog update to 227 specs
