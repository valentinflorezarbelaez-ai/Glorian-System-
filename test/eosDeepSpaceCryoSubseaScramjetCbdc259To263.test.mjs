import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { EosCbdcRtgsGridlockResolutionCore } from "../src/core/eosCbdcRtgsGridlockResolutionCore.ts";
import { EosCryogenicJosephsonSfqControlCore } from "../src/core/eosCryogenicJosephsonSfqControlCore.ts";
import { EosDeepSpaceOpticalNavEphemerisCore } from "../src/core/eosDeepSpaceOpticalNavEphemerisCore.ts";
import { EosHypersonicAerothermodynamicsScramjetCore } from "../src/core/eosHypersonicAerothermodynamicsScramjetCore.ts";
import { ENTERPRISE_WORKSPACE_EXTENDED_ACTIONS } from "../src/core/eosMcpEnterpriseActionRegistry.ts";
import { EosSubseaCoherentDwdmNonlinearShannonCore } from "../src/core/eosSubseaCoherentDwdmNonlinearShannonCore.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const mcpServer = new EosMcpServer(undefined, "full");

function runCliJson(command) {
  const stdout = execFileSync(process.execPath, [path.join(process.cwd(), "bin/eos.mjs"), command, "--json"], {
    encoding: "utf8",
  });
  return JSON.parse(stdout);
}

async function callWorkspaceMcpRaw(action, extraArgs = {}) {
  return mcpServer.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "eos_enterprise_workspace",
      arguments: { action, ...extraArgs },
    },
  });
}

async function callWorkspaceMcp(action, extraArgs = {}) {
  const res = await callWorkspaceMcpRaw(action, extraArgs);
  assert.equal(res.error, undefined);
  assert.ok(Array.isArray(res.result?.content));
  return JSON.parse(res.result.content[0].text);
}

test("CHANGE-129 Registry: Extended enterprise workspace action catalog reaches 172 actions", () => {
  assert.equal(ENTERPRISE_WORKSPACE_EXTENDED_ACTIONS.size, 172);
  for (const action of [
    "deep_space_optical_nav",
    "cryogenic_josephson_sfq",
    "subsea_dwdm_shannon",
    "hypersonic_scramjet_aero",
    "cbdc_rtgs_gridlock",
  ]) {
    assert.ok(ENTERPRISE_WORKSPACE_EXTENDED_ACTIONS.has(action), `Missing registry action: ${action}`);
  }
});

