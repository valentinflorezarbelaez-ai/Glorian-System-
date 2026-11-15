# Intake Record: INTAKE-147 — Distributed Deadlock Detection & Wait-For Graph (WFG) Cycle Governor

- **Change Reference**: `CHANGE-147`
- **Spec Reference**: `SPEC-285`
- **Target Subsystem**: `src/core/eosDeadlockDetectionGovernor.ts` / `bin/commands/cliDeadlock.mjs`
- **Author**: Glorian Control Plane / Valentín Flórez Arbeláez
- **Date**: 2026-11-15
- **Status**: `INTAKE_COMPLETE`
- **Priority**: High (Phase E7 — Distributed Transaction Concurrency & Deadlock Resolution)

---

## 1. Problem Statement

In distributed ACID database and agent coordination architectures (Google Spanner, CockroachDB, AWS Aurora, PostgreSQL), long-lived concurrent transactions acquire exclusive or shared row/shard locks. When dependency chains form cycles ($T_1 \rightarrow T_2 \rightarrow \dots \rightarrow T_1$), transactions enter an indefinite freeze (deadlock), exhausting connection pools and causing cascading system failure.

Naive lock timeouts either abort transactions prematurely (false deadlocks) or wait too long, degrading p99 transaction latency.

To guarantee zero-deadlock guarantees and prompt, deterministic conflict resolution:

1. **Dynamic Wait-For Graph (WFG)**: Build a directed dependency graph $G = (V, E)$ from lock allocation and wait events.
2. **Cycle Detection Algorithm**: Detect all directed circular paths ($O(V+E)$) without recursion stack explosion.
3. **Wound-Wait & Wait-Die Preemption**: Enforce timestamp-priority deadlock avoidance schemes (older transaction wounds or younger transaction dies).
4. **Deterministic Victim Selection**: Abort the optimal victim transaction (youngest timestamp or fewest locks held) to break cycles with minimum abort overhead.
5. **Verifiable Audit Receipt**: Sealed cryptographic receipt in `docs/evidence/DEADLOCK_RECEIPT.json`.

## 2. Requirements & Scope

- **Pure Layer-0 TypeScript**: Zero external dependencies (`dependencies: {}`).
- **Wait-For Graph Builder**: Ingest transactions, locks held, and pending lock requests.
- **Cycle Detection**: Identify cyclic dependency subgraphs and report cycle paths.
- **Resolution Matrix**: Execute Wound-Wait and Wait-Die strategies with clear action directives (`ABORT`, `WAIT`, `GRANTED`).
- **Verification CLI**: Subcommands `toolchain:deadlock:audit`, `toolchain:deadlock:wfg`, `toolchain:deadlock:resolve`.
- **Receipt & Artifact Integrity**: `docs/evidence/DEADLOCK_RECEIPT.json` sealed with SHA-256.
- **Testing**: BDD scenarios BDD-1485 through BDD-1490.
