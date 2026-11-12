# SPEC-231 — Layer-0 Cuckoo Filter for Dynamic Set Membership and Verifiable Deletion

## Metadata

- **SPEC ID**: SPEC-231
- **Change ID**: CHANGE-116
- **Intake ID**: INTAKE-116
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-12
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosCuckooFilterCore`

---

## 1. Overview

`EosCuckooFilterCore` provides space-efficient, probabilistic set-membership testing with:

1. **Partial-Key Cuckoo Hashing**: Alternate bucket computation $i_2 = (i_1 \oplus \text{hash}(fp)) \pmod m$
   requiring only the fingerprint without the original key.
2. **True Dynamic Element Deletion**: Safely removing items without filter degradation or false negatives.
3. **4-Slot Bucket Architecture**: Bounded memory layout achieving $> 95\%$ occupancy.
4. **Compact Binary Serialization**: Zero-copy Uint8/Uint16 TypedArray backing.

---

## 2. Functional Requirements (EARS Syntax)

**FR-231-001** (Event-Driven)
WHEN an item is supplied, THE SYSTEM SHALL compute a non-zero $f$-bit fingerprint $fp$ AND primary
bucket index $i_1 = \text{hash}(x) \pmod m$ AND secondary bucket index $i_2 = (i_1 \oplus \text{hash}(fp)) \pmod m$
such that $(i_2 \oplus \text{hash}(fp)) \pmod m \equiv i_1$.

**FR-231-002** (Event-Driven)
WHEN `insert(item)` is executed, THE SYSTEM SHALL attempt to place $fp$ into an empty slot in $i_1$
or $i_2$, OR IF both are full, kick an existing fingerprint to its alternate bucket recursively up to
`maxKicks` iterations.

**FR-231-003** (Event-Driven)
WHEN `contains(item)` is executed, THE SYSTEM SHALL check the slots of both $i_1$ and $i_2$ AND return
`true` if $fp$ is found in either bucket, OR `false` otherwise.

**FR-231-004** (Event-Driven)
WHEN `delete(item)` is executed, THE SYSTEM SHALL locate $fp$ in either $i_1$ or $i_2$, clear that
slot, AND decrement the element count, returning `true`, OR return `false` if $fp$ is absent.

**FR-231-005** (Ubiquitous)
THE SYSTEM SHALL provide `serialize()` to produce a compact binary Buffer encoding filter parameters
and bucket arrays, AND static `deserialize(buffer)` to restore an identical filter instance.

---

## 3. Non-Functional Requirements

- **NFR-231-A** Zero external runtime dependencies; `dependencies` in `package.json` must remain `{}`.
- **NFR-231-B** Lookup complexity must be strictly $O(1)$, inspecting at most $2 \times b$ slots ($b = 4$).
- **NFR-231-C** False positive rate must remain below $3\%$ for 8-bit fingerprints and below $0.01\%$ for 16-bit fingerprints.
- **NFR-231-D** Deletion must never introduce false negatives for remaining items.
- **NFR-231-E** Filter serialization and deserialization must execute in under 5 milliseconds.

---

## 4. BDD Acceptance Scenarios

### BDD-1174 — Deterministic Partial-Key Cuckoo Hashing and Invertibility

```gherkin
SCENARIO: Alternate bucket computation is symmetric and invertible
  GIVEN an item x and its fingerprint fp
  WHEN primary bucket index i1 and secondary bucket index i2 are computed
  THEN (i2 XOR hash(fp)) mod m MUST exactly equal i1
  AND (i1 XOR hash(fp)) mod m MUST exactly equal i2
```

### BDD-1175 — Element Insertion and Membership Lookup Accuracy

```gherkin
SCENARIO: Inserted elements are reliably detected with bounded false positive rate
  GIVEN an empty Cuckoo filter of capacity 1,000 items
  WHEN 500 distinct items are inserted
  THEN contains(item) MUST return true for all 500 inserted items (zero false negatives)
  AND querying 500 uninserted items MUST yield <= 3% false positives
```

### BDD-1176 — True Dynamic Item Deletion

```gherkin
SCENARIO: Deleting an element removes it without affecting other elements
  GIVEN a Cuckoo filter containing items "alpha", "beta", "gamma"
  WHEN delete("beta") is executed
  THEN delete("beta") MUST return true
  AND contains("beta") MUST return false
  AND contains("alpha") and contains("gamma") MUST continue to return true
```

### BDD-1177 — Cuckoo Kick Displacements and High Load Factor

```gherkin
SCENARIO: Filter resolves collisions via cuckoo kicks under high occupancy
  GIVEN a small Cuckoo filter where buckets experience multiple collisions
  WHEN new items are inserted causing bucket saturation
  THEN existing fingerprints MUST be kicked to alternate buckets
  AND all inserted items MUST remain discoverable via contains()
```

### BDD-1178 — Compact Binary Serialization and Deserialization

```gherkin
SCENARIO: Cuckoo filter state round-trips via binary buffer
  GIVEN a Cuckoo filter populated with hundreds of items
  WHEN serialized to a binary Buffer via serialize()
  THEN deserialize(buffer) MUST restore an identical filter
  AND every item search MUST return identical boolean results
```