test("SPEC-259: Deep Space Optical Navigation & XNAV Ephemeris Core (BDD-1341..BDD-1345)", async (t) => {
  await t.test("BDD-1341: Nominal deep-space 5.2 AU optical & XNAV lock", () => {
    const report = EosDeepSpaceOpticalNavEphemerisCore.evaluateDeepSpaceOpticalNavEphemeris();
    const viaInstance = new EosDeepSpaceOpticalNavEphemerisCore().evaluate();
    assert.equal(report.specId, "SPEC-259");
    assert.equal(report.regime, "NOMINAL_DEEP_SPACE_LOCK");
    assert.ok(report.combinedPositionUncertaintyKm <= report.maxPositionUncertaintyKm);
    assert.ok(report.oneWayLightTimeSec > 0);
    assert.ok(report.shapiroDelayMicroSec > 0);
    assert.ok(report.stellarAberrationMicroRad > 0);
    assert.equal(Object.isFrozen(report), true);
    assert.equal(viaInstance.deepSpaceNavDigestSha256, report.deepSpaceNavDigestSha256);
  });

  await t.test("BDD-1342: Low Sun-Earth-Probe angle triggers solar conjunction caution", () => {
    const nominal = EosDeepSpaceOpticalNavEphemerisCore.evaluateDeepSpaceOpticalNavEphemeris();
    const report = EosDeepSpaceOpticalNavEphemerisCore.evaluateDeepSpaceOpticalNavEphemeris({
      sunEarthProbeAngleDeg: 3.2,
    });
    assert.equal(report.regime, "SOLAR_CONJUNCTION_CAUTION");
    assert.ok(report.shapiroDelayMicroSec > nominal.shapiroDelayMicroSec);
  });

  await t.test("BDD-1343: Excessive Delta-DOR residual triggers EPHEMERIS_DRIFT_CRITICAL", () => {
    const report = EosDeepSpaceOpticalNavEphemerisCore.evaluateDeepSpaceOpticalNavEphemeris({
      deltaDorResidualPrad: 4500.0,
      maxPositionUncertaintyKm: 2.5,
    });
    assert.equal(report.regime, "EPHEMERIS_DRIFT_CRITICAL");
    assert.ok(report.combinedPositionUncertaintyKm > 2.5);
  });

  await t.test("BDD-1344: Pulsar count precondition & deterministic digest", () => {
    assert.throws(
      () => EosDeepSpaceOpticalNavEphemerisCore.evaluateDeepSpaceOpticalNavEphemeris({ pulsarCount: 2 }),
      /PRECONDITION_FAILED/,
    );
    assert.throws(
      () => EosDeepSpaceOpticalNavEphemerisCore.evaluateDeepSpaceOpticalNavEphemeris({ sunEarthProbeAngleDeg: 0 }),
      /PRECONDITION_FAILED/,
    );
    const a = EosDeepSpaceOpticalNavEphemerisCore.evaluateDeepSpaceOpticalNavEphemeris();
    const b = EosDeepSpaceOpticalNavEphemerisCore.evaluateDeepSpaceOpticalNavEphemeris();
    assert.equal(a.deepSpaceNavDigestSha256, b.deepSpaceNavDigestSha256);
    assert.equal(a.deepSpaceNavDigestSha256.length, 64);
  });

  await t.test("BDD-1345: CLI nav:ephemeris & MCP deep_space_optical_nav end-to-end", async () => {
    const cli = runCliJson("nav:ephemeris");
    const mcp = await callWorkspaceMcp("deep_space_optical_nav");
    assert.equal(cli.regime, "NOMINAL_DEEP_SPACE_LOCK");
    assert.equal(mcp.regime, "NOMINAL_DEEP_SPACE_LOCK");
    assert.equal(cli.deepSpaceNavDigestSha256, mcp.deepSpaceNavDigestSha256);
  });
});

test("SPEC-260: Cryogenic Josephson Junction & SFQ Control Core (BDD-1346..BDD-1350)", async (t) => {
  await t.test("BDD-1346: Nominal 15 mK overdamped SFQ array lock", () => {
    const report = EosCryogenicJosephsonSfqControlCore.evaluateCryogenicJosephsonSfqControl();
    const viaInstance = new EosCryogenicJosephsonSfqControlCore().evaluate();
    assert.equal(report.specId, "SPEC-260");
    assert.equal(report.regime, "OVERDAMPED_SFQ_LOCKED");
    assert.ok(report.stewartMcCumberBetaC < 0.85);
    assert.ok(report.thermalLoadRatio < 0.75);
    assert.ok(report.characteristicFreqGhz > 0);
    assert.equal(Object.isFrozen(report), true);
    assert.equal(viaInstance.cryoSfqDigestSha256, report.cryoSfqDigestSha256);
  });

  await t.test("BDD-1347: Elevated SFQ clock triggers THERMAL_HEADROOM_WARNING", () => {
    const report = EosCryogenicJosephsonSfqControlCore.evaluateCryogenicJosephsonSfqControl({
      sfqClockGhz: 120.0,
    });
    assert.equal(report.regime, "THERMAL_HEADROOM_WARNING");
    assert.ok(report.thermalLoadRatio > 0.75 && report.thermalLoadRatio <= 1.0);
  });

  await t.test("BDD-1348: Underdamped shunt resistance pushes beta_c > 1", () => {
    const report = EosCryogenicJosephsonSfqControlCore.evaluateCryogenicJosephsonSfqControl({
      shuntResistanceOhms: 5.0,
    });
    assert.equal(report.regime, "QUASIPARTICLE_HYSTERESIS_RISK");
    assert.ok(report.stewartMcCumberBetaC > 1.0);
  });

  await t.test("BDD-1349: Non-positive cooling capacity throws & digest is deterministic", () => {
    assert.throws(
      () =>
        EosCryogenicJosephsonSfqControlCore.evaluateCryogenicJosephsonSfqControl({
          stageCoolingCapacityMicroWatts: 0,
        }),
      /PRECONDITION_FAILED/,
    );
    const a = EosCryogenicJosephsonSfqControlCore.evaluateCryogenicJosephsonSfqControl();
    const b = EosCryogenicJosephsonSfqControlCore.evaluateCryogenicJosephsonSfqControl();
    assert.equal(a.cryoSfqDigestSha256, b.cryoSfqDigestSha256);
    assert.equal(a.cryoSfqDigestSha256.length, 64);
  });

  await t.test("BDD-1350: CLI cryo:josephson & MCP cryogenic_josephson_sfq end-to-end", async () => {
    const cli = runCliJson("cryo:josephson");
    const mcp = await callWorkspaceMcp("cryogenic_josephson_sfq");
    assert.equal(cli.regime, "OVERDAMPED_SFQ_LOCKED");
    assert.equal(mcp.regime, "OVERDAMPED_SFQ_LOCKED");
    assert.equal(cli.cryoSfqDigestSha256, mcp.cryoSfqDigestSha256);
  });
});

