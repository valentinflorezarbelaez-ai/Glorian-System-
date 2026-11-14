/**
 * SPEC-253 / CHANGE-126 — Layer-0 Linear Kinematic Kalman Estimator & 4-Channel QMR Fault-Isolation Voter.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  KalmanFrameEstimate,
  KalmanQuadVoterOptions,
  KalmanQuadVoterReport,
  KalmanQuadVoterVerdict,
  QuadTelemetryFrameInput,
} from "./eosKalmanStateEstimatorAndQuadVoterCore.types.ts";

const DEFAULT_QUAD_FRAMES: readonly QuadTelemetryFrameInput[] = [
  { step: 1, channels: [10.02, 9.98, 10.01, 9.99] },
  { step: 2, channels: [20.04, 19.97, 20.02, 19.99] },
  { step: 3, channels: [30.01, 29.99, 30.03, 29.98] },
  { step: 4, channels: [40.02, 39.96, 40.01, 40.0] },
  { step: 5, channels: [50.03, 49.98, 50.02, 49.99] },
  { step: 6, channels: [60.01, 59.99, 60.04, 59.97] },
  { step: 7, channels: [70.02, 69.98, 70.0, 70.01] },
  { step: 8, channels: [80.03, 79.97, 80.01, 79.99] },
];

function validateKalmanInputs(
  frames: readonly QuadTelemetryFrameInput[],
  dtSeconds: number,
  processNoiseQ: number,
  measurementNoiseR: number,
  faultThreshold: number,
): void {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error("Kalman QMR estimator requires at least one 4-channel telemetry frame.");
  }
  if (!(dtSeconds > 0) || processNoiseQ < 0 || !(measurementNoiseR > 0) || !(faultThreshold > 0)) {
    throw new Error("dtSeconds, measurementNoiseR, and faultThreshold must be > 0; processNoiseQ >= 0.");
  }
  for (let i = 0; i < frames.length; i += 1) {
    const ch = frames[i]?.channels;
    if (!Array.isArray(ch) || ch.length !== 4 || ch.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
      throw new Error(`Telemetry frame ${i} must contain exactly 4 finite numeric channels.`);
    }
  }
}

function voteQuadChannels(
  channels: readonly [number, number, number, number],
  faultThreshold: number,
): {
  readonly medianReference: number;
  readonly zFused: number;
  readonly healthyChannelCount: number;
  readonly isolatedChannelIndices: readonly number[];
  readonly quorumMaintained: boolean;
} {
  const sorted = [...channels].sort((a, b) => a - b);
  const medianReference = (sorted[1] + sorted[2]) / 2;
  const healthy: number[] = [];
  const isolatedChannelIndices: number[] = [];

  for (let idx = 0; idx < 4; idx += 1) {
    if (Math.abs(channels[idx] - medianReference) > faultThreshold) {
      isolatedChannelIndices.push(idx);
    } else {
      healthy.push(channels[idx]);
    }
  }

  const zFused = healthy.length > 0 ? healthy.reduce((acc, v) => acc + v, 0) / healthy.length : medianReference;

  return {
    medianReference,
    zFused,
    healthyChannelCount: healthy.length,
    isolatedChannelIndices,
    quorumMaintained: healthy.length >= 3,
  };
}

export class EosKalmanStateEstimatorAndQuadVoterCore {
  static estimateTrajectoryWithQuadVoter(options: KalmanQuadVoterOptions = {}): KalmanQuadVoterReport {
    const vehicleId = options.vehicleId?.trim() || "STARSHIP-GNC-QUAD-01";
    const frames = options.frames ?? DEFAULT_QUAD_FRAMES;
    const dtSeconds = options.dtSeconds ?? 1.0;
    const processNoiseQ = options.processNoiseQ ?? 0.05;
    const measurementNoiseR = options.measurementNoiseR ?? 0.25;
    const faultThreshold = options.faultThreshold ?? 3.5;

    validateKalmanInputs(frames, dtSeconds, processNoiseQ, measurementNoiseR, faultThreshold);

    let xPos = options.initialPosition ?? 0;
    let xVel = options.initialVelocity ?? 10;
    let p00 = 4.0;
    let p01 = 0.0;
    let p10 = 0.0;
    let p11 = 4.0;
    const qDiag = processNoiseQ * 0.1;

    const frameEstimates: KalmanFrameEstimate[] = [];
    let totalChannelsIsolated = 0;
    let quorumLostFramesCount = 0;
    let prevTrace = p00 + p11;
    let covarianceMonotonicReduction = true;

    for (let i = 0; i < frames.length; i += 1) {
      const vote = voteQuadChannels(frames[i].channels, faultThreshold);
      totalChannelsIsolated += vote.isolatedChannelIndices.length;
      if (!vote.quorumMaintained) quorumLostFramesCount += 1;

      // Predict step (F = [[1, dt], [0, 1]])
      const predPos = xPos + dtSeconds * xVel;
      const predVel = xVel;
      const pp00 = p00 + dtSeconds * (p10 + p01) + dtSeconds * dtSeconds * p11 + qDiag;
      const pp01 = p01 + dtSeconds * p11;
      const pp10 = p10 + dtSeconds * p11;
      const pp11 = p11 + qDiag;

      // Update step (H = [1, 0])
      const innovation = vote.zFused - predPos;
      const sCov = pp00 + measurementNoiseR;
      const k0 = pp00 / sCov;
      const k1 = pp10 / sCov;
      const nis = (innovation * innovation) / sCov;

      xPos = predPos + k0 * innovation;
      xVel = predVel + k1 * innovation;
      p00 = (1 - k0) * pp00;
      p01 = (1 - k0) * pp01;
      p10 = pp10 - k1 * pp00;
      p11 = pp11 - k1 * pp01;

      const covarianceTrace = p00 + p11;
      if (covarianceTrace > prevTrace + 1e-9) {
        covarianceMonotonicReduction = false;
      }
      prevTrace = covarianceTrace;

      frameEstimates.push({
        step: frames[i].step ?? i + 1,
        zFused: Number(vote.zFused.toFixed(4)),
        medianReference: Number(vote.medianReference.toFixed(4)),
        healthyChannelCount: vote.healthyChannelCount,
        isolatedChannelIndices: vote.isolatedChannelIndices,
        quorumMaintained: vote.quorumMaintained,
        estimatedPosition: Number(xPos.toFixed(4)),
        estimatedVelocity: Number(xVel.toFixed(4)),
        innovation: Number(innovation.toFixed(4)),
        kalmanGainPosition: Number(k0.toFixed(4)),
        nis: Number(nis.toFixed(4)),
        covarianceTrace: Number(covarianceTrace.toFixed(4)),
      });
    }

    const verdict: KalmanQuadVoterVerdict =
      quorumLostFramesCount > 0
        ? "GNC_QUORUM_LOST"
        : totalChannelsIsolated > 0
          ? "CHANNEL_ISOLATED_DEGRADED"
          : "GNC_NOMINAL_LOCK";

    const digestPayload = {
      vehicleId,
      framesProcessed: frames.length,
      finalPosition: Number(xPos.toFixed(4)),
      finalVelocity: Number(xVel.toFixed(4)),
      totalChannelsIsolated,
      quorumLostFramesCount,
      verdict,
    };

    return deepFreeze({
      vehicleId,
      framesProcessed: frames.length,
      dtSeconds,
      faultThreshold,
      finalPosition: Number(xPos.toFixed(4)),
      finalVelocity: Number(xVel.toFixed(4)),
      finalCovarianceTrace: Number(prevTrace.toFixed(4)),
      totalChannelsIsolated,
      quorumLostFramesCount,
      covarianceMonotonicReduction,
      frameEstimates,
      verdict,
      kalmanDigestSha256: pureSha256(JSON.stringify(digestPayload)),
    });
  }
}
