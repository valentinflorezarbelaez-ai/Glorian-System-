/**
 * EOS Layer-0 Quantized GGUF/Q4_K Integer Tensor Inference Core Types (SPEC-224)
 * Strict Zero Runtime Dependencies (EOS Law I & V), Node 24 Strip-Only TypeScript.
 */

export type GgmlType = "F32" | "F16" | "Q4_0" | "Q8_0" | "Q4_K";

export interface GgufTensorDescriptor {
  readonly name: string;
  readonly dimensions: readonly number[];
  readonly ggmlType: GgmlType;
  readonly offsetBytes: number;
  readonly sizeBytes: number;
}

export interface QuantizedTensor {
  readonly name: string;
  readonly shape: readonly number[];
  readonly ggmlType: GgmlType;
  readonly rawData: Uint8Array;
  readonly tensorSha256: string;
}

export interface GgufContainer {
  readonly version: number;
  readonly tensorCount: number;
  readonly metadata: Readonly<Record<string, string>>;
  readonly tensors: readonly QuantizedTensor[];
  readonly containerSha256: string;
}

export interface MatMulResult {
  readonly output: Float32Array;
  readonly rows: number;
  readonly cols: number;
  readonly durationMs: number;
  readonly gigaFlops: number;
  readonly receipt: TensorReceipt;
}

export interface EmbeddingResult {
  readonly text: string;
  readonly embedding: Float32Array;
  readonly dimensions: number;
  readonly norm: number;
  readonly durationMs: number;
  readonly receipt: TensorReceipt;
}

export type TensorOperationType = "quantize" | "dequantize" | "matmul" | "embed" | "benchmark";

export interface TensorReceipt {
  readonly receiptId: string;
  readonly operation: TensorOperationType;
  readonly timestamp: string;
  readonly digest: string;
  readonly receiptSha256: string;
}

export interface TensorBenchmarkResult {
  readonly matmulThroughputGFlops: number;
  readonly q4_0QuantizeOpsPerSec: number;
  readonly q4_0DequantizeOpsPerSec: number;
  readonly q8_0QuantizeOpsPerSec: number;
  readonly q4_kQuantizeOpsPerSec: number;
  readonly averageMatMulTimeMs: number;
  readonly receipt: TensorReceipt;
}
