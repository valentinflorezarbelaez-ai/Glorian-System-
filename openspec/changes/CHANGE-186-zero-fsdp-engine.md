# CHANGE-186: ZeRO (Zero Redundancy Optimizer) & Fully Sharded Data Parallel (FSDP) Engine

**Change Reference**: `CHANGE-186`  
**Specification Reference**: `SPEC-324`  
**Scope**: `src/core/`, `bin/commands/`, `test/`, `docs/formal/`  
**Status**: PROPOSED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Intent & Purpose

This change introduces the sovereign **ZeRO & Fully Sharded Data Parallel (FSDP) Engine** (`EosZeroFsdpCore`), completing the memory optimization tier of the Glorian System distributed deep learning stack. It implements ZeRO-Stage 1 ($P_{os}$), ZeRO-Stage 2 ($P_{os+g}$), and ZeRO-Stage 3 / FSDP ($P_{os+g+p}$) with parameter reconstruction, gradient reduce-scatter, host offloading, and formal TLA+ mathematical verification.

---

## 2. Delta Specification

### Added Capabilities:

- `src/core/eosZeroFsdpEngine.types.ts`: Type definitions for ZeRO stages (1, 2, 3), optimizer parameter shards, memory budgets, communication schedules, and audit receipts.
- `src/core/eosZeroFsdpEngine.ts`: Core class `EosZeroFsdpCore` implementing:
  - `partitionOptimizerStates(params, grads)`: ZeRO-1 optimizer sharding.
  - `stepZeRO1(params, grads, config)`: Optimizer state sharded update.
  - `stepZeRO2(params, grads, config)`: Optimizer state + gradient sharded update with Reduce-Scatter.
  - `stepZeRO3(shardedParams, layerGrads, config)`: Full parameter + gradient + optimizer sharded execution (FSDP) with just-in-time All-Gather.
  - `offloadToHost(shard, device)`: ZeRO-Infinity host memory offloading and prefetching.
  - `audit()`: Cryptographic verification of memory scaling, zero leakage, and mathematical parity.
- `docs/formal/ZeroFsdpEngine.tla` & `.cfg`: Formal TLA+ Model 68 verified with Leslie Lamport's TLC.
- `bin/commands/cliZeroFsdpEngine.mjs`: 5 new CLI commands under `toolchain:zero:`.
- `test/eosZeroFsdpEngine.test.mjs`: BDD test suite covering scenarios `BDD-1719`..`BDD-1724`.
