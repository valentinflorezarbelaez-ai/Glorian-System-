/**
 * Glorian System — WebAssembly SIMD 128-Bit (v128) Vectorized Compute & Arena Types
 * Governed by SPEC-310 / CHANGE-172 / ADR-172
 *
 * Strictly Zero Runtime Dependencies (Law V).
 */

export type SimdKernelLanguage = "ZIG" | "RUST";

export type SimdCompilerBackend = "ZIG_WASM32_SIMD128" | "RUSTC_WASM32_SIMD128" | "HERMETIC_W3C_SIMD128_SYNTHESIZER";

export interface SimdKernelCompileReport {
  readonly language: SimdKernelLanguage;
  readonly sourcePath: string;
  readonly compilerBackend: SimdCompilerBackend;
  readonly wasmByteLength: number;
  readonly wasmMagicValid: boolean;
  readonly simdOpcodesPresent: boolean;
  readonly sha256Digest: string;
  readonly durationMs: number;
}

export interface SimdVectorMaxJoinReport {
  readonly dimension: number;
  readonly simdLanesProcessed: number;
  readonly scalarTailProcessed: number;
  readonly mergedElements: readonly number[];
  readonly sumMerged: number;
  readonly arenaAlignedOffsetBytes: number;
  readonly durationNs: number;
}

export interface SimdDotProductReport {
  readonly dimension: number;
  readonly simdLanesProcessed: number;
  readonly dotProduct: number;
  readonly cosineSimilarity: number;
  readonly durationNs: number;
}

export interface ZeroCopyArenaFrameReport {
  readonly frameByteLength: number;
  readonly alignedOffsetBytes: number;
  readonly xorParityTagHex: string;
  readonly xorParityTagInt32: number;
  readonly freeSlotsRemaining: number;
  readonly utilizationRatio: number;
  readonly zeroHeapCopyVerified: boolean;
}

export interface ElasticFleetCapacityAssessment {
  readonly projectCount: number;
  readonly minProjects: number;
  readonly maxProjects: number;
  readonly withinBounds: boolean;
  readonly recommendedWorkerShards: number;
  readonly antiEntropyRoundsLog2: number;
  readonly vssThresholdGroupsRequired: number;
  readonly vercelHobbyAccountFits: boolean;
}

export interface Simd128BenchmarkReport {
  readonly dimension: number;
  readonly iterations: number;
  readonly simdTotalNs: number;
  readonly simdNsPerOp: number;
  readonly scalarTotalNs: number;
  readonly scalarNsPerOp: number;
  readonly deterministicMatch: boolean;
}

export interface WasmSimd128ArenaReceipt {
  readonly timestampIso: string;
  readonly specRef: "SPEC-310";
  readonly changeRef: "CHANGE-172";
  readonly status: "SIMD128_VECTOR_ARENA_VERIFIED";
  readonly zigSimdCompileReport: SimdKernelCompileReport;
  readonly rustSimdCompileReport: SimdKernelCompileReport;
  readonly maxJoinVerified: boolean;
  readonly dotProductVerified: boolean;
  readonly zeroCopyArenaVerified: boolean;
  readonly elasticFleetVerified: boolean;
  readonly benchmark: Simd128BenchmarkReport;
  readonly cryptographicSignature: string;
}
