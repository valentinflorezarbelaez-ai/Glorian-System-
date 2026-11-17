/**
 * EOS SYSTEM — SIMD QUANTIZED VECTOR EMBEDDING ENGINE TYPES (SPEC-314 / CHANGE-176).
 *
 * Defines mathematical, structural, and cryptographic data contracts for 8-bit
 * asymmetric scalar quantization, 16-lane SIMD dot product acceleration, and
 * multi-layer HNSW graph indexing. Zero external dependencies.
 */

export interface SimdQuantizedVector {
  readonly id: string;
  readonly dimension: number;
  readonly scale: number;
  readonly zeroPoint: number;
  readonly payload: Int8Array;
  readonly norm: number;
  readonly sum: number;
  readonly metadata?: Record<string, unknown>;
}

export interface SimdQuantizedHnswConfig {
  readonly dimension: number;
  readonly M: number;
  readonly efConstruction: number;
  readonly efSearch: number;
  readonly maxLevels?: number;
  readonly mL?: number;
}

export interface SimdHnswNode {
  readonly id: string;
  readonly level: number;
  readonly vector: SimdQuantizedVector;
  readonly friends: Map<number, string[]>;
}

export interface SimdHnswSearchResult {
  readonly id: string;
  readonly distance: number;
  readonly level: number;
  readonly metadata?: Record<string, unknown>;
}

export interface SimdQuantizedSearchQuery {
  readonly query: number[] | Float32Array | SimdQuantizedVector;
  readonly k: number;
  readonly efSearch?: number;
}

export interface SimdQuantizedHnswAuditReceipt {
  readonly specRef: "SPEC-314";
  readonly engine: "SIMD Quantized HNSW Vector Index";
  readonly timestampIso: string;
  readonly totalNodes: number;
  readonly maxActiveLevel: number;
  readonly entryPointId: string | null;
  readonly quantizationErrorMean: number;
  readonly alignmentChecked16Bytes: boolean;
  readonly monotonicityVerified: boolean;
  readonly degreeBoundsVerified: boolean;
  readonly status: "VERIFIED" | "INVARIANT_BREACH";
  readonly sha256Signature: string;
}

export interface SimdQuantizedHnswStats {
  readonly totalNodes: number;
  readonly maxLevel: number;
  readonly entryPoint: string | null;
  readonly dimension: number;
  readonly memoryBytesEstimate: number;
}
