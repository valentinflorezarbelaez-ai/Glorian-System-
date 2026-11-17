# Intake & Context: Continuous Dynamic Sequence Batching & Iteration-Level Request Scheduler

**Identifier**: `INTAKE-181`
**Target Specification**: `SPEC-319`
**Target Change**: `CHANGE-181`
**Status**: `INTAKE_APPROVED`
**Author**: Valentin Florez Arbelaez & Glorian / EOS Engineering Guild
**Date**: 2026-11-17

---

## 1. Problem Statement & Motivation

In production Large Language Model (LLM) serving and autonomous agent execution grids:

1. **Static Batching Inefficiencies**: Traditional batching engines group $B$ requests and force all sequences to run until the longest request completes. Short sequences finish early and remain idle in memory while padding tokens ("bubble waste") consume 50% to 75% of computational throughput.
2. **High Time-to-First-Token (TTFT) and Tail Latency (TP99)**: New requests arriving while a static batch is running must wait in the queue until the entire current batch completes, causing high TTFT and erratic latency spikes.
3. **Memory Pressure and Preemption**: When memory is constrained (as bounded by Paged KV-Cache in `SPEC-317`), long prompts can trigger out-of-memory (OOM) unless requests can be preempted gracefully (via KV-cache page swapping or recomputation) and resumed seamlessly.

## 2. Architectural Solution

Implement an iteration-level continuous sequence batching engine (`EosContinuousDynamicBatchingCore`) based on Orca / vLLM / Cellular scheduling principles:

1. **Iteration-Level Scheduling Step**: Rather than scheduling at request granularity, the engine schedules at the token-generation iteration step ($\Delta t$). At each step, running sequences produce one token; completed sequences (reaching EOS or maximum tokens) are evicted immediately.
2. **Zero-Bubble Dynamic Ingestion**: Fresh pending requests from the waiting queue are admitted into newly vacated slots on the very next iteration step without re-padding or disturbing surviving sequences.
3. **Fair Queuing & Priority Preemption**: Supports FIFO, Priority, and Shortest-Job-First (SJF) scheduling policies with graceful preemption when memory block limits are reached.
4. **Integration with Paged KV-Cache (`SPEC-317`) and FlashAttention (`SPEC-318`)**: Communicates with page table managers to dynamically allocate blocks per active iteration and deallocate on request completion.
5. **Zero External Runtime Dependencies**: Pure Node 24 strip-only TypeScript conforming to `dependencies: {}`.

## 3. Success Metrics & Verification Criteria

1. **Zero Padding Bubble Overhead**: Slot utilization remains $\ge 90\%$ under continuous load with 0 zero-padding tokens injected.
2. **Iteration Turnaround**: Step scheduling overhead strictly sub-millisecond ($< 500\,\mu\text{s}$) for batches of up to 64 sequences.
3. **Formal Verification (TLC Model 63)**: Verification of starvation freedom, capacity conservation, and absence of slot leakage across arbitrary request arrival and completion sequences.
4. **CLI Parity**: 5 new commands (`toolchain:continuous:*`) registered in catalog and developer guide with `return true` for clean `--json`.
5. **BDD Suite**: 6 scenarios (`BDD-1689`..`BDD-1694`) passing 100% with signed cryptographic SHA-256 receipt.
