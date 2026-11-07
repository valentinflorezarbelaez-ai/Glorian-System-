# SPEC-176: Probabilistic Data Structures — Bloom Filter and Count-Min Sketch with Deterministic Hashing

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Large-scale systems (CDN and cache tiering, Big Data pipelines, network telemetry) routinely trade exact membership and frequency answers for orders-of-magnitude memory savings using probabilistic data structures. The Bloom filter provides space-efficient set membership with zero false negatives and a tunable false-positive rate; the Count-Min sketch provides streaming frequency estimation that may overestimate but never underestimates, with a conservative-update variant that improves accuracy under heavy-tailed distributions.

This specification governs `EosBloomFilter` and `EosCountMinSketch` in `src/core/eosProbabilisticDataStructures.ts`, the Layer 0 probabilistic primitives of the EOS control plane. The Bloom filter derives its bit-array size and hash count from the target capacity and false-positive rate and uses double hashing over a deterministic FNV-1a hash; the Count-Min sketch uses `depth` seeded rows and supports both standard and conservative updates.

The module is intentionally dependency-free and deterministic (Law V): hashing is pure FNV-1a with no external random source, accuracy is reported through an analytic `estimatedFpRate()`, and both structures expose SHA-256 state fingerprints so that identical content yields identical fingerprints and different content yields different ones for CI regression tracking.

## 2. Functional Requirements (EARS Syntax)

- **FR-851 (Ubiquitous - Zero False Negatives)**: `THE SYSTEM's Bloom filter shall return has(key) = true for every key previously added via add(key), never producing a false negative.`
- **FR-852 (State-Driven - Bounded False Positive Rate)**: `WHILE the Bloom filter holds at most capacity insertions, the observed false-positive rate on unseen keys shall remain within the configured target bound.`
- **FR-853 (Ubiquitous - Deterministic Hash Geometry)**: `THE SYSTEM shall size the Bloom filter as m = ceil(-n * ln(p) / (ln 2)^2) and k = max(1, round((m / n) * ln 2)) and derive bit positions via deterministic FNV-1a double hashing with no external random source.`
- **FR-854 (State-Driven - Non-Underestimating Frequency)**: `WHILE a Count-Min sketch estimates the frequency of a key, estimate(key) shall return the minimum counter across all rows, never underestimating the true frequency of the key.`
- **FR-855 (Event-Driven - Conservative Update)**: `WHEN conservativeAdd(key) is invoked, THE SYSTEM shall increment only the rows whose current counter equals the minimum estimate, returning the post-update estimate.`
- **FR-856 (Ubiquitous - Deterministic State Fingerprints and Observed Total)**: `THE SYSTEM shall expose SHA-256 fingerprints over the Bloom filter bit array and the Count-Min table that are identical for instances with identical content and differ for different content, and shall increment the Count-Min observedTotal by delta on every add.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-851 Bloom Filter Has Zero False Negatives
  GIVEN a Bloom filter with capacity 1000 and falsePositiveRate 0.01
  WHEN 500 distinct keys are added
  THEN has(key) returns true for each of the 500 added keys
  AND no previously added key is ever reported as absent
```

```gherkin
SCENARIO: BDD-852 False Positive Rate Stays Under Target for Unseen Keys
  GIVEN a Bloom filter with capacity 1000 and falsePositiveRate 0.01
  WHEN 1000 keys are added and 5000 unseen keys are probed
  THEN the measured false-positive ratio is below 0.05
  AND no added key was reported absent during the probe
```

```gherkin
SCENARIO: BDD-853 Count-Min Sketch Never Underestimates Frequency
  GIVEN a Count-Min sketch of width 1000 and depth 5
  WHEN "hot" is added 50 times and "cold" is added 5 times
  THEN estimate("hot") is at least 50
  AND estimate("cold") is at least 5
```

```gherkin
SCENARIO: BDD-854 Fingerprints Are Stable for Identical State and Distinguish Different Content
  GIVEN two Bloom filters with identical configuration receiving the same keys
  WHEN each filter's fingerprint is computed
  THEN both fingerprints are identical
  AND two Count-Min sketches with different keys produce different fingerprints
```

## 4. Architecture Decision Records (ADRs)

- **ADR-176-1: Deterministic FNV-1a double hashing instead of a seeded PRNG**

  - _Context_: Traditional Bloom filters rely on independent hash functions, often implemented with a random seed; randomness makes filters non-reproducible and hard to regression-test.
  - _Decision_: Use pure FNV-1a with fixed seeds for `h1` and `h2` and combine them as `(h1 + i*h2) mod m` to synthesize `k` positions, which is deterministic across runs and platforms.
  - _Consequence_: Filters are reproducible (identical inserts yield identical bit arrays and fingerprints) with no external RNG; the fixed seeds are part of the module's contract and must remain stable.

- **ADR-176-2: Conservative update as an opt-in accuracy improvement for the Count-Min sketch**
  - _Context_: Standard Count-Min increments every row on each add, inflating counters for cold keys that collide with hot keys under skew.
  - _Decision_: Provide `conservativeAdd`, which first computes the minimum and then increments only the rows equal to that minimum, leaving higher rows untouched.
  - _Consequence_: Conservative updates reduce overestimation for skewed workloads at the cost of a second pass over the rows; `observedTotal` still increments by one per conservative add to preserve stream accounting.

## 5. Atomic Task DAG

1. [x] **TASK-176-1**: Author the SPEC-176 specification defining the accuracy contracts for the Bloom filter and Count-Min sketch.
2. [x] **TASK-176-2**: Implement `EosBloomFilter` with FNV-1a double hashing, analytically sized geometry and `estimatedFpRate()` in `src/core/eosProbabilisticDataStructures.ts`.
3. [x] **TASK-176-3**: Implement `EosCountMinSketch` with standard and conservative updates, `observedTotal` and `shape`.
4. [x] **TASK-176-4**: Add BDD coverage for zero false negatives, bounded FP rate, non-underestimation and fingerprint stability in `test/eosBigTechDataPlane.test.mjs`.
