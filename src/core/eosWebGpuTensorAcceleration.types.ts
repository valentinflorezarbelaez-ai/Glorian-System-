/**
 * EOS WebGPU WGSL Compute & SIMD Tensor Acceleration Engine — Type Definitions
 *
 * SPEC-354 / CHANGE-216: Autonomous WebGPU WGSL Compute & SIMD Tensor Acceleration Engine.
 * Provides formal type definitions for W3C standard WGSL compute shader descriptors,
 * tensor buffers, workgroup configurations, and verification audit receipts.
 *
 * @module eosWebGpuTensorAcceleration.types
 */

/**
 * Primitive data type supported by the tensor compute engine.
 */
export type TensorDType = "f32" | "i32" | "u32";

/**
 * Dimensions of a multidimensional tensor (e.g. [M, N] for 2D matrix).
 */
export type TensorShape = readonly number[];

/**
 * Dense contiguous or strided tensor buffer residing in typed arrays.
 */
export interface TensorBuffer {
  readonly shape: TensorShape;
  readonly dtype: TensorDType;
  readonly data: Float32Array | Int32Array | Uint32Array;
  readonly stride: readonly number[];
}

/**
 * 3D dimensions of a WebGPU compute shader workgroup invocation grid.
 */
export interface WgslWorkgroupSize {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Buffer binding definition within a WebGPU bind group.
 */
export interface WgslBufferBinding {
  readonly group: number;
  readonly binding: number;
  readonly bufferType: "read-only-storage" | "storage" | "uniform";
}

/**
 * Structural descriptor of a synthesized WGSL compute shader.
 */
export interface WgslShaderDescriptor {
  readonly id: string;
  readonly entryPoint: string;
  readonly code: string;
  readonly workgroupSize: WgslWorkgroupSize;
  readonly bindings: readonly WgslBufferBinding[];
  readonly sha256: string;
}

/**
 * Supported activation functions for SIMD 4-lane vector vectorization.
 */
export type ActivationKind = "relu" | "gelu" | "sigmoid" | "tanh";

/**
 * High-level algebraic tensor operations supported by the engine.
 */
export type TensorOpType = "gemm" | "activation" | "covariance" | "softmax";

/**
 * Configuration for a tensor compute pipeline instantiation.
 */
export interface ComputePipelineConfig {
  readonly pipelineId: string;
  readonly shader: WgslShaderDescriptor;
  readonly tileDimension: number;
  readonly vectorWidth: 1 | 4;
}

/**
 * Execution telemetry result emitted by tensor kernels.
 */
export interface TensorOpResult {
  readonly op: TensorOpType;
  readonly shape: TensorShape;
  readonly data: Float32Array;
  readonly executionMode: "webgpu" | "emulator";
  readonly durationMicroseconds: number;
  readonly flopCount: number;
  readonly gflops: number;
  readonly checksumSha256: string;
}

/**
 * Hardware and runtime execution capability of the WebGPU adapter.
 */
export interface WebGpuAdapterCapability {
  readonly available: boolean;
  readonly backend: "webgpu" | "webgl2" | "layer0-software";
  readonly maxBufferSize: number;
  readonly maxComputeWorkgroupStorageSize: number;
  readonly maxComputeInvocationsPerWorkgroup: number;
  readonly vendor?: string;
  readonly architecture?: string;
}

/**
 * Individual benchmark trial comparing WGSL specification with software emulator.
 */
export interface TensorBenchmarkTrial {
  readonly op: TensorOpType;
  readonly shape: TensorShape;
  readonly emulatorTimeUs: number;
  readonly emulatorGflops: number;
  readonly checksumMatch: boolean;
  readonly maxRelativeDelta: number;
}

/**
 * Formal verification receipt emitted by EosWebGpuTensorEngineCore.
 */
export interface WebGpuAuditReceipt {
  readonly specId: "SPEC-354";
  readonly changeId: "CHANGE-216";
  readonly timestamp: string;
  readonly environment: {
    readonly nodeVersion: string;
    readonly platform: string;
    readonly isHeadless: boolean;
  };
  readonly adapter: WebGpuAdapterCapability;
  readonly benchmarks: readonly TensorBenchmarkTrial[];
  readonly shadersSynthesized: readonly {
    readonly id: string;
    readonly entryPoint: string;
    readonly lines: number;
    readonly sha256: string;
  }[];
  readonly verdict: "CONFORMANT" | "DEVIATION_DETECTED";
  readonly epistemicState: "PRODUCTION_READY_WITHIN_TESTED_SCOPE";
}
