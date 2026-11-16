# INTAKE-156: Event-Sourced Durable Execution Engine (Temporal Model)

- **Intake ID**: `INTAKE-156`
- **Change ID**: `CHANGE-156`
- **Spec Reference**: `SPEC-294`
- **Target Module**: `src/core/eosDurableExecutionEngine.ts`
- **Tier**: Distributed Durable Workflows & Event Sourcing
- **Owner**: `user:valentin-florez-arbelaez`
- **Timestamp**: 2026-11-15T21:12:00Z
- **Status**: `INTAKE_COMPLETE`

---

## 1. Business Need & Context

In autonomous software engineering and multi-agent control planes, agent actions (such as `inspect → plan → worktree → validate → review → apply`) cannot run as volatile in-memory promises. If a node crashes, network drops, or a container restarts, uncompleted workflows are lost and cannot be audited.
Glorian System requires an event-sourced durable execution engine modeled after Temporal.io / Cadence that:

1. Backs every workflow step with immutable, append-only event logs in native `node:sqlite`.
2. Emits events to an optional external Kafka / Dapr sidecar via native HTTP/JSON without adding npm dependencies (Law V).
3. Provides deterministic workflow replay, reconstructing full execution state bit-for-bit from history without re-executing completed activities or non-deterministic side effects.
4. Supports Saga compensation: if a subsequent activity fails, prior completed activities execute deterministic rollback compensations in reverse order.
5. Enables durable pause, suspension, and resumption across different machine processes.
6. Emits cryptographic verification evidence at `docs/evidence/DURABLE_EXECUTION_RECEIPT.json`.

---

## 2. Scope & Technical Objectives

- **Pure Layer-0 TypeScript**: Zero external runtime dependencies (`dependencies: {}`).
- **Event-Sourced Event Store**: Append-only log of workflow events (`WorkflowStarted`, `ActivityScheduled`, `ActivityCompleted`, `ActivityCompensated`, `WorkflowCompleted`).
- **Deterministic Replay Engine**: Replays event streams to recreate state, verifying event log integrity and skipping already-recorded side effects.
- **Saga Pattern Compensation**: Automatic reverse execution of registered compensators upon activity failure.
- **CLI Subcommands**: `toolchain:durable:start`, `toolchain:durable:resume`, `toolchain:durable:replay`, `toolchain:durable:audit`.
- **Evidence Receipt**: `docs/evidence/DURABLE_EXECUTION_RECEIPT.json`.
