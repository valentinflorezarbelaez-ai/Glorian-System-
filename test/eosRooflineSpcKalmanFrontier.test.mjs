/**
 * SPEC-251..SPEC-253 / CHANGE-126 — BDD Verification Suite:
 * - EosComputeGraphRooflinePlannerCore (BDD-1276..BDD-1280)
 * - EosStatisticalProcessYieldControlCore (BDD-1281..BDD-1285)
 * - EosKalmanStateEstimatorAndQuadVoterCore (BDD-1286..BDD-1290)
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EosComputeGraphRooflinePlannerCore } from "../src/core/eosComputeGraphRooflinePlannerCore.ts";
import { EosStatisticalProcessYieldControlCore } from "../src/core/eosStatisticalProcessYieldControlCore.ts";
import { EosKalmanStateEstimatorAndQuadVoterCore } from "../src/core/eosKalmanStateEstimatorAndQuadVoterCore.ts";
import { dispatchPhase7VerificationCase } from "../src/mcp/tools/eosMcpPhase7VerificationHandlers.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function runCliJson(cmd) {
  const raw = execFileSync(process.execPath, [path.join(projectRoot, "bin", "eos.mjs"), cmd, "--json"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

test("SPEC-251..SPEC-253: Compute Roofline Planner, Six-Sigma SPC Yield & Kalman GNC Quad-Voter (BDD-1276..BDD-1290)", async (t) => {
  await t.test("BDD-1276: Roofline planner computes ridge point and classifies compute vs memory bound ops", () => {
    const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
    assert.equal(report.ridgePointFlopsPerByte, 156);
    assert.equal(report.verdict, "ROOFLINE_OPTIMIZED");
    const matmul = report.operatorProfiles.find((p) => p.id === "qkv_proj");
    const relu = report.operatorProfiles.find((p) => p.id === "qkv_relu");
    assert.equal(matmul?.boundRegime, "COMPUTE_BOUND");
    assert.equal(relu?.boundRegime, "MEMORY_BOUND");
    assert.ok(Object.isFrozen(report));
  });

  await t.test("BDD-1277: Fuses single-consumer MATMUL -> BIAS_ADD -> RELU and reduces DRAM traffic", () => {
    const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
    assert.equal(report.fusedGroups.length, 2);
    assert.equal(report.fusedGroups[0].pattern, "MATMUL->BIAS_ADD->RELU");
    assert.equal(report.fusedOperatorsCount, 5);
    assert.ok(report.memoryTrafficSavedBytes > 0);
  });

  await t.test("BDD-1278: Enforces 64-byte arena alignment and flags budget overflow", () => {
    const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({
      memoryBudgetBytes: 512,
      nodes: [
        {
          id: "n1",
          opKind: "MATMUL",
          flops: 1000,
          bytesRead: 100,
          bytesWritten: 100,
          outputBytes: 1000,
          dependencies: [],
        },
        {
          id: "n2",
          opKind: "RELU",
          flops: 100,
          bytesRead: 100,
          bytesWritten: 100,
          outputBytes: 1048,
          dependencies: ["n1"],
        },
      ],
    });
    assert.equal(report.verdict, "ARENA_BUDGET_EXCEEDED");
    assert.equal(report.fragmentationRatio, 0);
    for (const alloc of report.arenaAllocations) {
      assert.equal(alloc.offsetBytes % 64, 0);
    }
  });

  await t.test("BDD-1279: Rejects cyclic dependency graphs fail-closed and produces deterministic SHA-256", () => {
    assert.throws(
      () =>
        EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({
          nodes: [
            {
              id: "a",
              opKind: "MATMUL",
              flops: 10,
              bytesRead: 2,
              bytesWritten: 2,
              outputBytes: 64,
              dependencies: ["b"],
            },
            { id: "b", opKind: "RELU", flops: 10, bytesRead: 2, bytesWritten: 2, outputBytes: 64, dependencies: ["a"] },
          ],
        }),
      /Cyclic dependency/,
    );
    const r1 = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
    const r2 = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
    assert.equal(r1.rooflineDigestSha256, r2.rooflineDigestSha256);
    assert.match(r1.rooflineDigestSha256, /^[0-9a-f]{64}$/);
  });

  await t.test("BDD-1280: Dispatches roofline:plan CLI and MCP roofline_compute_plan", () => {
    const cli = runCliJson("roofline:plan");
    assert.equal(cli.verdict, "ROOFLINE_OPTIMIZED");
    assert.match(cli.rooflineDigestSha256, /^[0-9a-f]{64}$/);

    const parsed = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "roofline_compute_plan" },
      { projectRoot },
    );
    assert.equal(parsed.action, "roofline_compute_plan");
    assert.equal(parsed.verdict, "ROOFLINE_OPTIMIZED");
  });

  await t.test("BDD-1281: Centered nominal process achieves SIX_SIGMA_LOCKED and Cpk >= 1.33", () => {
    const report = EosStatisticalProcessYieldControlCore.auditProcessCapabilityAndYield();
    assert.equal(report.verdict, "SIX_SIGMA_LOCKED");
    assert.ok(report.cpk >= 1.33);
    assert.equal(report.outOfControlPointsCount, 0);
    assert.equal(report.cusumDriftDetected, false);
  });

  await t.test("BDD-1282: Tabular CUSUM detects sustained upward step drift inside spec limits", () => {
    const report = EosStatisticalProcessYieldControlCore.auditProcessCapabilityAndYield({
      samples: [99.9, 100.1, 100.0, 99.8, 100.2, 100.0, 101.8, 102.0, 102.1, 102.2, 102.3, 102.4],
      lsl: 94.0,
      usl: 106.0,
      target: 100.0,
    });
    assert.equal(report.outOfControlPointsCount, 0);
    assert.equal(report.cusumDriftDetected, true);
    assert.ok(report.maxCusumHigh > report.cusumThreshold);
    assert.equal(report.verdict, "SPC_DRIFT_WARNING");
  });

  await t.test("BDD-1283: Flags spec excursion with PROCESS_EXCURSION_HALT", () => {
    const report = EosStatisticalProcessYieldControlCore.auditProcessCapabilityAndYield({
      samples: [100, 100.1, 99.9, 100.2, 112.0],
      lsl: 94.0,
      usl: 106.0,
    });
    assert.ok(report.outOfControlPointsCount >= 1);
    assert.equal(report.verdict, "PROCESS_EXCURSION_HALT");
  });

  await t.test("BDD-1284: Enforces Murphy >= Poisson yield monotonicity and invalid interval rejection", () => {
    const report = EosStatisticalProcessYieldControlCore.auditProcessCapabilityAndYield({
      criticalAreaCm2: 2.0,
      defectDensityPerCm2: 0.15,
    });
    assert.ok(report.murphyYieldPercent >= report.poissonYieldPercent);
    assert.throws(
      () => EosStatisticalProcessYieldControlCore.auditProcessCapabilityAndYield({ lsl: 105, usl: 100 }),
      /strictly exceed/,
    );
    assert.throws(
      () => EosStatisticalProcessYieldControlCore.auditProcessCapabilityAndYield({ samples: [100] }),
      /at least 2/,
    );
  });

  await t.test("BDD-1285: Dispatches spc:audit CLI and MCP spc_yield_audit", () => {
    const cli = runCliJson("spc:audit");
    assert.equal(cli.verdict, "SIX_SIGMA_LOCKED");
    assert.match(cli.spcDigestSha256, /^[0-9a-f]{64}$/);

    const parsed = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "spc_yield_audit" },
      { projectRoot },
    );
    assert.equal(parsed.action, "spc_yield_audit");
    assert.equal(parsed.verdict, "SIX_SIGMA_LOCKED");
  });

  await t.test("BDD-1286: Kalman quad-voter achieves GNC_NOMINAL_LOCK with monotonic covariance reduction", () => {
    const report = EosKalmanStateEstimatorAndQuadVoterCore.estimateTrajectoryWithQuadVoter();
    assert.equal(report.verdict, "GNC_NOMINAL_LOCK");
    assert.equal(report.totalChannelsIsolated, 0);
    assert.equal(report.covarianceMonotonicReduction, true);
    assert.ok(report.finalPosition > 75 && report.finalPosition < 85);
  });

  await t.test("BDD-1287: Isolates single Byzantine channel spike while preserving 3-of-4 quorum", () => {
    const report = EosKalmanStateEstimatorAndQuadVoterCore.estimateTrajectoryWithQuadVoter({
      frames: [
        { step: 1, channels: [10.0, 10.1, 60.0, 9.9] },
        { step: 2, channels: [20.0, 19.9, 70.0, 20.1] },
        { step: 3, channels: [30.0, 30.2, 80.0, 29.8] },
      ],
    });
    assert.equal(report.verdict, "CHANNEL_ISOLATED_DEGRADED");
    assert.equal(report.quorumLostFramesCount, 0);
    assert.equal(report.totalChannelsIsolated, 3);
    assert.deepEqual(report.frameEstimates[0].isolatedChannelIndices, [2]);
    assert.ok(report.frameEstimates[0].zFused < 11);
  });

  await t.test("BDD-1288: Reports GNC_QUORUM_LOST when >= 2 channels deviate simultaneously", () => {
    const report = EosKalmanStateEstimatorAndQuadVoterCore.estimateTrajectoryWithQuadVoter({
      frames: [{ step: 1, channels: [10.0, 80.0, 10.2, -40.0] }],
    });
    assert.equal(report.quorumLostFramesCount, 1);
    assert.equal(report.verdict, "GNC_QUORUM_LOST");
  });

  await t.test("BDD-1289: Rejects malformed telemetry frames and produces repeatable digest", () => {
    assert.throws(
      () => EosKalmanStateEstimatorAndQuadVoterCore.estimateTrajectoryWithQuadVoter({ frames: [] }),
      /at least one/,
    );
    const a = EosKalmanStateEstimatorAndQuadVoterCore.estimateTrajectoryWithQuadVoter();
    const b = EosKalmanStateEstimatorAndQuadVoterCore.estimateTrajectoryWithQuadVoter();
    assert.equal(a.kalmanDigestSha256, b.kalmanDigestSha256);
    assert.match(a.kalmanDigestSha256, /^[0-9a-f]{64}$/);
  });

  await t.test("BDD-1290: Dispatches kalman:estimate CLI and MCP kalman_quad_vote", () => {
    const cli = runCliJson("kalman:estimate");
    assert.equal(cli.verdict, "GNC_NOMINAL_LOCK");
    assert.match(cli.kalmanDigestSha256, /^[0-9a-f]{64}$/);

    const parsed = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "kalman_quad_vote" },
      { projectRoot },
    );
    assert.equal(parsed.action, "kalman_quad_vote");
    assert.equal(parsed.verdict, "GNC_NOMINAL_LOCK");
  });
});
