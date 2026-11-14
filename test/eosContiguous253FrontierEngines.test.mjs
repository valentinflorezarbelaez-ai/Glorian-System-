/**
 * SPEC-101..SPEC-105 / CHANGE-127 — BDD Verification Suite (Contiguous 253 Frontier):
 * - SPEC-101: EosSurfaceCodeQuantumErrorCorrectionCore (BDD-1291..BDD-1295)
 * - SPEC-102: EosLeoConstellationOpticalRoutingCore (BDD-1296..BDD-1300)
 * - SPEC-103: EosPowerGridOptimalPowerFlowCore (BDD-1301..BDD-1305)
 * - SPEC-104: EosBioSequenceFoldingConfidenceCore (BDD-1306..BDD-1310)
 * - SPEC-105: EosInertialFusionLawsonIgnitionCore (BDD-1311..BDD-1315)
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  EosBioSequenceFoldingConfidenceCore,
  EosInertialFusionLawsonIgnitionCore,
  EosLeoConstellationOpticalRoutingCore,
  EosPowerGridOptimalPowerFlowCore,
  EosSurfaceCodeQuantumErrorCorrectionCore,
} from "../src/core/index.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function runCliJson(cmd, extraArgs = []) {
  const raw = execFileSync(process.execPath, [path.join(projectRoot, "bin", "eos.mjs"), cmd, ...extraArgs, "--json"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

async function callWorkspaceMcp(action) {
  const server = new EosMcpServer(projectRoot, "full");
  const response = await server.handleRequest({
    jsonrpc: "2.0",
    id: `test-${action}`,
    method: "tools/call",
    params: {
      name: "eos_enterprise_workspace",
      arguments: { action },
    },
  });
  assert.equal(response.error, undefined, `Unexpected JSON-RPC error for ${action}: ${JSON.stringify(response.error)}`);
  const text = response?.result?.content?.[0]?.text;
  assert.equal(typeof text, "string", `Expected JSON string payload for ${action}`);
  return JSON.parse(text);
}

test("SPEC-101: Surface Code Quantum Error Correction (BDD-1291..BDD-1295)", async (t) => {
  await t.test("BDD-1291: Below-threshold noise yields exponential logical suppression", () => {
    const report = EosSurfaceCodeQuantumErrorCorrectionCore.auditSurfaceCodeLogicalFidelity({
      distances: [3, 5, 7],
      physicalErrorRate: 0.0025,
      thresholdErrorRate: 0.01,
    });
    assert.equal(report.verdict, "BELOW_THRESHOLD_SUPPRESSION");
    assert.equal(report.lambdaFactor, 4);
    assert.equal(report.exponentialSuppressionVerified, true);
    assert.ok(report.distancesEvaluated[2].logicalErrorRate < report.distancesEvaluated[1].logicalErrorRate);
    assert.ok(report.distancesEvaluated[1].logicalErrorRate < report.distancesEvaluated[0].logicalErrorRate);
    assert.ok(Object.isFrozen(report));
  });

  await t.test("BDD-1292: Above-threshold physical noise triggers ABOVE_FAULT_THRESHOLD_HALT", () => {
    const report = EosSurfaceCodeQuantumErrorCorrectionCore.auditSurfaceCodeLogicalFidelity({
      physicalErrorRate: 0.015,
      thresholdErrorRate: 0.01,
    });
    assert.equal(report.verdict, "ABOVE_FAULT_THRESHOLD_HALT");
    assert.equal(report.exponentialSuppressionVerified, false);
  });

  await t.test("BDD-1293: Strict target logical error rate with d=3 emits INSUFFICIENT_CODE_DISTANCE", () => {
    const report = EosSurfaceCodeQuantumErrorCorrectionCore.auditSurfaceCodeLogicalFidelity({
      distances: [3],
      physicalErrorRate: 0.005,
      thresholdErrorRate: 0.01,
      targetLogicalErrorRate: 1e-12,
    });
    assert.equal(report.verdict, "INSUFFICIENT_CODE_DISTANCE");
  });

  await t.test("BDD-1294: Enforces odd distance, rotated qubit counts (2d^2-1), greedy matching & digest", () => {
    assert.throws(
      () => EosSurfaceCodeQuantumErrorCorrectionCore.auditSurfaceCodeLogicalFidelity({ distances: [4] }),
      /odd integer/i,
    );
    const a = EosSurfaceCodeQuantumErrorCorrectionCore.auditSurfaceCodeLogicalFidelity({
      distances: [5],
      targetLogicalErrorRate: 0.05,
    });
    const b = EosSurfaceCodeQuantumErrorCorrectionCore.auditSurfaceCodeLogicalFidelity({
      distances: [5],
      targetLogicalErrorRate: 0.05,
    });
    assert.equal(a.physicalQubitsPerLogical, 49);
    assert.equal(a.stabilizerDefectsMatched.length, 2);
    assert.equal(a.qecDigestSha256.length, 64);
    assert.equal(a.qecDigestSha256, b.qecDigestSha256);
  });

  await t.test("BDD-1295: End-to-end CLI qec:decode and EosMcpServer JSON-RPC quantum_qec_decode", async () => {
    const cli = runCliJson("qec:decode");
    const mcp = await callWorkspaceMcp("quantum_qec_decode");
    assert.equal(cli.verdict, "BELOW_THRESHOLD_SUPPRESSION");
    assert.equal(mcp.action, "quantum_qec_decode");
    assert.equal(mcp.verdict, "BELOW_THRESHOLD_SUPPRESSION");
    assert.equal(cli.qecDigestSha256, mcp.qecDigestSha256);
  });
});

test("SPEC-102: LEO Constellation Optical ISL & QKD Routing (BDD-1296..BDD-1300)", async (t) => {
  await t.test("BDD-1296: Nominal Walker-Delta optical ISL beats terrestrial fiber and sustains QKD", () => {
    const report = EosLeoConstellationOpticalRoutingCore.planOpticalIslRouteAndQkdBudget();
    assert.equal(report.verdict, "ISL_QUANTUM_LINK_LOCKED");
    assert.equal(report.routeReachable, true);
    assert.ok(report.opticalLatencyMs < report.fiberEquivalentLatencyMs);
    assert.ok(report.qkdSecretKeyRateKbps > 0);
    assert.ok(Object.isFrozen(report));
  });

  await t.test("BDD-1297: Dijkstra autonomously reroutes around degraded direct optical link", () => {
    const report = EosLeoConstellationOpticalRoutingCore.planOpticalIslRouteAndQkdBudget({
      links: [
        { id: "ISL-AC", from: "SAT-A", to: "SAT-C", distanceKm: 2800, primary: true, degraded: true },
        { id: "ISL-AB", from: "SAT-A", to: "SAT-B", distanceKm: 1650, primary: false },
        { id: "ISL-BC", from: "SAT-B", to: "SAT-C", distanceKm: 1650, primary: false },
      ],
    });
    assert.equal(report.verdict, "ISL_REROUTED_DEGRADED");
    assert.deepEqual(report.routePath, ["SAT-A", "SAT-B", "SAT-C"]);
  });

  await t.test("BDD-1298: Severed destination returns CONSTELLATION_LINK_SEVERED", () => {
    const report = EosLeoConstellationOpticalRoutingCore.planOpticalIslRouteAndQkdBudget({
      links: [
        { id: "ISL-AC", from: "SAT-A", to: "SAT-C", distanceKm: 2800, degraded: true },
        { id: "ISL-BC", from: "SAT-B", to: "SAT-C", distanceKm: 1650, degraded: true },
      ],
    });
    assert.equal(report.verdict, "CONSTELLATION_LINK_SEVERED");
    assert.equal(report.routeReachable, false);
    assert.equal(report.hopCount, 0);
  });

  await t.test("BDD-1299: Rejects out-of-envelope altitudes and zeroes QKD key rate when QBER >= 11%", () => {
    assert.throws(() => EosLeoConstellationOpticalRoutingCore.planOpticalIslRouteAndQkdBudget({ altitudeKm: 120 }));
    const highQber = EosLeoConstellationOpticalRoutingCore.planOpticalIslRouteAndQkdBudget({ qber: 0.13 });
    assert.equal(highQber.qkdSecretKeyRateKbps, 0);
    assert.equal(highQber.qkdSecurityThresholdPassed, false);
    assert.equal(highQber.leoRouteDigestSha256.length, 64);
  });

  await t.test("BDD-1300: End-to-end CLI leo:route and EosMcpServer JSON-RPC starlink_leo_route", async () => {
    const cli = runCliJson("leo:route");
    const mcp = await callWorkspaceMcp("starlink_leo_route");
    assert.equal(cli.verdict, "ISL_QUANTUM_LINK_LOCKED");
    assert.equal(mcp.action, "starlink_leo_route");
    assert.equal(cli.leoRouteDigestSha256, mcp.leoRouteDigestSha256);
  });
});

test("SPEC-103: UHV Grid DC-OPF & Frequency Stability (BDD-1301..BDD-1305)", async (t) => {
  await t.test("BDD-1301: Merit-order DC-OPF serves demand plus AI step load with GRID_OPF_STABLE", () => {
    const report = EosPowerGridOptimalPowerFlowCore.solveDcOpfAndFrequencyStability();
    assert.equal(report.verdict, "GRID_OPF_STABLE");
    assert.equal(report.totalDispatchedMw, report.totalRequiredMw);
    assert.ok(report.maxLineLoadingRatio < 0.9);
    assert.ok(Object.isFrozen(report));
  });

  await t.test("BDD-1302: Large GPU cluster load ramp triggers THERMAL_OR_FREQUENCY_STRESS", () => {
    const report = EosPowerGridOptimalPowerFlowCore.solveDcOpfAndFrequencyStability({
      totalDemandMw: 3500,
      datacenterStepLoadMw: 480,
      systemInertiaSec: 1.4,
      baseSystemMva: 3800,
      generators: [
        { id: "GEN-NUC", marginalCostPerMwh: 14, minOutputMw: 500, maxOutputMw: 2200, droopPercent: 9 },
        { id: "GEN-GAS", marginalCostPerMwh: 42, minOutputMw: 200, maxOutputMw: 2200, droopPercent: 9 },
      ],
    });
    assert.equal(report.verdict, "THERMAL_OR_FREQUENCY_STRESS");
    assert.ok(report.deltaFreqHz < 0);
  });

  await t.test("BDD-1303: Demand exceeding total capacity forces BLACKOUT_LOAD_SHED_REQUIRED", () => {
    const report = EosPowerGridOptimalPowerFlowCore.solveDcOpfAndFrequencyStability({
      totalDemandMw: 9000,
      datacenterStepLoadMw: 200,
    });
    assert.equal(report.verdict, "BLACKOUT_LOAD_SHED_REQUIRED");
    assert.ok(report.unservedDemandMw > 0);
  });

  await t.test("BDD-1304: Rejects non-positive demand and produces deterministic gridOpfDigestSha256", () => {
    assert.throws(() => EosPowerGridOptimalPowerFlowCore.solveDcOpfAndFrequencyStability({ totalDemandMw: -10 }));
    const r1 = EosPowerGridOptimalPowerFlowCore.solveDcOpfAndFrequencyStability();
    const r2 = EosPowerGridOptimalPowerFlowCore.solveDcOpfAndFrequencyStability();
    assert.equal(r1.gridOpfDigestSha256.length, 64);
    assert.equal(r1.gridOpfDigestSha256, r2.gridOpfDigestSha256);
  });

  await t.test("BDD-1305: End-to-end CLI grid:opf and EosMcpServer JSON-RPC power_grid_opf", async () => {
    const cli = runCliJson("grid:opf");
    const mcp = await callWorkspaceMcp("power_grid_opf");
    assert.equal(cli.verdict, "GRID_OPF_STABLE");
    assert.equal(mcp.action, "power_grid_opf");
    assert.equal(cli.gridOpfDigestSha256, mcp.gridOpfDigestSha256);
  });
});

test("SPEC-104: Bio-Sequence Alignment & Folding Confidence (BDD-1306..BDD-1310)", async (t) => {
  await t.test("BDD-1306: Canonical alpha-helix yields HIGH_CONFIDENCE_FOLD with 3D contacts", () => {
    const report = EosBioSequenceFoldingConfidenceCore.evaluateFoldingAndSequenceAlignment();
    assert.equal(report.verdict, "HIGH_CONFIDENCE_FOLD");
    assert.equal(report.stericClashCount, 0);
    assert.ok(report.contactPairsCount > 0);
    assert.ok(report.meanPlddt >= 80);
    assert.ok(Object.isFrozen(report));
  });

  await t.test("BDD-1307: Smith-Waterman assigns higher score to conserved vs mutated motif", () => {
    const exact = EosBioSequenceFoldingConfidenceCore.evaluateFoldingAndSequenceAlignment({
      sequence: "MKTAYIAK",
      referenceSequence: "MKTAYIAK",
    });
    const mutated = EosBioSequenceFoldingConfidenceCore.evaluateFoldingAndSequenceAlignment({
      sequence: "MKWWYIAK",
      referenceSequence: "MKTAYIAK",
    });
    assert.equal(exact.alignmentIdentityRatio, 1);
    assert.ok(exact.smithWatermanMaxScore > mutated.smithWatermanMaxScore);
  });

  await t.test("BDD-1308: Overlapping non-adjacent C-alpha coordinates trigger STERIC_VIOLATION_REJECTED", () => {
    const report = EosBioSequenceFoldingConfidenceCore.evaluateFoldingAndSequenceAlignment({
      sequence: "MKTAY",
      caCoordinates: [
        [0, 0, 0],
        [3.8, 0, 0],
        [7.6, 0, 0],
        [0.4, 0.2, 0.2],
        [11.4, 0, 0],
      ],
    });
    assert.ok(report.stericClashCount >= 1);
    assert.equal(report.verdict, "STERIC_VIOLATION_REJECTED");
  });

  await t.test(
    "BDD-1309: Rejects non-canonical amino acids and classifies low pLDDT as DISORDERED_LOW_CONFIDENCE",
    () => {
      assert.throws(() =>
        EosBioSequenceFoldingConfidenceCore.evaluateFoldingAndSequenceAlignment({ sequence: "MKTXZ" }),
      );
      const low = EosBioSequenceFoldingConfidenceCore.evaluateFoldingAndSequenceAlignment({
        sequence: "MKTA",
        plddtPerResidue: [45, 50, 52, 48],
      });
      assert.equal(low.verdict, "DISORDERED_LOW_CONFIDENCE");
      assert.equal(low.bioFoldDigestSha256.length, 64);
    },
  );

  await t.test("BDD-1310: End-to-end CLI bio:fold and EosMcpServer JSON-RPC alphafold_fold_audit", async () => {
    const cli = runCliJson("bio:fold");
    const mcp = await callWorkspaceMcp("alphafold_fold_audit");
    assert.equal(cli.verdict, "HIGH_CONFIDENCE_FOLD");
    assert.equal(mcp.action, "alphafold_fold_audit");
    assert.equal(cli.bioFoldDigestSha256, mcp.bioFoldDigestSha256);
  });
});

test("SPEC-105: Exascale Inertial Fusion Lawson Ignition (BDD-1311..BDD-1315)", async (t) => {
  await t.test("BDD-1311: Nominal NIF hotspot achieves IGNITION_SELF_SUSTAINING", () => {
    const report = EosInertialFusionLawsonIgnitionCore.evaluateLawsonIgnitionAndBurn();
    assert.equal(report.verdict, "IGNITION_SELF_SUSTAINING");
    assert.ok(report.alphaHeatingMw >= report.totalLossMw);
    assert.ok(report.tripleProductKeVSecPerM3 >= 3e21);
    assert.ok(Object.isFrozen(report));
  });

  await t.test("BDD-1312: Moderate confinement hits BURNING_PLASMA_SUB_IGNITION with Q >= 1", () => {
    const report = EosInertialFusionLawsonIgnitionCore.evaluateLawsonIgnitionAndBurn({
      confinementTimeSec: 1.5e-10,
      externalHeatingMw: 2e7,
    });
    assert.equal(report.verdict, "BURNING_PLASMA_SUB_IGNITION");
    assert.ok(report.plasmaGainQ >= 1);
  });

  await t.test("BDD-1313: High P2/P0 asymmetry or cold plasma triggers QUENCHED_BELOW_BREAKEVEN", () => {
    const asym = EosInertialFusionLawsonIgnitionCore.evaluateLawsonIgnitionAndBurn({
      implosionAsymmetryP2OverP0: 0.25,
    });
    const cold = EosInertialFusionLawsonIgnitionCore.evaluateLawsonIgnitionAndBurn({
      ionTemperatureKeV: 2.5,
    });
    assert.equal(asym.verdict, "QUENCHED_BELOW_BREAKEVEN");
    assert.equal(cold.verdict, "QUENCHED_BELOW_BREAKEVEN");
  });

  await t.test("BDD-1314: Rejects non-positive density and preserves power balance residual < 1e-6", () => {
    assert.throws(() => EosInertialFusionLawsonIgnitionCore.evaluateLawsonIgnitionAndBurn({ electronDensityM3: 0 }));
    const a = EosInertialFusionLawsonIgnitionCore.evaluateLawsonIgnitionAndBurn();
    const b = EosInertialFusionLawsonIgnitionCore.evaluateLawsonIgnitionAndBurn();
    assert.ok(a.energyBalanceResidualRatio < 1e-6);
    assert.equal(a.fusionDigestSha256.length, 64);
    assert.equal(a.fusionDigestSha256, b.fusionDigestSha256);
  });

  await t.test(
    "BDD-1315: End-to-end CLI fusion:ignite, EosMcpServer lawson_fusion_ignite, and enriched ship",
    async () => {
      const cli = runCliJson("fusion:ignite");
      const mcp = await callWorkspaceMcp("lawson_fusion_ignite");
      const ship = runCliJson("ship", ["--ticket=BDD-SHIP-253"]);
      assert.equal(cli.verdict, "IGNITION_SELF_SUSTAINING");
      assert.equal(mcp.action, "lawson_fusion_ignite");
      assert.equal(cli.fusionDigestSha256, mcp.fusionDigestSha256);
      assert.equal(ship.qecVerdict, "BELOW_THRESHOLD_SUPPRESSION");
      assert.equal(ship.leoRouteVerdict, "ISL_QUANTUM_LINK_LOCKED");
      assert.equal(ship.gridOpfVerdict, "GRID_OPF_STABLE");
      assert.equal(ship.bioFoldVerdict, "HIGH_CONFIDENCE_FOLD");
      assert.equal(ship.fusionVerdict, "IGNITION_SELF_SUSTAINING");
    },
  );
});
