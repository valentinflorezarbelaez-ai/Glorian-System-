/**
 * Glorian System — FP8 / INT8 Quantized Distributed Training & Mixed-Precision Gradient Scaling Engine Types
 * Governed by SPEC-328 / CHANGE-190 / ADR-190-001..003
 *
 * Invariant: Pure Layer-0 TypeScript. Zero external runtime dependencies.
 */

export type FP8Format = "E4M3" | "E5M2";
export type QuantFormat = "E4M3" | "E5M2" | "INT8";

export interface FP8EncodedTensor {
  readonly data: Uint8Array;
  readonly format: FP8Format;
  readonly scale: number;
  readonly shape: readonly number[];
  readonly length: number;
}

export interface INT8EncodedTensor {
  readonly data: Int8Array;
  readonly scale: number;
  readonly shape: readonly number[];
  readonly length: number;
}

export interface DelayedScalingState {
  readonly historyWindow: readonly number[];
  readonly windowSize: number;
  readonly currentScale: number;
  readonly projectedScale: number;
  readonly aMax: number;
  readonly isSaturated: boolean;
}

export interface DynamicLossScaleState {
  readonly lossScale: number;
  readonly consecutiveCleanSteps: number;
  readonly cleanStepThreshold: number;
  readonly maxLossScale: number;
  readonly minLossScale: number;
  readonly lastStepSkipped: boolean;
}

export interface MixedPrecisionBackwardResult {
  readonly unscaledGradients: Float32Array;
  readonly stepAccepted: boolean;
  readonly nextLossScaleState: DynamicLossScaleState;
  readonly hasNonFinite: boolean;
}

export interface QuantizedAllReduceResult {
  readonly reducedGradients: Float32Array;
  readonly bytesTransferred: number;
  readonly baselineFp32Bytes: number;
  readonly baselineFp16Bytes: number;
  readonly bandwidthSavingsVsFp32Percent: number;
  readonly bandwidthSavingsVsFp16Percent: number;
  readonly numWorkers: number;
  readonly maxReconstructionError: number;
  readonly snrDb: number;
}

export interface QuantizedAuditReceipt {
  readonly specRef: "SPEC-328";
  readonly engine: "FP8 / INT8 Quantized Distributed Training & Mixed-Precision Gradient Scaling Engine";
  readonly timestampIso: string;
  readonly tensorDimension: number;
  readonly numWorkers: number;
  readonly e4m3Verified: boolean;
  readonly e5m2Verified: boolean;
  readonly int8Verified: boolean;
  readonly delayedScalingVerified: boolean;
  readonly lossScalingVerified: boolean;
  readonly bandwidthReductionVsFp32Percent: number;
  readonly bandwidthReductionVsFp16Percent: number;
  readonly reconstructionSnrDb: number;
  readonly gradientMaxAbsoluteError: number;
  readonly zeroNanGradients: boolean;
  readonly status: "QUANTIZED_DISTRIBUTED_TRAINING_VERIFIED";
  readonly sha256Signature: string;
}