test("SPEC-261: Subsea Coherent DWDM Nonlinear Shannon Core (BDD-1351..BDD-1355)", async (t) => {
  await t.test("BDD-1351: Optimal transatlantic coherent DWDM Shannon link", () => {
    const report = EosSubseaCoherentDwdmNonlinearShannonCore.evaluateSubseaCoherentDwdmNonlinearShannon();
    const viaInstance = new EosSubseaCoherentDwdmNonlinearShannonCore().evaluate();
    assert.equal(report.specId, "SPEC-261");
    assert.equal(report.regime, "OPTIMAL_NONLINEAR_SHANNON");
    assert.ok(report.generalizedSnrDb >= report.minGeneralizedSnrDb);
    assert.ok(report.totalFiberPairCapacityTbps > 0);
    assert.equal(Object.isFrozen(report), true);
    assert.equal(viaInstance.subseaDwdmDigestSha256, report.subseaDwdmDigestSha256);
  });

  await t.test("BDD-1352: Over-launching drives Kerr NLI past 55% of ASE noise", () => {
    const report = EosSubseaCoherentDwdmNonlinearShannonCore.evaluateSubseaCoherentDwdmNonlinearShannon({
      launchPowerDbm: 2.0,
    });
    assert.equal(report.regime, "KERR_NONLINEAR_SATURATION");
    assert.ok(report.kerrNliPowerWatts > 0.55 * report.aseNoisePowerWatts);
    assert.ok(report.generalizedSnrDb >= report.minGeneralizedSnrDb);
  });

  await t.test("BDD-1353: Excessive span count drops GSNR below FEC floor", () => {
    const report = EosSubseaCoherentDwdmNonlinearShannonCore.evaluateSubseaCoherentDwdmNonlinearShannon({
      spanCount: 320,
      launchPowerDbm: -4.0,
    });
    assert.equal(report.regime, "OSNR_BELOW_FEC_THRESHOLD");
    assert.ok(report.generalizedSnrDb < report.minGeneralizedSnrDb);
  });

  await t.test("BDD-1354: Launch power bounds guard & deterministic digest", () => {
    assert.throws(
      () =>
        EosSubseaCoherentDwdmNonlinearShannonCore.evaluateSubseaCoherentDwdmNonlinearShannon({ launchPowerDbm: 25 }),
      /PRECONDITION_FAILED/,
    );
    const a = EosSubseaCoherentDwdmNonlinearShannonCore.evaluateSubseaCoherentDwdmNonlinearShannon();
    const b = EosSubseaCoherentDwdmNonlinearShannonCore.evaluateSubseaCoherentDwdmNonlinearShannon();
    assert.equal(a.subseaDwdmDigestSha256, b.subseaDwdmDigestSha256);
    assert.equal(a.subseaDwdmDigestSha256.length, 64);
  });

  await t.test("BDD-1355: CLI dwdm:shannon & MCP subsea_dwdm_shannon end-to-end", async () => {
    const cli = runCliJson("dwdm:shannon");
    const mcp = await callWorkspaceMcp("subsea_dwdm_shannon");
    assert.equal(cli.regime, "OPTIMAL_NONLINEAR_SHANNON");
    assert.equal(mcp.regime, "OPTIMAL_NONLINEAR_SHANNON");
    assert.equal(cli.subseaDwdmDigestSha256, mcp.subseaDwdmDigestSha256);
  });
});

