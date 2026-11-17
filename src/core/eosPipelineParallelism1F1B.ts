/**
 * @file eosPipelineParallelism1F1B.ts
 * @description Sovereign Pipeline Parallelism Engine implementing 1F1B
 * (One Forward, One Backward) interleaved activation scheduling, micro-batching,
 * activation stashing, and bubble fraction telemetry.
 * Conforms to SPEC-322 / CHANGE-184.
 */

import { createHash } from "node:crypto";
import type {
  PipelineStageConfig,
  PipelineScheduleConfig,
  StepScheduleAction,
  PipelineExecutionResult,
  PipelineAuditReceipt,
  PipelinePhase,
} from "./eosPipelineParallelism1F1B.types.js";

export class EosPipelineParallelism1F1BCore {
  /**
   * Constructs linear pipeline stage topology with point-to-point (P2P) links.
   *
   * @param numStages Total pipeline stages P (P >= 2).
   */
  public buildTopology(numStages: number = 4): PipelineStageConfig[] {
    if (!Number.isInteger(numStages) || numStages < 2) {
      throw new RangeError(`Pipeline stage count P must be an integer >= 2, received ${numStages}`);
    }

    const stages: PipelineStageConfig[] = [];
    const dimension = 4;

    for (let p = 0; p < numStages; p++) {
      // Deterministic orthogonal/identity weights for each stage
      const weights: number[][] = Array.from({ length: dimension }, (_, i) =>
        Array.from({ length: dimension }, (_, j) => (i === j ? 1.0 + p * 0.1 : 0.0)),
      );

      stages.push({
        stageId: p,
        numStages,
        predecessorStageId: p === 0 ? null : p - 1,
        successorStageId: p === numStages - 1 ? null : p + 1,
        weights,
      });
    }

    return stages;
  }

  /**
   * Computes the number of warmup forward passes required on stage p.
   * Formula: W_p = P - p - 1.
   *
   * @param stageId Current stage index p (0 <= p < numStages).
   * @param numStages Total pipeline stages P.
   */
  public getWarmupCount(stageId: number, numStages: number = 4): number {
    if (!Number.isInteger(stageId) || stageId < 0 || stageId >= numStages) {
      throw new RangeError(`Invalid stageId ${stageId} for numStages ${numStages}`);
    }
    return Math.max(0, numStages - stageId - 1);
  }

