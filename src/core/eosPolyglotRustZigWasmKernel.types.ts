/**
 * Glorian System — Polyglot Rust & Zig Native WebAssembly Linear-Memory Kernel Types
 * Governed by SPEC-309 / CHANGE-171 / ADR-171
 *
 * Strict Zero Runtime Dependencies (Law V).
 */

export type PolyglotSourceLanguage = "RUST" | "ZIG";

export type PolyglotCompilerUsed = "RUSTC_WASM32" | "ZIG_WASM32" | "HERMETIC_W3C_SYNTHESIZER";

export interface PolyglotWasmCompileReport {
  readonly language: PolyglotSourceLanguage;
  readonly sourcePath: string;
  readonly compilerUsed: PolyglotCompilerUsed;
  readonly wasmByteLength: number;
  readonly wasmMagicValid: boolean;
  readonly sha256Digest: string;
  readonly durationMs: number;
}

export interface PolyglotVectorJoinExecutionReport {
  readonly dimension: number;
  readonly mergedElements: readonly number[];
  readonly sumMerged: number;
  readonly executionEngine: "WASM_LINEAR_MEMORY";
  readonly durationNs: number;
  readonly memoryBytesUsed: number;
}

export interface PolyglotFnv1aHashReport {
  readonly inputByteLength: number;
  readonly hashHex: string;
  readonly hashUint32: number;
  readonly durationNs: number;
}

export interface PolyglotRingBufferCheckReport {
  readonly freeSlots: number;
  readonly utilizationRatio: number;
  readonly backpressureActive: boolean;
}

export interface PolyglotBenchmarkReport {
  readonly iterations: number;
  readonly vectorDimension: number;
  readonly wasmTotalNs: number;
  readonly wasmNsPerOp: number;
  readonly jsTotalNs: number;
  readonly jsNsPerOp: number;
  readonly deterministicMatch: boolean;
}

export interface PolyglotRustZigWasmReceipt {
  readonly timestampIso: string;
  readonly specRef: "SPEC-309";
  readonly changeRef: "CHANGE-171";
  readonly status: "POLYGLOT_WASM_VERIFIED";
  readonly rustCompileReport: PolyglotWasmCompileReport;
  readonly zigCompileReport: PolyglotWasmCompileReport;
  readonly vectorJoinVerified: boolean;
  readonly fnv1aVerified: boolean;
  readonly ringBufferVerified: boolean;
  readonly benchmark: PolyglotBenchmarkReport;
  readonly cryptographicSignature: string;
}
