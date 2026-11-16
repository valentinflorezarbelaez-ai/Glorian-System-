# PLAN-156: Event-Sourced Durable Execution Engine (Temporal Model)

- **Plan ID**: `PLAN-156`
- **Change ID**: `CHANGE-156`
- **Spec Reference**: `SPEC-294`
- **Status**: `APPROVED`
- **Target Module**: `src/core/eosDurableExecutionEngine.ts`
- **Tier**: Distributed Durable Workflows & Event Sourcing
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Architectural Strategy

The Event-Sourced Durable Execution Engine replaces fragile filesystem state under `.eos/workflows/` with a deterministic, crash-resilient workflow state machine modeled after Temporal.io.

### Pure Layer-0 Architecture (Law V)

1. **Append-Only Event Store (`DurableEventStore`)**:
   - Stores chronological, immutable events for each workflow stream (`workflowId`).
   - Supports in-memory WAL and persistent SQLite backing via `node:sqlite`.
   - Each event carries `{ seq, timestamp, type, payload, stateHash }`, forming an append-only cryptographic hash chain.
2. **Workflow Definition & Execution Machine (`DurableWorkflowEngine`)**:
   - Defines workflows with sequential or directed-acyclic activities.
   - Activities have a unique identifier, execute handler, optional retry count, and optional compensation handler.
   - Idempotency guard: before executing an activity, checks if an `ActivityCompleted` event already exists in the history.
3. **Deterministic State Replayer (`WorkflowReplayer`)**:
   - Rebuilds in-memory state bit-for-bit from the stored event stream.
   - Distinguishes between live execution and replay mode: in replay mode, all side-effecting code is skipped, returning recorded outputs.
4. **Saga Pattern Rollback & Compensation**:
   - If an unrecoverable failure occurs during an activity, the engine iterates backwards through the stack of completed activities and executes registered `compensate` routines.
   - Records `ActivityCompensated` events to document the full rollback trajectory.
5. **Durable Pause & Resumption**:
   - Supports pausing a workflow at arbitrary checkpoints (e.g. human-in-the-loop review, long-duration external checks).
   - Re-instantiating the engine with the existing `workflowId` automatically reconstructs state via replay and resumes execution from the exact point of suspension.
6. **Kafka / Dapr Sidecar Outbox**:
   - When `EOS_KAFKA_SIDECAR_URL` is present, dispatches non-blocking HTTP POST requests containing serialized events to the external sidecar.
7. **Cryptographic Proof Receipt**:
   - Emits verification metadata at `docs/evidence/DURABLE_EXECUTION_RECEIPT.json`.

---

## 2. Component Design & Interfaces

```typescript
export type WorkflowEventType =
  | "WorkflowStarted"
  | "ActivityScheduled"
  | "ActivityStarted"
  | "ActivityCompleted"
  | "ActivityFailed"
  | "ActivityCompensated"
  | "WorkflowSuspended"
  | "WorkflowResumed"
  | "WorkflowCompleted"
  | "WorkflowFailed";

export interface WorkflowEvent {
  workflowId: string;
  seq: number;
  timestamp: string;
  type: WorkflowEventType;
  payload: Record<string, unknown>;
  stateHash: string;
}

export interface ActivityDefinition<TInput = any, TOutput = any> {
  name: string;
  execute: (input: TInput, ctx: ActivityContext) => Promise<TOutput> | TOutput;
  compensate?: (input: TInput, ctx: ActivityContext) => Promise<void> | void;
  maxRetries?: number;
}

export interface WorkflowDefinition<TWorkflowInput = any, TWorkflowOutput = any> {
  name: string;
  activities: ActivityDefinition[];
  run: (input: TWorkflowInput, ctx: WorkflowContext) => Promise<TWorkflowOutput>;
}
```

---

## 3. Rejected Alternatives & Tradeoffs

- **Direct Temporal SDK / KafkaJS NPM Packages**: Rejected because it violates Law V (zero third-party dependencies in `dependencies: {}`).
- **Filesystem JSON File Mutating**: Rejected because single mutable JSON files suffer from write-skew, race conditions, and inability to audit historical states.
- **Synchronous Blocking Kafka Producer**: Rejected because if Kafka or the sidecar is temporarily unreachable, the core agent engine must maintain progress and fail-open with local SQLite durability.
