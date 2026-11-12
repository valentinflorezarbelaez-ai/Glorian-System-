# CHANGE-117 — Layer-0 HyperLogLog++ Cardinality Estimation Engine

## Metadata

- **Change ID**: CHANGE-117
- **Target SPEC**: SPEC-232
- **Intake Ref**: INTAKE-117
- **Date**: 2026-11-12
- **Status**: APPROVED
- **Layer**: Layer-0 (Zero external runtime dependencies)

---

## 1. Description

Introduce `EosHyperLogLogPlusCore`, an implementation of Google's HyperLogLog++ (HLL++)
probabilistic cardinality estimation algorithm. This engine empowers Glorian with $O(1)$ constant-time insertion,
$O(\log \log N)$ space complexity, bias correction for small cardinalities, 64-bit hashing, commutative
distributed merging, and binary serialization.

---

## 2. Motivation

Glorian's Big Tech enterprise ledger, telemetry aggregation, and distributed consensus mechanisms require
ultra-fast, memory-bounded cardinality estimators to compute unique client requests, active validators,
and metrics without consuming linear heap memory.

---

## 3. Impact Analysis

- **Runtime**: Zero external dependencies; pure Node.js 24 (`package.json` `dependencies: {}`).
- **Memory**: Tunable from 16 bytes ($p = 4$) up to 16 KB ($p = 14$) or 256 KB ($p = 18$), fully bounded.
- **Accuracy**: Theoretical standard error $\approx 1.04 / \sqrt{2^p}$. At default $p = 14$, standard error $< 0.82\%$.
- **Compatibility**: Commutative sketch merging enables map-reduce distributed telemetry aggregation across all 9 fleet repositories.
