# SPEC-165: Saga Orchestrator with Reverse-Order Compensation

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arboláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Distributed mutations that span several services cannot rely on a single ACID transaction; once an early step has committed a side effect, a later failure leaves the system in a partially applied state. The `EosSagaOrchestrator` module addresses this by coordinating an ordered chain of forward steps where every step carries a paired compensating action, following the well-established Saga pattern popularised by Temporal and AWS Step Functions.

The module implements a single, bounded, deterministic orchestration core: forward steps run in registration order, transient failures are retried up to a per-step budget, and any unrecoverable failure triggers a reverse-order unwind of the already-completed steps. This keeps the compensation logic co-located with each step instead of scattered across callers.

The engine is deliberately Layer-0: it depends only on `eosKernelPrimitives` (`assertPrecondition`, `deepFreeze`, `pureSha256`) and Node.js built-ins, so it introduces no external dependencies and remains trivially testable and reproducible.

## 2. Functional Requirements (EARS Syntax)

- **FR-741 (Ubiquitous - Ordered Forward Execution)**: `The system shall execute registered saga steps in registration order, recording a FORWARD trace entry for every attempt with the step name, attempt number, and outcome.`
- **FR-742 (State-Driven - Completion State)**: `WHILE every forward step succeeds within its retry budget, the system shall return a SagaResult with status "COMPLETED" and the ordered list of completedSteps.`
- **FR-743 (Event-Driven - Reverse Compensation)**: `WHEN a forward step exhausts all of its retry attempts without succeeding, the system shall transition to the "COMPENSATING" status and invoke the compensating actions of the completed steps in reverse registration order.`
- **FR-744 (Unwanted Condition - Best-Effort Unwind)**: `IF a compensating action throws an error, THEN the system shall record a failed COMPENSATE trace entry and continue unwinding the remaining completed steps without aborting the rollback.`
- **FR-745 (Event-Driven - Bounded Retry)**: `WHEN a step action throws, the system shall retry the action until it succeeds or until maxRetries attempts have been made, and shall reject any maxRetries value below 1.`
- **FR-746 (Ubiquitous - Deterministic Plan and Fingerprint)**: `The system shall provide plan() returning the ordered step names without executing any action, and traceFingerprint(result) returning a deterministic pureSha256 digest of the recorded execution trace.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-741 Happy path completes every step in order
  GIVEN a saga with steps "reserve" and "charge", each with a compensating action
  WHEN run() is called and every forward action resolves successfully
  THEN the returned status is "COMPLETED"
  AND completedSteps equals ["reserve", "charge"]
  AND the side-effect log equals ["reserve", "charge"]
```

```gherkin
SCENARIO: BDD-742 Mid-saga failure triggers reverse-order compensation
  GIVEN a saga with steps "a" and "b" registering side effects and step "c" always throwing
  WHEN run() is called and step "c" fails after its retry budget
  THEN the returned status is "ROLLED_BACK"
  AND completedSteps is empty
  AND the side-effect log equals ["a+", "b+", "b-", "a-"]
```

```gherkin
SCENARIO: BDD-743 Transient failure is retried before compensation
  GIVEN a saga step "flaky" whose action throws on the first attempt only and has maxRetries 3
  WHEN run() is called
  THEN the forward action is attempted twice
  AND the returned status is "COMPLETED"
  AND no compensating action is invoked
```

```gherkin
SCENARIO: BDD-744 plan() previews without executing and fingerprints distinguish outcomes
  GIVEN a saga with a single step "x" whose action would set an execution flag
  WHEN plan() is called
  THEN it returns ["x"] and the execution flag remains false
  AND two runs with identical step names but different forward outcomes produce different traceFingerprint() values
```

## 4. Architecture Decision Records (ADRs)

- **ADR-165-1: Reverse-order compensation with recorded, best-effort unwind**

  - _Context_: A mid-saga failure must undo side effects, but a compensating action can itself fail and the orchestrator must not become stuck or leak already-compensated steps.
  - _Decision_: Unwind completed steps strictly in reverse registration order; catch and trace compensation failures, then continue the unwind, returning status "ROLLED_BACK" with completedSteps emptied.
  - _Consequence_: Rollback is guaranteed to attempt every compensation and produces an auditable trace, but individual compensation failures are surfaced in the trace rather than raised to the caller.

- **ADR-165-2: Per-step bounded retry with a deterministic trace fingerprint**
  - _Context_: Transient faults are common; operators need a stable, comparable record of an execution to reason about and diff runs.
  - _Decision_: Apply a per-step retry budget (default 1, rejected below 1) and derive a `traceFingerprint()` from a canonical serialization of the trace via `pureSha256`.
  - _Consequence_: Retries absorb transient faults without operator intervention, and identical execution traces yield identical fingerprints for regression comparison.

## 5. Atomic Task DAG

1. [x] **TASK-165-1**: Author SPEC-165 defining the Saga Orchestrator requirements, BDD scenarios, and ADRs.
2. [x] **TASK-165-2**: Implement `src/core/eosSagaOrchestrator.ts` with ordered forward steps, bounded retry, reverse compensation, and trace fingerprinting.
3. [x] **TASK-165-3**: Add the `SPEC-165` suite to `test/eosBigTechTransactions.test.mjs` covering happy path, rollback, retry, plan, and fingerprint.
4. [x] **TASK-165-4**: Verify with `npm run typecheck` and the CI pipeline stages (7/7 exit code 0).
