# SPEC-179: Vector Clock Causal Ordering Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Replicated EOS state must distinguish a genuinely newer write from a conflicting concurrent write. Wall-clock timestamps cannot do this safely across replicas. The `eosVectorClockCausality` Layer-0 module implements the causality-tracking pattern used by Amazon Dynamo and Riak: each replica keeps a monotonic counter, and the per-replica counter map forms a vector clock whose element-wise comparison yields the `BEFORE`, `AFTER`, `EQUAL` or `CONCURRENT` relation between two versions.

On top of the raw vector clock, the module provides `EosCausalRegister`, a last-writer-wins register that only falls back to a deterministic tie-break (higher `wallTickMs`, then lexicographically higher `replicaId`) when two versions are genuinely concurrent. On adoption, the register's clock is advanced by an element-wise merge so that causality is not lost.

The module honours Law V (Zero External Runtime Dependencies): it uses only `pureSha256` and `deepFreeze` from `src/core/eosKernelPrimitives.ts`, operates on immutable clock instances (every mutation returns a new clock), and produces lexicographically-sorted digests so results are stable regardless of key insertion order.

## 2. Functional Requirements (EARS Syntax)

- **FR-881 (Ubiquitous - Vector Clock Representation)**: `The system shall represent causal state as an immutable map of per-replica monotonic counters supporting cloning and element lookup that defaults to zero for unseen replicas.`

- **FR-882 (Event-Driven - Happens-Before Comparison)**: `WHEN two vector clocks are compared, the system shall return BEFORE, AFTER, EQUAL or CONCURRENT by evaluating element-wise dominance across the union of their replica keys.`

- **FR-883 (Ubiquitous - Element-Wise Merge)**: `The system shall merge two vector clocks by taking the element-wise maximum of counters over the union of replicas, returning a new clock without mutating either input.`

- **FR-884 (Event-Driven - Replica Increment)**: `WHEN a replica increments its counter, the system shall return a new clock in which that replica's counter is increased by one, leaving the source clock unchanged.`

- **FR-885 (Event-Driven - Causal Register Merge With Tie-Break)**: `WHEN a remote causal version is merged, the system shall adopt it only when its clock is BEFORE the local clock or concurrently newer; concurrent versions shall be resolved deterministically by wallTickMs and then replicaId, and the adopted clock shall reflect the element-wise merge of both clocks.`

- **FR-886 (Ubiquitous - Order-Stable Digest)**: `The system shall compute a SHA-256 digest over replica entries sorted lexicographically so that two clocks with equal content but different insertion order produce identical digests.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-881 Same-Replica Increment Establishes BEFORE and AFTER
  GIVEN a vector clock initialised with {a: 1}
  WHEN replica "a" increments to produce a successor clock
  THEN comparing the original against the successor yields BEFORE
  AND comparing the successor against the original yields AFTER

SCENARIO: BDD-882 Disjoint Increments Are CONCURRENT
  GIVEN a base clock {a: 1, b: 1}
  WHEN replica "a" and replica "b" each increment independently from the base
  THEN comparing the two resulting clocks yields CONCURRENT

SCENARIO: BDD-883 Merge Takes the Element-Wise Maximum
  GIVEN a clock {a: 3, b: 1} and a clock {a: 1, b: 5}
  WHEN the first merges the second
  THEN the merged counter for "a" is 3
  AND the merged counter for "b" is 5

SCENARIO: BDD-884 Concurrent Writes Resolve by Wall-Tick Tie-Break
  GIVEN a causal register holding a local version written at wallTickMs 100
  WHEN a concurrent remote version written at wallTickMs 200 is merged
  THEN the register adopts the remote value
  AND the adopted version carries the higher wall-tick timestamp
```

## 4. Architecture Decision Records (ADRs)

- **ADR-179-1: Immutable Clocks With Copy-on-Write Mutation**

  - _Context_: In-place mutation of a shared clock during increment/merge would corrupt concurrent causality comparisons.
  - _Decision_: `increment` and `merge` clone the counter map and return a new `EosVectorClock`; the original is never mutated.
  - _Consequence_: Safe sharing and referential transparency, accepting a small allocation cost per operation.

- **ADR-179-2: Deterministic Tie-Break Only for Concurrent Versions**
  - _Context_: A pure last-writer-wins by timestamp would discard causality; pure vector clocks leave concurrent conflicts unresolved.
  - _Decision_: The register adopts a remote version when it strictly dominates; only on the CONCURRENT relation does it apply the `(wallTickMs, replicaId)` deterministic tie-break and merge the clocks.
  - _Consequence_: Conflict-free convergence while preserving causal history in the merged clock.

## 5. Atomic Task DAG

1. [x] **TASK-179-1**: Author this SPEC (EARS + BDD) formalising the causal relations and register tie-break order.
2. [x] **TASK-179-2**: Implement `EosVectorClock` and `EosCausalRegister` in `src/core/eosVectorClockCausality.ts` (increment, merge, compare, digest, put/merge/read).
3. [x] **TASK-179-3**: Add the `node:test` suite covering every BDD scenario (BEFORE/AFTER, CONCURRENT, element-wise merge, wall-tick tie-break, digest stability) in `test/eosBigTechCoordination.test.mjs`.
4. [x] **TASK-179-4**: Verify Layer-0 purity (zero external dependencies) and immutability of source clocks across operations.
