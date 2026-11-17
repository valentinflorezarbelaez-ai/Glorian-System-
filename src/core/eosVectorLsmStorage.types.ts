/**
 * EOS SYSTEM — VECTOR LSM-TREE SEGMENT STORAGE TYPES (SPEC-316 / CHANGE-178).
 *
 * Defines contracts for in-memory MemTable, immutable SSTable segments,
 * double-hashing Bloom filters, sparse block indexes, and k-way compaction.
 */

export interface LsmVectorRecord {
  readonly id: string;
  readonly isTombstone: boolean;
  readonly vector?: Float32Array;
  readonly scale?: number;
  readonly zeroPoint?: number;
  readonly norm?: number;
  readonly timestamp: number;
  readonly sequence: number;
  readonly metadata?: Record<string, unknown>;
}

export interface LsmSparseIndexEntry {
  readonly firstKey: string;
  readonly lastKey: string;
  readonly blockIndex: number;
  readonly count: number;
}

export interface LsmBloomFilter {
  readonly bitSize: number;
  readonly hashCount: number;
  readonly bits: Uint8Array;
}

export interface LsmSSTableSegment {
  readonly segmentId: string;
  readonly level: number;
  readonly createdAtIso: string;
  readonly minKey: string;
  readonly maxKey: string;
  readonly totalRecords: number;
  readonly totalTombstones: number;
  readonly bloomFilter: LsmBloomFilter;
  readonly sparseIndex: LsmSparseIndexEntry[];
  readonly records: LsmVectorRecord[];
}

export interface VectorLsmConfig {
  readonly memTableCapacity: number;
  readonly blockSize: number;
  readonly bloomFilterBits: number;
  readonly maxL0Segments: number;
}

export interface VectorLsmStorageStats {
  readonly memTableSize: number;
  readonly l0SegmentCount: number;
  readonly l1SegmentCount: number;
  readonly totalLiveVectors: number;
  readonly totalTombstones: number;
  readonly latestSequence: number;
}

export interface VectorLsmStorageReceipt {
  readonly specRef: "SPEC-316";
  readonly engine: "Vector LSM-Tree Segment Storage Engine";
  readonly timestampIso: string;
  readonly totalLiveVectors: number;
  readonly l0Segments: number;
  readonly l1Segments: number;
  readonly bloomFilterAccuracy: number;
  readonly monotonicityVerified: boolean;
  readonly status: "VERIFIED" | "INVARIANT_BREACH";
  readonly sha256Signature: string;
}
