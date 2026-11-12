# SPEC-232 — Layer-0 HyperLogLog++ (HLL++) Cardinality Estimation Engine

## Metadata

- **SPEC ID**: SPEC-232
- **Change ID**: CHANGE-117
- **Intake ID**: INTAKE-117
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-12
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosHyperLogLogPlusCore`

---

## 1. Overview

`EosHyperLogLogPlusCore` provides a space-efficient, probabilistic cardinality estimator implementing Google's
HyperLogLog++ algorithm (Heule, Nunkesser, Hall 2013) with:

1. **64-bit Cryptographic Hashing**: Prevents hash collisions up to cardinalities $> 10^{18}$.
2. **Precision Parameter $p \in [4, 18]$**: Allocating $m = 2^p$ registers with bounded standard error $\approx 1.04 / \sqrt{m}$.
3. **Linear Counting for Sparse Registers**: Switches to $m \ln(m / V)$ when $V > 0$ empty registers exist in small regimes.
4. **Empirical Bias Correction**: Mitigates non-linear overestimation bias in small/medium ranges ($E \le 5m$).
5. **Commutative & Associative Merge Operator**: Enables distributed MapReduce cardinality aggregation via element-wise $\max(M_A[j], M_B[j])$.
6. **Compact Binary Serialization**: Zero-copy typed array packing with magic header and versioning.

---

## 2. Functional Requirements (EARS Syntax)

**FR-232-001** (Event-Driven)
WHEN an item is added, THE SYSTEM SHALL compute a 64-bit cryptographic hash $x$, extract the first $p$ bits as
register index $j \in [0, 2^p - 1]$, compute the number of leading zeros $\rho$ in the remaining $64 - p$ bits plus 1,
AND update register $M[j] \leftarrow \max(M[j], \rho)$.

**FR-232-002** (Event-Driven)
WHEN `estimate()` is requested, THE SYSTEM SHALL compute the raw harmonic mean indicator:
$$E = \alpha_m m^2 \left( \sum_{j=0}^{m-1} 2^{-M[j]} \right)^{-1}$$
where $\alpha_m$ is the precision-dependent normalization constant defined by:
$\alpha_{16} = 0.673$, $\alpha_{32} = 0.697$, $\alpha_{64} = 0.709$, and $\alpha_m = \frac{0.7213}{1 + 1.079/m}$ for $m \ge 128$.

**FR-232-003** (Error / State-Driven)
SI $E \le \frac{5}{2}m$ AND el número de registros vacíos $V > 0$, ENTONCES EL SISTEMA SHALL compute the cardinality
using Linear Counting $E^* = m \ln(m / V)$, O SI $E \le 5m$, apply empirical bias correction to eliminate harmonic mean distortion.

**FR-232-004** (Event-Driven)
WHEN `merge(other)` is executed, THE SYSTEM SHALL verify that both sketches possess identical precision $p$ AND compute
the coordinate-wise maximum $M_{\text{merged}}[j] = \max(M_A[j], M_B[j])$ for all $j \in [0, m - 1]$, preserving algebraic
commutativity and associativity.

**FR-232-005** (Ubiquitous)
THE SYSTEM SHALL provide `serialize()` to generate a compact binary Buffer containing magic bytes, precision, and register data,
AND static `deserialize(buffer)` to reconstruct an identical sketch instance.

---

## 3. Non-Functional Requirements

- **NFR-232-A** Zero external runtime dependencies; `dependencies` in `package.json` must remain `{}`.
- **NFR-232-B** Item addition must execute in strictly $O(1)$ time (< 1 microsecond per item).
- **NFR-232-C** Relative error for cardinalities above 1,000 must remain within $2.5 \times$ the theoretical standard error ($< 2\%$ for $p = 14$).
- **NFR-232-D** Sketch merging must be strictly idempotent ($A \cup A = A$), commutative ($A \cup B = B \cup A$), and associative ($(A \cup B) \cup C = A \cup (B \cup C)$).
- **NFR-232-E** Serialization and deserialization must execute in under 1 millisecond.

---

## 4. BDD Acceptance Scenarios

### BDD-1179 — 64-Bit Hashing and Register Update Invariants

```gherkin
SCENARIO: Adding items correctly sets register max leading zero counts
  GIVEN an empty HyperLogLog++ sketch with precision p = 10 (1,024 registers)
  WHEN 100 items are added to the sketch
  THEN register values MUST be non-negative integers <= 64 - p + 1
  AND at least one register MUST have updated to a non-zero value
```

### BDD-1180 — Cardinality Estimation Accuracy Across Small and Large Sets

```gherkin
SCENARIO: Estimated cardinality is within theoretical error bounds
  GIVEN a HyperLogLog++ sketch with precision p = 14 (16,384 registers, std error ~0.82%)
  WHEN 5,000 distinct items are added
  THEN estimate() MUST return a value within +/- 3% of 5,000
```

### BDD-1181 — Linear Counting and Small-Range Bias Correction

```gherkin
SCENARIO: Small cardinality sets are accurately estimated without harmonic overestimation
  GIVEN an empty HyperLogLog++ sketch with precision p = 12
  WHEN 50 distinct items are added (small regime with empty registers V > 0)
  THEN estimate() MUST evaluate via Linear Counting and return between 45 and 55
```

### BDD-1182 — Commutative and Associative Distributed Sketch Merging

```gherkin
SCENARIO: Merging multiple sketches yields identical result regardless of order
  GIVEN three independent sketches A, B, and C populated with distinct and overlapping sets
  WHEN sketch AB is merged as A.merge(B) and BA as B.merge(A)
  THEN AB.estimate() MUST exactly equal BA.estimate()
  AND (A.merge(B)).merge(C) MUST equal A.merge(B.merge(C))
```

### BDD-1183 — Compact Binary Serialization and Deserialization

```gherkin
SCENARIO: Serialized sketch restores identical registers and estimate
  GIVEN a populated HyperLogLog++ sketch
  WHEN serialized to a binary Buffer via serialize()
  THEN deserialize(buffer) MUST restore an identical instance
  AND restored.estimate() MUST equal original.estimate()
```