test("SPEC-262: Hypersonic Aerothermodynamics & Scramjet Isolator Core (BDD-1356..BDD-1360)", async (t) => {
  await t.test("BDD-1356: Stable Mach 7.8 supersonic combustion envelope", () => {
    const report = EosHypersonicAerothermodynamicsScramjetCore.evaluateHypersonicAerothermodynamicsScramjet();
    const viaInstance = new EosHypersonicAerothermodynamicsScramjetCore().evaluate();
    assert.equal(report.specId, "SPEC-262");
    assert.equal(report.regime, "SUPERSONIC_COMBUSTION_STABLE");
    assert.ok(report.isolatorUnstartMargin > 0.22);
    assert.ok(report.stagnationHeatFluxMwPerM2 <= 0.8 * report.maxTpsHeatFluxMwPerM2);
    assert.equal(Object.isFrozen(report), true);
    assert.equal(viaInstance.hypersonicAeroDigestSha256, report.hypersonicAeroDigestSha256);
  });

  await t.test("BDD-1357: Higher freestream density triggers AEROTHERMAL_FLUX_ELEVATED", () => {
    const report = EosHypersonicAerothermodynamicsScramjetCore.evaluateHypersonicAerothermodynamicsScramjet({
      freestreamDensityKgPerM3: 0.085,
    });
    assert.equal(report.regime, "AEROTHERMAL_FLUX_ELEVATED");
    assert.ok(report.stagnationHeatFluxMwPerM2 > 0.8 * report.maxTpsHeatFluxMwPerM2);
    assert.ok(report.stagnationHeatFluxMwPerM2 <= report.maxTpsHeatFluxMwPerM2);
  });

  await t.test("BDD-1358: Excessive heat release triggers ISOLATOR_UNSTART_CRITICAL", () => {
    const report = EosHypersonicAerothermodynamicsScramjetCore.evaluateHypersonicAerothermodynamicsScramjet({
      combustorHeatReleaseRatio: 0.68,
    });
    assert.equal(report.regime, "ISOLATOR_UNSTART_CRITICAL");
    assert.ok(report.isolatorUnstartMargin <= 0.08);
  });

  await t.test("BDD-1359: Sub-hypersonic Mach throws PRECONDITION_FAILED & digest is deterministic", () => {
    assert.throws(
      () =>
        EosHypersonicAerothermodynamicsScramjetCore.evaluateHypersonicAerothermodynamicsScramjet({
          freestreamMach: 2.0,
        }),
      /PRECONDITION_FAILED/,
    );
    const a = EosHypersonicAerothermodynamicsScramjetCore.evaluateHypersonicAerothermodynamicsScramjet();
    const b = EosHypersonicAerothermodynamicsScramjetCore.evaluateHypersonicAerothermodynamicsScramjet();
    assert.equal(a.hypersonicAeroDigestSha256, b.hypersonicAeroDigestSha256);
    assert.equal(a.hypersonicAeroDigestSha256.length, 64);
  });

  await t.test("BDD-1360: CLI aero:scramjet & MCP hypersonic_scramjet_aero end-to-end", async () => {
    const cli = runCliJson("aero:scramjet");
    const mcp = await callWorkspaceMcp("hypersonic_scramjet_aero");
    assert.equal(cli.regime, "SUPERSONIC_COMBUSTION_STABLE");
    assert.equal(mcp.regime, "SUPERSONIC_COMBUSTION_STABLE");
    assert.equal(cli.hypersonicAeroDigestSha256, mcp.hypersonicAeroDigestSha256);
  });
});

