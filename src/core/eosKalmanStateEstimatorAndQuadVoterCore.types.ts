/**
 * SPEC-253 / CHANGE-126 — Type contracts for EosKalmanStateEstimatorAndQuadVoterCore.
 */

export type KalmanQuadVoterVerdict = "GNC_NOMINAL_LOCK" | "CHANNEL_ISOLATED_DEGRADED" | "GNC_QUORUM_LOST";

export interface QuadTelemetryFrameInput {
  readonly step?: number;
  readonly channels: readonly [number, number, number, number];
}

export interface KalmanQuadVoterOptions {
  readonly vehicleId?: string;
  readonly frames?: readonly QuadTelemetryFrameInput[];
  readonly dtSeconds?: number;
  readonly initialPosition?: number;
  readonly initialVelocity?: number;
  readonly processNoiseQ?: number;
  readonly measurementNoiseR?: number;
  readonly faultThreshold?: number;
}

export interface KalmanFrameEstimate {
  readonly step: number;
  readonly zFused: number;
  readonly medianReference: number;
  readonly healthyChannelCount: number;
  readonly isolatedChannelIndices: readonly number[];
  readonly quorumMaintained: boolean;
  readonly estimatedPosition: number;
  readonly estimatedVelocity: number;
  readonly innovation: number;
  readonly kalmanGainPosition: number;
  readonly nis: number;
  readonly covarianceTrace: number;
}

export interface KalmanQuadVoterReport {
  readonly vehicleId: string;
  readonly framesProcessed: number;
  readonly dtSeconds: number;
  readonly faultThreshold: number;
  readonly finalPosition: number;
  readonly finalVelocity: number;
  readonly finalCovarianceTrace: number;
  readonly totalChannelsIsolated: number;
  readonly quorumLostFramesCount: number;
  readonly covarianceMonotonicReduction: boolean;
  readonly frameEstimates: readonly KalmanFrameEstimate[];
  readonly verdict: KalmanQuadVoterVerdict;
  readonly kalmanDigestSha256: string;
}