  /**
   * Executes discrete 1F1B pipeline schedule across P stages and M micro-batches.
   *
   * @param config Optional configuration for stages, micro-batches, and dimensions.
   */
  public run1F1BSchedule(config?: PipelineScheduleConfig): {
    actions: StepScheduleAction[];
    result: PipelineExecutionResult;
  } {
    const startTime = performance.now();
    const P = config?.numStages ?? 4;
    const M = config?.numMicroBatches ?? 8;

    if (!Number.isInteger(P) || P < 2) {
      throw new RangeError(`Number of stages P must be an integer >= 2, got ${P}`);
    }
    if (!Number.isInteger(M) || M < P) {
      throw new RangeError(`Number of micro-batches M must be >= P (${P}), got ${M}`);
    }

    const actions: StepScheduleAction[] = [];
    const fwdCount: number[] = new Array(P).fill(0);
    const bwdCount: number[] = new Array(P).fill(0);
    const stashed: Set<number>[] = Array.from({ length: P }, () => new Set<number>());
    const peakActivationsPerStage: Record<number, number> = {};
    for (let p = 0; p < P; p++) {
      peakActivationsPerStage[p] = 0;
    }

    let step = 0;
    const maxSteps = 4 * (M + P) * P; // Safety bound against deadlock

    while (step < maxSteps) {
      // Check termination: all stages completed M backward passes
      const allDone = bwdCount.every((count) => count === M);
      if (allDone) {
        break;
      }

      // In each discrete cycle, determine the action for every stage
      const stepDecisions: {
        stageId: number;
        action: "FORWARD" | "BACKWARD" | "IDLE";
        microBatchId: number | null;
        phase: PipelinePhase;
      }[] = [];

      for (let p = 0; p < P; p++) {
        const warmupCount = this.getWarmupCount(p, P);
        let phase: PipelinePhase;
        if (fwdCount[p] < warmupCount) {
          phase = "WARMUP";
        } else if (fwdCount[p] < M) {
          phase = "STEADY_STATE_1F1B";
        } else if (bwdCount[p] < M) {
          phase = "COOLDOWN";
        } else {
          phase = "DONE";
        }

        if (phase === "DONE") {
          stepDecisions.push({
            stageId: p,
            action: "IDLE",
            microBatchId: null,
            phase,
          });
          continue;
        }

        // Backward readiness on stage p for micro-batch m = bwdCount[p]
        const mBwd = bwdCount[p];
        const canBackward =
          mBwd < M && fwdCount[p] > mBwd && stashed[p].has(mBwd) && (p === P - 1 || bwdCount[p + 1] > mBwd);

        // Forward readiness on stage p for micro-batch m = fwdCount[p]
        const mFwd = fwdCount[p];
        const canForward = mFwd < M && stashed[p].size < P && (p === 0 || fwdCount[p - 1] > mFwd);

        if (phase === "WARMUP") {
          // In warmup, strictly execute forward
          if (canForward) {
            stepDecisions.push({
              stageId: p,
              action: "FORWARD",
              microBatchId: mFwd,
              phase,
            });
          } else {
            stepDecisions.push({
              stageId: p,
              action: "IDLE",
              microBatchId: null,
              phase,
            });
          }
        } else if (phase === "STEADY_STATE_1F1B") {
          // 1F1B Interleave: prioritize backward to release activation memory first
          if (canBackward) {
            stepDecisions.push({
              stageId: p,
              action: "BACKWARD",
              microBatchId: mBwd,
              phase,
            });
          } else if (canForward) {
            stepDecisions.push({
              stageId: p,
              action: "FORWARD",
              microBatchId: mFwd,
              phase,
            });
          } else {
            stepDecisions.push({
              stageId: p,
              action: "IDLE",
              microBatchId: null,
              phase,
            });
          }
        } else {
          // COOLDOWN: all forward completed, strictly execute backward
          if (canBackward) {
            stepDecisions.push({
              stageId: p,
              action: "BACKWARD",
              microBatchId: mBwd,
              phase,
            });
          } else {
            stepDecisions.push({
              stageId: p,
              action: "IDLE",
              microBatchId: null,
              phase,
            });
          }
        }
      }

      // Apply step decisions
      for (const dec of stepDecisions) {
        const p = dec.stageId;
        if (dec.action === "FORWARD") {
          const mbId = dec.microBatchId!;
          stashed[p].add(mbId);
          fwdCount[p] += 1;
          if (stashed[p].size > peakActivationsPerStage[p]) {
            peakActivationsPerStage[p] = stashed[p].size;
          }
        } else if (dec.action === "BACKWARD") {
          const mbId = dec.microBatchId!;
          stashed[p].delete(mbId);
          bwdCount[p] += 1;
        }

        actions.push({
          step,
          stageId: p,
          action: dec.action,
          microBatchId: dec.microBatchId,
          phase: dec.phase,
          stashedActivationsCount: stashed[p].size,
        });
      }

      step += 1;
    }

    const elapsedMs = performance.now() - startTime;
    const totalScheduleSteps = step;
    const totalSlots = totalScheduleSteps * P;
    const bubbleSteps = actions.filter((a) => a.action === "IDLE").length;
    const bubbleFraction = totalSlots > 0 ? bubbleSteps / totalSlots : 0;
    const theoreticalBubbleFraction = (P - 1) / (M + P - 1);

    const activationMemoryBounded = Object.values(peakActivationsPerStage).every((peak) => peak <= P);
    const zeroLeakageVerified = stashed.every((s) => s.size === 0);
    const completedForwardCount = fwdCount.reduce((acc, c) => acc + c, 0);
    const completedBackwardCount = bwdCount.reduce((acc, c) => acc + c, 0);

    const result: PipelineExecutionResult = {
      numStages: P,
      numMicroBatches: M,
      totalScheduleSteps,
      bubbleSteps,
      bubbleFraction,
      theoreticalBubbleFraction,
      peakActivationsPerStage,
      activationMemoryBounded,
      zeroLeakageVerified,
      completedForwardCount,
      completedBackwardCount,
      elapsedMs,
    };

    return { actions, result };
  }

  /**
   * Audits the 1F1B schedule and returns a verifiable cryptographic audit receipt.
   *
   * @param numStages Number of stages P (default: 4).
   * @param numMicroBatches Number of micro-batches M (default: 8).
   */
  public audit(numStages: number = 4, numMicroBatches: number = 8): PipelineAuditReceipt {
    const { result } = this.run1F1BSchedule({
      numStages,
      numMicroBatches,
    });

    const maxStashed = Math.max(...Object.values(result.peakActivationsPerStage));
    const peakMemoryBoundedCertified = result.activationMemoryBounded && maxStashed <= numStages;
    const zeroLeakageCertified = result.zeroLeakageVerified;

    // Bubble fraction should be close to theoretical bound
    const bubbleFractionOptimal = result.bubbleFraction <= result.theoreticalBubbleFraction * 1.5;

    const auditStatus = peakMemoryBoundedCertified && zeroLeakageCertified ? "VERIFIED" : "FAILED";

    const timestampIso = new Date().toISOString();
    const digestPayload = JSON.stringify({
      specRef: "SPEC-322",
      changeRef: "CHANGE-184",
      numStages,
      numMicroBatches,
      maxStashed,
      peakMemoryBoundedCertified,
      zeroLeakageCertified,
      bubbleFraction: result.bubbleFraction,
      timestampIso,
    });

    const sha256Receipt = createHash("sha256").update(digestPayload).digest("hex");

    return {
      schemaVersion: "1.0.0",
      specRef: "SPEC-322",
      changeRef: "CHANGE-184",
      auditStatus,
      numStages,
      numMicroBatches,
      maxStashedActivations: maxStashed,
      peakMemoryBoundedCertified,
      zeroLeakageCertified,
      bubbleFractionOptimal,
      sha256Receipt,
      timestampIso,
    };
  }
}
