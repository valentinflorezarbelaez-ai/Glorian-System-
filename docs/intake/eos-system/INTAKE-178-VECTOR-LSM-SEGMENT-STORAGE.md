# INTAKE-178: Vector LSM-Tree Segment Storage Engine & Background Compaction

## 1. Context & Business Drivers

Following the completion of the SIMD Quantized Vector Embedding Engine (`SPEC-314` / `CHANGE-176`) and the Distributed Consistent Hashing Mesh (`SPEC-315` / `CHANGE-177`), Glorian System requires a durable, low-latency, append-only segment storage layer. In massive scale AI vector stores (e.g. Pinecone, Milvus, Qdrant, Google Vertex Vector Search), in-place updates and vector deletions in mutable HNSW graphs cause severe graph fragmentation, dangling edges, memory bloat, and lock contention.

To achieve production-grade persistence and zero degradation over billions of upserts and deletes, Glorian System introduces an architectural LSM-Tree (_Log-Structured Merge-Tree_) designed specifically for quantized vector embeddings:

1. **Mutable In-Memory MemTable**: Buffered high-speed vector insertions and tombstones protected by an append-only WAL.
2. **Immutable Quantized SSTable Segments**: Flushed when the MemTable reaches size or vector capacity thresholds, encoded with 16-byte aligned SIMD quantized payloads and sparse block indexes.
3. **Sparse Block Index & Bloom Filter**: Deterministic block-level boundaries enabling $O(1)$ negative lookup filtering and binary search skip-scanning without reading segment payloads.
4. **Concurrent K-Way Segment Compaction**: Background k-way merge of overlapping SSTable segments, purging deleted tombstones and deduplicating updated vector keys into consolidated, optimal-density segments.
5. **Zero-Downtime Point-in-Time Read Snapshot Isolation**: Ensuring that concurrent searches across MemTable and SSTables remain consistent without holding write locks.

## 2. Technical Invariants & Architectural Constraints

- **Zero External Dependencies**: Must run on Node.js built-ins (`fs`, `path`, `crypto`, `perf_hooks`, `Float32Array`, `Int8Array`, `Buffer`).
- **Headroom Limit**: Every source module must remain $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
- **Mathematical Soundness**: Formal TLA+ specification verifying that compaction preserves all live keys, purges expired tombstones, and maintains strictly monotonic SSTable key ordering.
- **Node 24 Strip-Only Parity**: No TypeScript runtime `enum`, standard professional English for all code and technical documentation.

## 3. Scope Boundaries

- **In Scope**:
  - In-memory MemTable with capacity threshold and tombstone marking (`DELETE`).
  - Immutable SSTable segment format with header, Bloom filter, sparse block index, and aligned data blocks.
  - Multi-level SSTable hierarchy (Level 0 and Level 1).
  - K-way merge compaction algorithm with tombstone purge and versioned manifest.
  - Point-in-time point lookup (`getVector`) and federated scatter scan across active segments.
  - Comprehensive CLI subcommands (`toolchain:lsm:*`) with pure `--json` output (`return true`).
  - Formal TLA+ specification (Model 60) checked via TLC.
- **Out of Scope**:
  - Network-distributed remote S3 cold archiving (handled by upper-layer cloud adapters).
