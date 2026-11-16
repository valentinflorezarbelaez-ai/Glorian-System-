# CHANGE-156: Event-Sourced Durable Execution Engine (Temporal Model)

- **Change ID**: `CHANGE-156`
- **Spec Reference**: `SPEC-294`
- **Status**: `PROPOSED`
- **Target Module**: `src/core/eosDurableExecutionEngine.ts`
- **Tier**: Distributed Durable Workflows & Event Sourcing
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Intent & Architectural Justification

Migrate agent workflow execution from ephemeral local files in `.eos/workflows/` to an event-sourced, deterministic durable execution engine modeled after Temporal.io. Every workflow activity is persisted in an append-only event store backed by `node:sqlite` or in-memory WAL with optional HTTP egress to Apache Kafka sidecars. Replaying past workflow histories guarantees bit-for-bit state reconstruction, verifiable auditing of agent behaviors, and crash-resilient pause/resume mechanics.

---

## 2. Capabilities & Deliverables

1. `src/core/eosDurableExecutionEngine.types.ts` & `src/core/eosDurableExecutionEngine.ts`:
   - `WorkflowEvent`: Discriminated union of append-only events.
   - `DurableEventStore`: Manages append-only event streams in SQLite / memory with SHA-256 state chain.
   - `DurableWorkflowEngine`: Orchestrates workflow execution, evaluates idempotent activities, handles Saga rollbacks, and supports pause/resume.
   - `WorkflowReplayer`: Deterministically reconstructs workflow state from history events without side effects.
   - `auditDurablePipeline`: Validates execution, persistence, replay, compensation, and emits `docs/evidence/DURABLE_EXECUTION_RECEIPT.json`.
2. CLI subcommands in `bin/commands/cliDurableEngine.mjs` and delegation in `bin/commands/cliDevOps.mjs`:
   - `toolchain:durable:start`: Initiates a durable workflow instance.
   - `toolchain:durable:resume`: Resumes a paused/suspended workflow instance.
   - `toolchain:durable:replay`: Replays an event stream verifying deterministic state reconstruction.
   - `toolchain:durable:audit`: Audits durable engine capabilities and emits cryptographic receipt.
3. BDD test suite: `test/eosDurableExecutionEngine.test.mjs` verifying BDD-1539..1544.
