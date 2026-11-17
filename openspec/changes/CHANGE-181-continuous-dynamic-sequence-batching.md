# CHANGE-181: Continuous Dynamic Sequence Batching & Iteration-Level Request Scheduler

**Status**: `PROPOSED`
**Specification**: `SPEC-319`
**Intake Reference**: `INTAKE-181`
**Author**: Valentin Florez Arbelaez & Glorian / EOS Engineering Guild
**Date**: 2026-11-17

---

## 1. Intent & Scope

Provide a production-grade continuous sequence batching and iteration-level scheduler (`EosContinuousDynamicBatchingCore`) that eliminates padding waste, maximizes token throughput, minimizes Time-to-First-Token (TTFT), and enforces fair memory preemption across concurrent LLM generation requests.

## 2. Delta Specification

- **Add**: `src/core/eosContinuousDynamicBatching.types.ts`
  - Contracts for `BatchRequest`, `RunningSlot`, `BatchSchedulerConfig`, `StepIterationResult`, `BatchMetricsSnapshot`, and `BatchAuditReceipt`.
- **Add**: `src/core/eosContinuousDynamicBatching.ts`
  - Core implementation `EosContinuousDynamicBatchingCore`:
    - Priority-aware and FIFO waiting queue.
    - Dynamic slot allocation up to `maxBatchSize` ($B$).
    - Iteration forward step with token emission, EOS detection, and immediate eviction.
    - Memory preemption when available block budgets are exhausted.
    - Metrics collection (throughput tokens/sec, average latency, slot utilization, preemption count).
- **Add**: `bin/commands/cliContinuousDynamicBatching.mjs`
  - 5 CLI commands for scheduling, step iteration, request preemption, metrics inspection, and receipt audit.
- **Add**: `docs/formal/ContinuousDynamicBatching.tla` & `.cfg` (Model 63)
  - Formal TLA+ specification verifying slot capacity conservation, queue draining, and absence of deadlock.
- **Add**: `test/eosContinuousDynamicBatching.test.mjs`
  - BDD test scenarios `BDD-1689` through `BDD-1694`.

## 3. Backward Compatibility

- 100% non-breaking; fully additive.
- Interfaces natively with Paged KV-Cache (`SPEC-317`) and FlashAttention (`SPEC-318`).
