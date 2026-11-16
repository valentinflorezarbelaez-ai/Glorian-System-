# SPEC-311: Shared-Memory Worker Pool, In-WASM SIMD128 Loops & Multi-Process SQLite WAL Crash Recovery

## Metadata

- **Specification ID**: `SPEC-311`
- **Change Reference**: `CHANGE-173`
- **Version**: `1.0.0`
- **Status**: `STABLE_AND_ACTIVE`
- **Domain**: Multi-Core Concurrency / WebAssembly Shared Memory / Jepsen Crash Recovery / Zero Dependencies
- **Author**: Valentin Florez Arbelaez & Google Antigravity (Glorian Core Architects)
- **Compliance**: IEEE 830 EARS Requirements, BDD Acceptance Criteria, Zero Third-Party Dependencies (Law V)

---

## 1. IEEE 830 Functional Requirements (EARS Syntax)

### FR-311-01: Single-Call In-WASM SIMD128 Vector Loop Execution (Event-Driven)

WHEN `executeSimdVectorMaxJoin` or `benchmarkSimd128VsScalar` runs, THE SYSTEM SHALL invoke the exported in-WASM structured loop `simd_i32x4_max_join_loop(offsetA, offsetB, offsetOut, byteLen)` in a single JS-to-WASM call across 4-lane `v128` chunks without per-chunk JS trampoline crossings.

### FR-311-02: Shared `WebAssembly.Memory` (`SharedArrayBuffer`) Arena Allocation (Event-Driven)

WHEN `createSharedWasmArena(initialPages, maxPages)` is invoked with valid page bounds, THE SYSTEM SHALL instantiate `new WebAssembly.Memory({ initial, maximum, shared: true })`, confirm `memory.buffer instanceof SharedArrayBuffer`, and return arena geometry metadata.

### FR-311-03: Lock-Free Multi-Core `worker_threads` Reduction via `Atomics` (Event-Driven)

WHEN `executeParallelSharedArenaReduction(elements, workerCount)` is invoked, THE SYSTEM SHALL partition `elements` in shared linear memory, execute `workerCount` parallel `worker_threads.Worker` tasks accumulating sums via `Atomics.add`, maxima via `Atomics.compareExchange`, and completion barriers via `Atomics.add` / `Atomics.notify`, verifying `atomicCompletedWorkers === workerCount`.

### FR-311-04: Parallel Sharded Elastic Fleet Audit & Merkle Folding (Event-Driven)

WHEN `executeParallelElasticFleetAudit(projectIds, shardCount)` is invoked, THE SYSTEM SHALL distribute project audits across `shardCount` worker shards sharing an atomic progress counter, seal per-shard SHA-256 digests, and compute `fleetMerkleRoot` via `EosUniversalFleetSyncCore.computeFleetMerkleRoot`.

### FR-311-05: Multi-Process On-Disk SQLite WAL Crash Recovery (Jepsen Drill) (Event-Driven)

WHEN `executeMultiProcessWalCrashRecoveryDrill(projectRoot)` is invoked, THE SYSTEM SHALL spawn an independent OS child process committing 4 durable ACID records in `WAL` mode (`synchronous = FULL`), initiate 2 uncommitted dirty writes, terminate abruptly mid-transaction, and verify from a fresh parent `DatabaseSync` reader that all `4` committed records survive with `0` dirty records leaked and identical Merkle root parity.

### FR-311-06: Fail-Closed Preconditions, Receipt Emission & CLI Parity (Ubiquitous)

IF worker counts, page bounds, or input arrays violate bounds, THE SYSTEM SHALL fail closed throwing `PRECONDITION_FAILED`; AND `auditSharedMemoryWorkerPoolPipeline()` SHALL emit `docs/evidence/SHARED_MEMORY_WORKER_POOL_RECEIPT.json` alongside pure `--json` CLI subcommands `toolchain:workers:*`.

---

## 2. BDD Acceptance Criteria

### BDD-1641: Single-Call In-WASM SIMD128 Structured Vector Loop Performance & Parity

```gherkin
SCENARIO: Execute full vector inside a single WASM SIMD128 call
  GIVEN 128-element Int32Array inputs staged in linear memory
  WHEN benchmarkSimd128VsScalar(128, 250) executes using simd_i32x4_max_join_loop
  THEN deterministicMatch equals true and simdNsPerOp is strictly below 150 ns/op (removing per-chunk JS trampoline overhead).
```

### BDD-1642: Shared WebAssembly.Memory (`SharedArrayBuffer`) Allocation & Bounds

```gherkin
SCENARIO: Allocate shared WebAssembly linear memory and reject invalid bounds
  WHEN createSharedWasmArena(4, 16) is invoked
  THEN isSharedArrayBuffer is true and byteLength equals 262144
  AND invalid bounds (initialPages = 0 or maxPages < initialPages) throw PRECONDITION_FAILED.
```

### BDD-1643: Multi-Core `worker_threads` Parallel Reduction via `Atomics`

```gherkin
SCENARIO: Aggregate elements in parallel across SharedArrayBuffer worker threads
  GIVEN an input vector and workerCount = 2
  WHEN executeParallelSharedArenaReduction executes
  THEN totalSum and maxElement equal exact sequential ground truth
  AND atomicCompletedWorkers equals 2 with sharedMemoryVerified = true.
```

### BDD-1644: Sharded Elastic Fleet Audit & Merkle Root Convergence

```gherkin
SCENARIO: Audit sharded fleet projects concurrently with atomic progress counter
  GIVEN 16 project IDs and shardCount = 4
  WHEN executeParallelElasticFleetAudit runs
  THEN atomicProgressCount equals 16, shards.length equals 4, and fleetMerkleRoot is a 64-char SHA-256 hex digest.
```

### BDD-1645: Multi-Process SQLite WAL Crash Recovery Drill (Jepsen)

```gherkin
SCENARIO: Recover 100% committed records and 0 uncommitted dirty rows after abrupt process crash
  WHEN executeMultiProcessWalCrashRecoveryDrill runs across child and parent OS processes
  THEN walModeVerified is true, committedRecordsRecovered equals 4, and uncommittedDirtyRecordsLeaked equals 0
  AND merkleRootAfterRecovery equals merkleRootBeforeCrash with zeroDataLossVerified = true.
```

### BDD-1646: Signed Audit Receipt & Pure `--json` CLI Output (`toolchain:workers:*`)

```gherkin
SCENARIO: Emit signed SPEC-311 receipt and verify pure JSON CLI execution
  WHEN auditSharedMemoryWorkerPoolPipeline() and `node bin/eos.mjs toolchain:workers:reduce --json` execute
  THEN docs/evidence/SHARED_MEMORY_WORKER_POOL_RECEIPT.json is written with status SHARED_MEMORY_WORKERS_AND_JEPSEN_VERIFIED
  AND JSON.parse succeeds cleanly on CLI stdout.
```
