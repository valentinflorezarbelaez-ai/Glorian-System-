# PLAN-178: Vector LSM-Tree Segment Storage Engine & Background Compaction

## 1. Architecture Overview

The Vector LSM-Tree engine (`EosVectorLsmStorageCore`) implements an append-only, hierarchical storage architecture specifically engineered for high-dimensional quantized vector embeddings (`Int8Array` payloads with scale, zeroPoint, and norm parameters from `SPEC-314`).

```
 Writes: insertVector / deleteVector
    │
    ▼
┌──────────────────────────────────────────────┐
│                  MemTable                    │ (Sorted SkipList / Balanced Map)
│  - Active memory buffer                      │
│  - Key -> { type: PUT|DEL, vector, seq }     │
└──────────────────────┬───────────────────────┘
                       │ (Flush when size >= threshold)
                       ▼
┌──────────────────────────────────────────────┐
│           Level 0 (L0) SSTables              │ (Immutable files / memory segments)
│  ┌────────────────────────────────────────┐  │
│  │ Segment L0-001                         │  │
│  │  - Bloom Filter (murmur3 / fnv1a)      │  │
│  │  - Sparse Block Index (Key -> offset)  │  │
│  │  - Data Blocks (Sorted Vectors)        │  │
│  └────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────┘
                       │ (K-Way Merge Compaction)
                       ▼
┌──────────────────────────────────────────────┐
│           Level 1 (L1) SSTables              │ (Consolidated, non-overlapping)
│  - Tombstones purged                         │
│  - Deduplicated by latest seq                │
└──────────────────────────────────────────────┘
```

## 2. Architectural Decision Records (ADRs)

### ADR-178-001: Quantized Vector LSM Architecture vs Mutable In-Place Graph Updates

- **Context**: In traditional vector databases, deletions in HNSW graphs require re-routing graph edges, creating severe locks, graph fragmentation, and dangling pointers.
- **Decision**: Adopt an LSM-Tree architecture where deletions write a Tombstone record to the MemTable. Physical removal occurs asynchronously during k-way compaction.
- **Consequences**: Enables lock-free writes, sub-millisecond append latency, and sequential immutable SSTable files.

### ADR-178-002: Block-Level Sparse Indexing with Fast Bitwise Bloom Filters

- **Context**: Point queries (`getVector`) must not scan entire segment data blocks for negative lookups.
- **Decision**: Equip each SSTable segment with an in-memory 1024-bit Bloom filter using double-hashing (FNV-1a + Murmur3-style bit mixing) and a sparse block index recording the boundary keys of each block of vectors (e.g. 16 vectors per block).
- **Consequences**: Negative queries short-circuit in $O(1)$ time without reading data blocks. Positive queries locate the candidate block via binary search in $O(\log B)$ time.

### ADR-178-003: Deterministic K-Way Merge Compaction with Complete Tombstone Elimination

- **Context**: Compacting segments across levels must deduplicate keys and eliminate deleted entries without creating data corruption or dropping live keys.
- **Decision**: Implement a deterministic priority-queue k-way merge across Level 0 segments. For keys marked with `TOMBSTONE`, if compaction merges all current segments containing that key, the entry is completely discarded.
- **Consequences**: Bounded disk footprint, reclaim of storage space, and zero dead vectors in compacted Level 1 segments.

## 3. Rejected Alternatives

- **Direct in-memory array filtering**: Rejected because it causes massive GC churn and cannot scale to hundreds of thousands of vectors.
- **SQLite secondary vector table for storage**: Rejected because SQLite introduces locking overhead and does not provide native SIMD 16-byte aligned vector block scans.
- **External RocksDB/LevelDB C++ bindings**: Strictly rejected due to EOS Constitution Law of Zero Runtime Dependencies (`dependencies: {}`).
