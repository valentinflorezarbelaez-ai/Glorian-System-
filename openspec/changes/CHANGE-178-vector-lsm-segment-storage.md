# CHANGE-178: Vector LSM-Tree Segment Storage Engine, Sparse Block Index & Background Compaction

## 1. Intent

Implement a high-throughput, zero-dependency, append-only Log-Structured Merge-Tree (LSM-Tree) engine tailored for quantized vector embeddings, featuring immutable SSTable segments, sparse block indexing, fast Bloom filtering, snapshot read isolation, and background k-way compaction with tombstone purging.

## 2. Motivation

In-place mutations and deletions in HNSW graphs cause irrecoverable routing quality degradation and heap fragmentation. An LSM architecture separates write buffering from immutable reads, enabling sub-millisecond append latency, sequential disk I/O, deterministic versioning, and non-blocking background consolidation.

## 3. Scope of Changes

- Formal Specification: `openspec/specs/SPEC-316-vector-lsm-segment-storage.md`
- Intake & Context: `docs/intake/eos-system/INTAKE-178-VECTOR-LSM-SEGMENT-STORAGE.md`
- Architecture Plan & ADRs: `docs/plans/PLAN-178-vector-lsm-segment-storage.md`
- Tasks Breakdown: `docs/tasks/TASKS-178-vector-lsm-segment-storage.md`
- Formal Verification Model (TLA+ Model 60): `docs/formal/VectorLsmStorage.tla` & `docs/formal/VectorLsmStorage.cfg`
- Domain Contracts: `src/core/eosVectorLsmStorage.types.ts`
- Domain Implementation: `src/core/eosVectorLsmStorage.ts`
- Export Core: `src/core/index.ts`
- CLI Dispatcher: `bin/commands/cliVectorLsmStorage.mjs`
- Toolchain Router: `bin/commands/cliToolchainRouter.mjs` (`toolchain:lsm:*`)
- CLI Parity Catalog: `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` (503 -> 508 commands)
- BDD Test Suite: `test/eosVectorLsmStorage.test.mjs` (`BDD-1671`..`BDD-1676`)
- Evidence Receipt: `docs/evidence/VECTOR_LSM_STORAGE_RECEIPT.json`

## 4. Invariants

- Zero plain secrets, zero external dependencies (`dependencies: {}`).
- Strict $\le 800$ lines with $\ge 12$ lines headroom per file (`SPEC-250`).
- No live key lost during concurrent compaction.
- Tombstones purged only after merging down to the highest level without older duplicates.
- All CLI handlers return `true` for pure `--json` output without trailing banners.