test("SPEC-263: Wholesale CBDC RTGS Multilateral Gridlock Resolution Core (BDD-1361..BDD-1365)", async (t) => {
  await t.test("BDD-1361: Multilateral LSM netting clears 100% of queued gross obligations", () => {
    const report = EosCbdcRtgsGridlockResolutionCore.evaluateCbdcRtgsGridlockResolution();
    const viaInstance = new EosCbdcRtgsGridlockResolutionCore().evaluate();
    assert.equal(report.specId, "SPEC-263");
    assert.equal(report.regime, "MULTILATERAL_LSM_CLEARED");
    assert.equal(report.settlementThroughputRatio, 1);
    assert.equal(report.conservationResidualUsdM, 0);
    assert.ok(report.liquidityVelocityMultiplier > 1);
    assert.equal(Object.isFrozen(report), true);
    assert.equal(viaInstance.cbdcRtgsDigestSha256, report.cbdcRtgsDigestSha256);
  });

  await t.test("BDD-1362: Moderately constrained reserves trigger PARTIAL_QUEUE_COMPRESSION", () => {
    const report = EosCbdcRtgsGridlockResolutionCore.evaluateCbdcRtgsGridlockResolution({
      availableCentralBankReservesUsdM: 14000,
      minSettlementThroughputRatio: 0.85,
    });
    assert.equal(report.regime, "PARTIAL_QUEUE_COMPRESSION");
    assert.ok(report.settlementThroughputRatio >= 0.85 && report.settlementThroughputRatio < 1.0);
    assert.equal(report.conservationResidualUsdM, 0);
  });

  await t.test("BDD-1363: Severe reserve shortage trips SYSTEMIC_LIQUIDITY_GRIDLOCK", () => {
    const report = EosCbdcRtgsGridlockResolutionCore.evaluateCbdcRtgsGridlockResolution({
      availableCentralBankReservesUsdM: 4500.0,
    });
    assert.equal(report.regime, "SYSTEMIC_LIQUIDITY_GRIDLOCK");
    assert.ok(report.settlementThroughputRatio < 0.85);
    assert.equal(report.conservationResidualUsdM, 0);
  });

  await t.test("BDD-1364: Participant count precondition & deterministic digest", () => {
    assert.throws(
      () => EosCbdcRtgsGridlockResolutionCore.evaluateCbdcRtgsGridlockResolution({ participantBankCount: 1 }),
      /PRECONDITION_FAILED/,
    );
    const a = EosCbdcRtgsGridlockResolutionCore.evaluateCbdcRtgsGridlockResolution();
    const b = EosCbdcRtgsGridlockResolutionCore.evaluateCbdcRtgsGridlockResolution();
    assert.equal(a.cbdcRtgsDigestSha256, b.cbdcRtgsDigestSha256);
    assert.equal(a.cbdcRtgsDigestSha256.length, 64);
  });

  await t.test("BDD-1365: CLI rtgs:clear & MCP cbdc_rtgs_gridlock end-to-end", async () => {
    const cli = runCliJson("rtgs:clear");
    const mcp = await callWorkspaceMcp("cbdc_rtgs_gridlock");
    assert.equal(cli.regime, "MULTILATERAL_LSM_CLEARED");
    assert.equal(mcp.regime, "MULTILATERAL_LSM_CLEARED");
    assert.equal(cli.cbdcRtgsDigestSha256, mcp.cbdcRtgsDigestSha256);
  });
});
