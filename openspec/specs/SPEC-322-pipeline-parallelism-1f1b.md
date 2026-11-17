# SPEC-322: Pipeline Parallelism Engine (1F1B Interleaved Activation Schedule)

---

## 1. Functional Requirements (EARS Syntax)

#### FR-1: Linear Pipeline Stage Sharding & Neighbor Topology

- **Pattern**: Ubiquitous
- **Requirement**: THE SYSTEM shall partition deep network layers sequentially across $P \ge 2$ stages, establishing point-to-point communication channels such that stage $p$ communicates activations strictly to successor $p + 1$ (for $p < P - 1$) and back-propagated gradients strictly to predecessor $p - 1$ (for $p > 0$).

#### FR-2: Warmup Phase Forward Micro-Batch Scheduling

- **Pattern**: Event-Driven
- **Requirement**: WHEN initializing the pipeline execution for $M \ge P$ micro-batches, THE SYSTEM shall execute strictly $P - p - 1$ warmup forward steps on stage $p$, stashing computed intermediate activations into a local FIFO activation cache before beginning backward execution.

#### FR-3: Steady-State 1F1B Interleaved Execution

- **Pattern**: Event-Driven
- **Requirement**: WHEN stage $p$ enters the steady-state phase, THE SYSTEM shall alternate one forward micro-batch execution with one backward micro-batch execution (1F1B) in an interleaved schedule, ensuring backward passes consume the oldest stashed activations and release memory immediately.

#### FR-4: Activation Cache Stashing & Zero-Leakage Cooldown

- **Pattern**: Event-Driven
- **Requirement**: WHEN all $M$ forward passes have completed, THE SYSTEM shall transition into the cooldown phase, executing backward passes for all remaining in-flight micro-batches until the activation cache size on every stage reaches strictly 0.

#### FR-5: Bounded Activation Memory Invariant

- **Pattern**: Ubiquitous
- **Requirement**: THE SYSTEM shall guarantee that the number of stored intermediate activation tensors on any pipeline stage $p$ never exceeds $P$, ensuring peak activation memory scales with pipeline depth $P$ rather than total micro-batch count $M$.

#### FR-6: Verification, Topological Validity & Invariant Audit

- **Pattern**: Ubiquitous
- **Requirement**: THE SYSTEM shall verify that every micro-batch $m \in \{0, \dots, M - 1\}$ completes forward execution before backward execution across all stages, validate that the final loss gradients match centralized execution within $10^{-6}$, and generate a deterministic SHA-256 cryptographic audit receipt.

---

## 2. BDD Acceptance Criteria

```gherkin
SCENARIO: BDD-1707 Pipeline Stage Partitioning & P2P Neighbor Topology
  GIVEN a model configured with 4 pipeline stages (P = 4)
  WHEN building the pipeline communication topology
  THEN exactly 4 stages are created with linear predecessor/successor links
  AND stage 0 has no predecessor and stage 3 has no successor

SCENARIO: BDD-1708 Warmup Schedule Execution & In-Flight Micro-Batch Stashing
  GIVEN P = 4 pipeline stages and M = 8 micro-batches
  WHEN executing the warmup phase
  THEN stage 0 runs 3 forward micro-batches (P - 1 = 3)
  AND stage 3 runs 0 warmup passes and transitions immediately into backward processing

SCENARIO: BDD-1709 Steady-State 1F1B Interleaved Forward and Backward Stepping
  GIVEN a pipeline stage in the steady-state phase
  WHEN advancing iteration steps
  THEN forward micro-batch m is followed immediately by backward micro-batch m - k
  AND activation memory is recycled in locked 1-to-1 parity

SCENARIO: BDD-1710 Bounded Peak Activation Memory Invariant Enforcement
  GIVEN P = 4 stages and M = 16 micro-batches (M >> P)
  WHEN monitoring activation cache length at every discrete step
  THEN stashed activation count on any stage never exceeds P = 4
  AND memory footprint is 4x lower than naive GPipe batching (which stores 16 activations)

SCENARIO: BDD-1711 Cooldown Drainage & Zero Activation Cache Leakage
  GIVEN a pipeline schedule reaching the end of all M forward micro-batches
  WHEN completing the cooldown backward passes
  THEN all M micro-batches complete their backward passes
  AND the activation cache size on all 4 stages is strictly 0 (zero memory leaks)

SCENARIO: BDD-1712 Structural Invariant Audit & Cryptographic SHA-256 Receipt
  GIVEN an executed 1F1B pipeline parallel session
  WHEN running toolchain:pipeline:audit
  THEN audit status is VERIFIED with peak memory <= P and zero activation leaks
  AND a deterministic SHA-256 cryptographic receipt is recorded in docs/evidence/
```
