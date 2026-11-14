/**
 * bin/commands/cliDeepTech259To263FrontierMesh.mjs
 * CLI Handlers for SPEC-259..SPEC-263 / CHANGE-129 Frontier Engines:
 *   nav:ephemeris, cryo:josephson, dwdm:shannon, aero:scramjet, rtgs:clear
 * Zero External Dependencies (Strict EOS Law V), Modularity Limit <= 800 Lines.
 */

import { evaluateDeepSpaceOpticalNavEphemeris } from "../../src/core/eosDeepSpaceOpticalNavEphemerisCore.ts";
import { evaluateCryogenicJosephsonSfqControl } from "../../src/core/eosCryogenicJosephsonSfqControlCore.ts";
import { evaluateSubseaCoherentDwdmNonlinearShannon } from "../../src/core/eosSubseaCoherentDwdmNonlinearShannonCore.ts";
import { evaluateHypersonicAerothermodynamicsScramjet } from "../../src/core/eosHypersonicAerothermodynamicsScramjetCore.ts";
import { evaluateCbdcRtgsGridlockResolution } from "../../src/core/eosCbdcRtgsGridlockResolutionCore.ts";

function readOptNum(args, name) {
  const pref = `--${name}=`;
  const hit = args.find((a) => a.startsWith(pref));
  if (!hit) return undefined;
  const parsed = Number(hit.slice(pref.length));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function cmd_nav_ephemeris(commandContext) {
  const { args } = commandContext;
  const report = evaluateDeepSpaceOpticalNavEphemeris({
    heliocentricDistanceAu: readOptNum(args, "au"),
    sunEarthProbeAngleDeg: readOptNum(args, "sep"),
    deltaDorResidualPrad: readOptNum(args, "dor"),
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[DEEP SPACE NAV] ${report.regime} | AU=${report.heliocentricDistanceAu} | Shapiro=${report.shapiroDelayMicroSec}us | 3D_Sigma=${report.combinedPositionUncertaintyKm}km/${report.maxPositionUncertaintyKm}km`,
  );
}

export async function cmd_cryo_josephson(commandContext) {
  const { args } = commandContext;
  const report = evaluateCryogenicJosephsonSfqControl({
    mixingChamberTempMk: readOptNum(args, "temp"),
    shuntResistanceOhms: readOptNum(args, "rn"),
    sfqClockGhz: readOptNum(args, "clock"),
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[CRYO JOSEPHSON SFQ] ${report.regime} | BetaC=${report.stewartMcCumberBetaC} | fc=${report.characteristicFreqGhz}GHz | LoadRatio=${report.thermalLoadRatio}`,
  );
}

export async function cmd_dwdm_shannon(commandContext) {
  const { args } = commandContext;
  const report = evaluateSubseaCoherentDwdmNonlinearShannon({
    spanCount: readOptNum(args, "spans"),
    launchPowerDbm: readOptNum(args, "power"),
    wDMChannelCount: readOptNum(args, "channels"),
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[SUBSEA DWDM SHANNON] ${report.regime} | GSNR=${report.generalizedSnrDb}dB | SE=${report.spectralEfficiencyBpsPerHz}b/s/Hz | Capacity=${report.totalFiberPairCapacityTbps}Tbps`,
  );
}

export async function cmd_aero_scramjet(commandContext) {
  const { args } = commandContext;
  const report = evaluateHypersonicAerothermodynamicsScramjet({
    freestreamMach: readOptNum(args, "mach"),
    freestreamDensityKgPerM3: readOptNum(args, "density"),
    combustorHeatReleaseRatio: readOptNum(args, "heat"),
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[HYPERSONIC SCRAMJET] ${report.regime} | Mach=${report.freestreamMach} | q=${report.stagnationHeatFluxMwPerM2}MW/m2 | UnstartMargin=${report.isolatorUnstartMargin} | Isp=${report.specificImpulseSec}s`,
  );
}

export async function cmd_rtgs_clear(commandContext) {
  const { args } = commandContext;
  const report = evaluateCbdcRtgsGridlockResolution({
    availableCentralBankReservesUsdM: readOptNum(args, "reserves"),
    queuedGrossObligationsUsdM: readOptNum(args, "queue"),
    topBankObligationShare: readOptNum(args, "topshare"),
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[CBDC RTGS LSM] ${report.regime} | Throughput=${(report.settlementThroughputRatio * 100).toFixed(2)}% | Velocity=${report.liquidityVelocityMultiplier}x | HHI=${report.herfindahlIndex}`,
  );
}

export function computeDeepTech259To263ShipMetrics() {
  const deepSpaceNav = evaluateDeepSpaceOpticalNavEphemeris();
  const cryoSfq = evaluateCryogenicJosephsonSfqControl();
  const subseaDwdm = evaluateSubseaCoherentDwdmNonlinearShannon();
  const hypersonicAero = evaluateHypersonicAerothermodynamicsScramjet();
  const cbdcRtgs = evaluateCbdcRtgsGridlockResolution();
  const deepTechNominal =
    deepSpaceNav.regime === "NOMINAL_DEEP_SPACE_LOCK" &&
    cryoSfq.regime === "OVERDAMPED_SFQ_LOCKED" &&
    subseaDwdm.regime === "OPTIMAL_NONLINEAR_SHANNON" &&
    hypersonicAero.regime === "SUPERSONIC_COMBUSTION_STABLE" &&
    cbdcRtgs.regime === "MULTILATERAL_LSM_CLEARED";
  return {
    deepTechNominal,
    deepSpaceNavRegime: deepSpaceNav.regime,
    cryoSfqRegime: cryoSfq.regime,
    subseaDwdmRegime: subseaDwdm.regime,
    hypersonicAeroRegime: hypersonicAero.regime,
    cbdcRtgsRegime: cbdcRtgs.regime,
    deepSpaceNav,
    cryoSfq,
    subseaDwdm,
    hypersonicAero,
    cbdcRtgs,
  };
}
