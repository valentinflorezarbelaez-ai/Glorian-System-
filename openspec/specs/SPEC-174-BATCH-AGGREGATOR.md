# SPEC-174: Batch Aggregator — Size and Time Triggers, Keyed Partitioning, and Zero-Loss Flush

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Streaming and data-engineering platforms (Kafka Streams, Databricks Structured Streaming, Spark micro-batching) trade per-record latency for throughput by aggregating records into batches that are flushed by whichever of two triggers fires first: a maximum batch size (throughput) or a maximum delay (latency bound). Partitioning batches by key preserves per-partition ordering and enables embarrassingly parallel downstream processing, while a bounded number of active partitions protects memory.

This specification governs `EosBatchAggregator` in `src/core/eosBatchAggregator.ts`, the Layer 0 batching primitive of the EOS control plane. The aggregator supports size and time triggers, optional per-key partitioning with a partition cap, atomic flush with counter reset (zero-loss), deterministic batch identifiers, and a delivery fingerprint over emitted batches.

The module is dependency-free (Law V): buckets are held in a `Map` keyed by partition, timing is evaluated on an explicit `tick(nowMs)` sweep rather than a background timer, emitted batches are frozen, and the fingerprint is a pure SHA-256 over emitted batch metadata so that equivalent batch sequences produce identical fingerprints.

## 2. Functional Requirements (EARS Syntax)

- **FR-831 (Event-Driven - Size Trigger)**: `WHEN the number of items accumulated in a bucket reaches maxBatchSize, THE SYSTEM shall flush that bucket immediately, returning a Batch with trigger "SIZE" and the accumulated items in insertion order.`
- **FR-832 (Event-Driven - Time Trigger)**: `WHEN tick(nowMs) observes a non-empty bucket whose age (nowMs - openedAtMs) is greater than or equal to maxDelayMs, THE SYSTEM shall flush that bucket with trigger "TIME".`
- **FR-833 (Ubiquitous - Keyed Partitioning)**: `THE SYSTEM shall maintain independent buckets per partition key, defaulting to "__default__", so that items added under different keys are aggregated into separate batches.`
- **FR-834 (Event-Driven - Manual Flush)**: `WHEN flushAll() is invoked, THE SYSTEM shall drain every non-empty bucket with trigger "MANUAL", after which pendingCount() shall return 0.`
- **FR-835 (Unwanted Condition - Partition Cap)**: `IF adding an item under a new key would make the number of active buckets reach maxKeys, THEN THE SYSTEM shall fail the precondition with a message containing "key capacity" and the configured cap.`
- **FR-836 (Ubiquitous - Deterministic Delivery Fingerprint)**: `THE SYSTEM shall compute fingerprint() as a SHA-256 over each emitted batch encoded as "<batchId>:<trigger>:<items.length>", so that different batch compositions yield different fingerprints.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-831 Size Trigger Emits an Exact Full Batch
  GIVEN a batch aggregator with maxBatchSize=3 and a large maxDelayMs
  WHEN items "a" and "b" are added and then "c" is added
  THEN the first two adds return null
  AND the third add returns a batch with trigger "SIZE"
  AND the batch items are ["a", "b", "c"]
```

```gherkin
SCENARIO: BDD-832 tick Flushes Aged Partial Batches with a Time Trigger
  GIVEN a batch aggregator with maxBatchSize=100 and maxDelayMs=50
  WHEN item "x" is added and tick is called with a timestamp 100ms in the future
  THEN one batch is flushed
  AND that batch has trigger "TIME"
```

```gherkin
SCENARIO: BDD-833 Keyed Partitioning Isolates Independent Streams
  GIVEN a batch aggregator with maxBatchSize=2
  WHEN "a" is added under key "eu" and "b" under key "us" and "c" under key "eu"
  THEN the flush triggered by the "eu" bucket has key "eu"
  AND that batch contains ["a", "c"] while the "us" bucket remains pending
```

```gherkin
SCENARIO: BDD-834 flushAll Drains Every Non-Empty Bucket
  GIVEN a batch aggregator with two populated keys
  WHEN flushAll() is invoked
  THEN it returns two batches
  AND pendingCount() afterwards is 0
```

## 4. Architecture Decision Records (ADRs)

- **ADR-174-1: Explicit tick-driven time triggers instead of background timers**

  - _Context_: Timers introduce nondeterminism, asynchronous callbacks and an uncontrolled concurrency surface inside a pure aggregation module.
  - _Decision_: Evaluate the time trigger only when `tick(nowMs)` is called with an explicit timestamp, and flush buckets whose age meets `maxDelayMs`; the caller owns scheduling.
  - _Consequence_: Flushing is fully deterministic and unit-testable with injected clocks; a consumer that never calls `tick` will not get time-based flushes and must rely on size or manual flushing.

- **ADR-174-2: Atomic flush with counter reset and deterministic batch identifiers**
  - _Context_: A flush that partially drains a bucket or interleaves with concurrent adds can silently drop or duplicate items.
  - _Decision_: `flushKey` deletes the bucket from the map before copying its items, assigns a monotonic `batch-<seq>` identifier, and freezes the batch; `pendingCount()` sums the items still held in the map.
  - _Consequence_: Flush is zero-loss and the emit sequence is reproducible; the `seq` counter is process-local, which is acceptable for in-process aggregation but not a globally unique identifier.

## 5. Atomic Task DAG

1. [x] **TASK-174-1**: Author the SPEC-174 specification defining trigger precedence, partitioning and the zero-loss flush contract.
2. [x] **TASK-174-2**: Implement `EosBatchAggregator` with size/time triggers and `flushKey`, `flushAll`, `tick` in `src/core/eosBatchAggregator.ts`.
3. [x] **TASK-174-3**: Implement keyed partitioning with a `maxKeys` cap and the deterministic delivery `fingerprint()`.
4. [x] **TASK-174-4**: Add BDD coverage for size/time triggers, partitioning and flushAll in `test/eosBigTechDataPlane.test.mjs`.
