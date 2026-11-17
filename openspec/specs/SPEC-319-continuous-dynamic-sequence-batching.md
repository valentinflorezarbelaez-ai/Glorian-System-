# SPEC-319: Continuous Dynamic Sequence Batching & Iteration-Level Request Scheduler

**Status**: `APPROVED`
**Change Reference**: `CHANGE-181`
**Intake Reference**: `INTAKE-181`
**Author**: Valentin Florez Arbelaez & Glorian / EOS Engineering Guild
**Date**: 2026-11-17

---

## 1. Requirements Overview (IEEE 830 / ISO 29148)

### Functional Requirements (EARS Syntax)

#### FR-1: Request Ingestion & Queue Management

- **Pattern**: Event-Driven
- **Requirement**: When a new generation request arrives with initial prompt tokens and max generation limit, the system shall assign a unique request ID, compute priority, and enqueue it in the pending queue without blocking ongoing iteration execution.

#### FR-2: Iteration-Level Slot Scheduling

- **Pattern**: Ubiquitous
- **Requirement**: The system shall schedule generation at the single-token iteration step level, maintaining up to `maxBatchSize` active running slots simultaneously and admitting waiting requests into vacated slots within a single iteration step.

#### FR-3: Immediate Eviction on Completion

- **Pattern**: State-Driven
- **Requirement**: While executing a forward step, if any active sequence generates the end-of-sequence (EOS) token or reaches its `maxTokens` budget, the system shall mark the request completed, record final latency, and immediately release its slot and allocated memory blocks.

#### FR-4: Memory-Aware Dynamic Preemption

- **Pattern**: Error / Unwanted Condition
- **Requirement**: If available memory blocks drop below the safety threshold required to extend all running sequences, the system shall preempt the lowest-priority or youngest sequence, re-enqueueing it into the waiting queue and releasing its memory blocks to prevent out-of-memory failure.

#### FR-5: Zero Padding Bubble Invariant

- **Pattern**: Ubiquitous
- **Requirement**: The system shall execute heterogeneous sequence lengths concurrently without injecting zero-padding tokens into non-active sequence slots, achieving at least 90% active token density under continuous queue load.

#### FR-6: Verification and Structural Invariant Audit

- **Pattern**: Ubiquitous
- **Requirement**: The system shall verify slot capacity conservation ($N_{\text{active}} \le B$), non-negative latency, FIFO/priority ordering adherence, and generate a signed SHA-256 cryptographic receipt.

---

## 2. BDD Acceptance Criteria

```gherkin
SCENARIO: BDD-1689 Request Enqueueing & Priority Management
  GIVEN an empty scheduler with maxBatchSize = 4
  WHEN enqueueing 3 requests with varying priorities (high, medium, low)
  THEN the pending queue orders requests strictly by priority then arrival timestamp
  AND no slots are prematurely allocated before the schedule cycle executes

SCENARIO: BDD-1690 Continuous Dynamic Ingestion & Zero-Bubble Scheduling
  GIVEN 2 running sequences in a scheduler with maxBatchSize = 4
  WHEN 2 new requests arrive in the pending queue
  THEN both new requests are immediately admitted into slots 3 and 4 on the next step
  AND existing running sequences continue uninterrupted with zero padding tokens

SCENARIO: BDD-1691 Immediate Slot Eviction upon EOS Token Emission
  GIVEN an active batch where sequence A emits token EOS (0) on iteration 3
  WHEN the iteration step concludes
  THEN sequence A is transitioned to COMPLETED status
  AND slot A is marked free and immediately reassigned if requests are pending

SCENARIO: BDD-1692 Memory-Pressure Preemption and Re-Queueing
  GIVEN a full active batch and memory block budget exhausted
  WHEN memory requirement exceeds available physical capacity
  THEN the scheduler preempts the lowest-priority sequence
  AND the preempted sequence is placed back in the waiting queue without corruption

SCENARIO: BDD-1693 Heterogeneous Length Throughput & High Slot Utilization
  GIVEN 10 requests with random completion lengths between 2 and 10 tokens
  WHEN running the continuous batching loop until all requests complete
  THEN total elapsed iterations are strictly less than static batching equivalent
  AND slot utilization averages greater than 80% with zero idle slot waste

SCENARIO: BDD-1694 Structural Invariant Audit & Cryptographic SHA-256 Receipt
  GIVEN an executed continuous batching session
  WHEN executing toolchain:continuous:audit
  THEN verification status is VERIFIED with zero slot leaks
  AND a deterministic SHA-256 cryptographic receipt is recorded in docs/evidence/
```
