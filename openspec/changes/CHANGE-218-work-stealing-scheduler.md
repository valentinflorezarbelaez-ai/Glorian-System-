# CHANGE-218: Self-Rebalancing Ephemeral Micro-Thread Work-Stealing Scheduler

## 1. Proposal Overview

- **Change ID**: `CHANGE-218`
- **Specification ID**: `SPEC-356`
- **Ladder Stage**: `LADDER-13`
- **Domain**: Concurrent Micro-Scheduling, Lock-Free Work-Stealing & Ephemeral Task Fabrics
- **Architectural Reference**: Blumofe & Leiserson (Cilk Work-Stealing), Go Runtime Scheduler, Rust Tokio

---

## 2. Intent & Motivation

Provide an autonomous, lock-free work-stealing scheduler for high-volume ephemeral tasks across Glorian agent swarms and background workers. Replaces monolithic mutex queues with decentralized per-worker Chase-Lev deques and randomized victim stealing.

---

## 3. Scope of Implementation

1. **Core Type System**:
   - `src/core/eosWorkStealingScheduler.types.ts`: Define micro-task descriptors, Chase-Lev deque configurations, worker states, and scheduler telemetry.
2. **Core Domain Module**:
   - `src/core/eosWorkStealingScheduler.ts`:
     - `EosChaseLevDeque`: Lock-free deque with bottom push/pop for owner and top steal for thieves.
     - `EosMicroTaskWorker`: Execution fiber with local deque and pseudo-random victim selection.
     - `EosWorkStealingSchedulerCore`: Multi-worker pool coordinator, task distributor, and formal audit driver.
3. **Formal Verification (TLA+ Model 99)**:
   - `docs/formal/WorkStealingScheduler.tla` and `docs/formal/WorkStealingScheduler.cfg`.
4. **CLI & Toolchain Router**:
   - `bin/commands/cliWorkStealingScheduler.mjs` registering `toolchain:sched:spawn`, `toolchain:sched:steal`, `toolchain:sched:bench`, and `toolchain:sched:audit`.
   - Wiring in `bin/commands/cliToolchainRouter.mjs` and `bin/commands/cliHelpCatalog.mjs`.
5. **Phase 8 MCP Tool**:
   - `eos_work_stealing_scheduler_audit` in `src/core/eosMcpToolTaxonomy.ts`, definitions, handlers, and catalog.
6. **Automated Test Suite**:
   - `test/eosWorkStealingScheduler.test.mjs` verifying `BDD-1915`..`BDD-1920`.
