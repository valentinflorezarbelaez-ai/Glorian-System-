/**
 * @file test/eosPipelineParallelism1F1B.test.mjs
 * @description BDD test suite for SPEC-322 / CHANGE-184: Pipeline Parallelism
 * Engine (1F1B Interleaved Activation Schedule & Micro-Batching).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosPipelineParallelism1F1BCore } from "../src/core/eosPipelineParallelism1F1B.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/PIPELINE_PARALLELISM_1F1B_RECEIPT.json");

describe("SPEC-322: Pipeline Parallelism Engine (1F1B Schedule)", () => {
  test("BDD-1707: Linear Pipeline Stage Topology & Neighbor Links", () => {
    const engine = new EosPipelineParallelism1F1BCore();
    const P = 4;
    const stages = engine.buildTopology(P);

    assert.equal(stages.length, P);

    // Stage 0 (first stage) has no predecessor
    assert.equal(stages[0].stageId, 0);
    assert.equal(stages[0].predecessorStageId, null);
    assert.equal(stages[0].successorStageId, 1);

    // Intermediate stages have both predecessor and successor
    for (let p = 1; p < P - 1; p++) {
      assert.equal(stages[p].stageId, p);
      assert.equal(stages[p].predecessorStageId, p - 1);
      assert.equal(stages[p].successorStageId, p + 1);
    }

    // Stage P - 1 (final stage) has no successor
    assert.equal(stages[P - 1].stageId, P - 1);
    assert.equal(stages[P - 1].predecessorStageId, P - 2);
    assert.equal(stages[P - 1].successorStageId, null);

    // Invalid stage count throws RangeError
    assert.throws(() => engine.buildTopology(1), RangeError);
    assert.throws(() => engine.buildTopology(0), RangeError);
  });

  test("BDD-1708: Warmup Forward Micro-Batch Scheduling (W_p = P - p - 1)", () => {
    const engine = new EosPipelineParallelism1F1BCore();
    const P = 4;

    // Verify warmup formula for 4 stages: [3, 2, 1, 0]
    assert.equal(engine.getWarmupCount(0, P), 3);
    assert.equal(engine.getWarmupCount(1, P), 2);
    assert.equal(engine.getWarmupCount(2, P), 1);
    assert.equal(engine.getWarmupCount(3, P), 0);

    // Verify for P = 6: [5, 4, 3, 2, 1, 0]
    assert.equal(engine.getWarmupCount(0, 6), 5);
    assert.equal(engine.getWarmupCount(5, 6), 0);

    // Invalid stage index throws RangeError
    assert.throws(() => engine.getWarmupCount(-1, P), RangeError);
    assert.throws(() => engine.getWarmupCount(4, P), RangeError);
  });

  test("BDD-1709: Steady-State 1F1B Interleaved Execution", () => {
    const engine = new EosPipelineParallelism1F1BCore();
    const P = 4;
    const M = 8;

    const { actions, result } = engine.run1F1BSchedule({
      numStages: P,
      numMicroBatches: M,
    });

    assert.equal(result.numStages, P);
    assert.equal(result.numMicroBatches, M);

    // Verify steady-state actions contain both FORWARD and BACKWARD
    const steadyActions = actions.filter((a) => a.phase === "STEADY_STATE_1F1B" && a.action !== "IDLE");
    assert.ok(steadyActions.length > 0);

    const fwdSteady = steadyActions.filter((a) => a.action === "FORWARD");
    const bwdSteady = steadyActions.filter((a) => a.action === "BACKWARD");
    assert.ok(fwdSteady.length > 0);
    assert.ok(bwdSteady.length > 0);

    // Every stage completes exactly M forward and M backward passes
    assert.equal(result.completedForwardCount, P * M);
    assert.equal(result.completedBackwardCount, P * M);
  });

  test("BDD-1710: Bounded Peak Activation Memory Invariant (<= P)", () => {
    const engine = new EosPipelineParallelism1F1BCore();

    // Test across diverse stage and micro-batch configurations
    const testCases = [
      { P: 2, M: 4 },
      { P: 3, M: 6 },
      { P: 4, M: 8 },
      { P: 4, M: 16 }, // Deep micro-batch stream
      { P: 6, M: 12 },
    ];

    for (const { P, M } of testCases) {
      const { actions, result } = engine.run1F1BSchedule({
        numStages: P,
        numMicroBatches: M,
      });

      assert.equal(result.activationMemoryBounded, true, `Memory must be bounded for P=${P}, M=${M}`);

      // Verify each stage's peak activation memory is strictly <= P
      for (let p = 0; p < P; p++) {
        const peak = result.peakActivationsPerStage[p];
        assert.ok(peak <= P, `Stage ${p} peak memory ${peak} exceeds stage count P=${P}`);
      }

      // Check invariant dynamically at every recorded action
      for (const action of actions) {
        assert.ok(
          action.stashedActivationsCount <= P,
          `In-flight activations at step ${action.step} exceeded P (${action.stashedActivationsCount} > ${P})`,
        );
      }
    }
  });

  test("BDD-1711: Cooldown Drainage & Zero Memory Leakage Invariant", () => {
    const engine = new EosPipelineParallelism1F1BCore();
    const P = 4;
    const M = 8;

    const { actions, result } = engine.run1F1BSchedule({
      numStages: P,
      numMicroBatches: M,
    });

    assert.equal(result.zeroLeakageVerified, true);

    // Verify the final action of each stage leaves 0 stashed activations
    for (let p = 0; p < P; p++) {
      const stageActions = actions.filter((a) => a.stageId === p);
      const lastAction = stageActions[stageActions.length - 1];
      assert.equal(lastAction.stashedActivationsCount, 0);
    }
  });

  test("BDD-1712: Bubble Fraction Calculation & Cryptographic Audit Receipt", () => {
    const engine = new EosPipelineParallelism1F1BCore();
    const P = 4;
    const M = 8;

    const receipt = engine.audit(P, M);

    assert.equal(receipt.auditStatus, "VERIFIED");
    assert.equal(receipt.numStages, P);
    assert.equal(receipt.numMicroBatches, M);
    assert.equal(receipt.peakMemoryBoundedCertified, true);
    assert.equal(receipt.zeroLeakageCertified, true);
    assert.equal(receipt.bubbleFractionOptimal, true);
    assert.ok(receipt.sha256Receipt.length === 64);

    // Save and verify receipt matches on disk
    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

    const diskContent = JSON.parse(fs.readFileSync(RECEIPT_PATH, "utf8"));
    assert.equal(diskContent.auditStatus, "VERIFIED");
    assert.equal(diskContent.sha256Receipt, receipt.sha256Receipt);
  });
});
