# SPEC-294: Event-Sourced Durable Execution Engine (Temporal Model)

- **Specification ID**: `SPEC-294`
- **Change ID**: `CHANGE-156`
- **Status**: `APPROVED`
- **Module**: `src/core/eosDurableExecutionEngine.ts`
- **Tier**: Distributed Durable Workflows & Event Sourcing
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-294-01 (Event-Driven Workflow Initialization & Event Appending)**: WHEN a workflow instance is instantiated, THE SYSTEM SHALL allocate an isolated event stream, record a `WorkflowStarted` event, and append subsequent activity execution events monotonically with contiguous sequence numbers.
- **FR-294-02 (State-Driven Deterministic Replay & State Reconstruction)**: MIENTRAS an event stream is being replayed, THE SYSTEM SHALL reconstruct the exact workflow state by re-applying event mutations without re-executing non-deterministic side effects or external HTTP activities.
- **FR-294-03 (Error / Unwanted Condition: Saga Compensation on Activity Failure)**: SI an activity fails and exhausts its configured retries, ENTONCES EL SISTEMA SHALL trigger reverse Saga compensation, invoking registered compensation handlers for all previously completed activities in reverse order.
- **FR-294-04 (State-Driven Durable Pause & Resumption)**: MIENTRAS a workflow is suspended or awaiting human-in-the-loop review, THE SYSTEM SHALL persist a `WorkflowSuspended` checkpoint, allowing any subsequent process to reload the state and resume execution seamlessly.
- **FR-294-05 (Event-Driven Sidecar Kafka / Dapr Event Outbox)**: WHEN a workflow event is committed, THE SYSTEM SHALL forward the event via native HTTP JSON to the configured sidecar endpoint if `EOS_KAFKA_SIDECAR_URL` is set, without blocking local progress.
- **FR-294-06 (Cryptographic Proof Receipt)**: WHEN a durable workflow execution audit completes, THE SYSTEM SHALL persist a verification receipt at `docs/evidence/DURABLE_EXECUTION_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1539 Workflow Event Sourcing & Monotonic Sequence Numbering
  GIVEN a workflow definition with sequential activities (inspect -> plan -> worktree)
  WHEN DurableWorkflowEngine executes the workflow
  THEN it appends events to the event store with strictly monotonic sequence numbers
  AND each event contains an immutable payload and SHA-256 state chain hash.

SCENARIO: BDD-1540 Deterministic Replay & State Reconstruction without Side Effects
  GIVEN a completed or in-flight workflow event history
  WHEN WorkflowReplayer replays the event stream
  THEN it reconstructs the identical workflow state bit-for-bit
  AND zero side-effect functions are re-invoked during replay.

SCENARIO: BDD-1541 Saga Pattern Reverse Compensation on Activity Failure
  GIVEN a multi-step workflow where activity 3 throws an unhandled error
  WHEN the workflow execution fails
  THEN the engine executes compensation handlers for activity 2 and activity 1 in reverse order
  AND appends ActivityCompensated events recording successful rollback.

SCENARIO: BDD-1542 Durable Pause, Suspension & Multi-Process Resumption
  GIVEN a long-running workflow paused at the "review" step
  WHEN execution is suspended and subsequently resumed by a fresh engine instance
  THEN the engine reloads the event stream, skips completed steps, and finishes the remaining activities.

SCENARIO: BDD-1543 Outbox Sidecar Event Emission via Native HTTP
  GIVEN a configured sidecar URL in EOS_KAFKA_SIDECAR_URL
  WHEN new workflow events are committed
  THEN the engine issues asynchronous HTTP POST requests delivering event JSON to the sidecar
  AND failure of the sidecar does not corrupt local SQLite persistence (fail-open outbox).

SCENARIO: BDD-1544 Cryptographic Durable Execution Receipt Generation
  GIVEN an audit executed via toolchain:durable:audit or auditDurablePipeline
  WHEN the audit completes
  THEN docs/evidence/DURABLE_EXECUTION_RECEIPT.json is written
  AND contains totalEventsRecorded, replayDeterministicMatch, sagaCompensationsVerified, and a valid sha256Signature.
```
