/**
 * bin/commands/cliDeepTech259To263FrontierMesh.mjs
 * CLI Handlers for SPEC-259..SPEC-268 / CHANGE-129..130 Frontier Engines:
 *   nav:ephemeris, cryo:josephson, dwdm:shannon, aero:scramjet, rtgs:clear,
 *   clock:optical, insar:deform, mpd:thruster, qnet:repeater, evm:prove
 * Zero External Dependencies (Strict EOS Law V), Modularity Limit <= 800 Lines.
 */

import { evaluateDeepSpaceOpticalNavEphemeris } from "../../src/core/eosDeepSpaceOpticalNavEphemerisCore.ts";
import { evaluateCryogenicJosephsonSfqControl } from "../../src/core/eosCryogenicJosephsonSfqControlCore.ts";
import { evaluateSubseaCoherentDwdmNonlinearShannon } from "../../src/core/eosSubseaCoherentDwdmNonlinearShannonCore.ts";
import { evaluateHypersonicAerothermodynamicsScramjet } from "../../src/core/eosHypersonicAerothermodynamicsScramjetCore.ts";
import { evaluateCbdcRtgsGridlockResolution } from "../../src/core/eosCbdcRtgsGridlockResolutionCore.ts";
import { evaluateOpticalLatticeAtomicClockRelativisticSync } from "../../src/core/eosOpticalLatticeAtomicClockRelativisticSyncCore.ts";
import { evaluateInterferometricSarDeformation } from "../../src/core/eosInterferometricSarDeformationCore.ts";
import { evaluateMagnetoplasmadynamicThrusterMhd } from "../../src/core/eosMagnetoplasmadynamicThrusterMhdCore.ts";
import { evaluateQuantumEntanglementRepeaterBbpssw } from "../../src/core/eosQuantumEntanglementRepeaterBbpsswCore.ts";
import { evaluateSmartContractBytecodeGasSymbolicVerifier } from "../../src/core/eosSmartContractBytecodeGasSymbolicVerifierCore.ts";

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

export async function cmd_clock_optical(commandContext) {
  const { args } = commandContext;
  const report = evaluateOpticalLatticeAtomicClockRelativisticSync({
    clockTransitionFreqThz: readOptNum(args, "freq"),
    interrogationAtomCount: readOptNum(args, "atoms"),
    ambientTempK: readOptNum(args, "temp"),
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[OPTICAL CLOCK] ${report.regime} | Ensemble=${report.clockEnsembleId} | AllanE18=${report.allanDeviationE18} | InstabilityE18=${report.combinedInstabilityE18}/${report.maxFractionalInstabilityE18} | Jitter=${report.timingSyncUncertaintyFs}fs`,
  );
}

export async function cmd_insar_deform(commandContext) {
  const { args } = commandContext;
  const report = evaluateInterferometricSarDeformation({
    perpendicularBaselineMeters: readOptNum(args, "baseline"),
    temporalBaselineDays: readOptNum(args, "days"),
    unwrappedPhaseRad: readOptNum(args, "phase"),
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[INSAR DEFORM] ${report.regime} | Coherence=${report.totalCoherence} | LOS_disp=${report.losDisplacementMm}mm | Sigma=${report.displacementUncertaintyMm}mm`,
  );
}

export async function cmd_mpd_thruster(commandContext) {
  const { args } = commandContext;
  const report = evaluateMagnetoplasmadynamicThrusterMhd({
    dischargeCurrentAmps: readOptNum(args, "current"),
    appliedMagneticFieldTesla: readOptNum(args, "bfield"),
    massFlowRateKgPerSec: readOptNum(args, "flow"),
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[MPD THRUSTER] ${report.regime} | Thrust=${report.totalThrustNewtons}N | Isp=${report.specificImpulseSec}s | OnsetRatio=${report.onsetStabilityRatio} | Eta=${report.thrustEfficiency}`,
  );
}

export async function cmd_qnet_repeater(commandContext) {
  const { args } = commandContext;
  const report = evaluateQuantumEntanglementRepeaterBbpssw({
    rawBellPairFidelity: readOptNum(args, "fidelity"),
    purificationRounds: readOptNum(args, "rounds"),
    repeaterSwapLevels: readOptNum(args, "levels"),
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[QUANTUM REPEATER] ${report.regime} | E2E_Fidelity=${report.endToEndFidelity}/${report.minEndToEndFidelity} | MemDeco=${report.memoryDecoherenceFactor} | EbitRate=${report.distilledEbitRatePerSec}Hz`,
  );
}

export async function cmd_evm_prove(commandContext) {
  const { args } = commandContext;
  const report = evaluateSmartContractBytecodeGasSymbolicVerifier({
    maxLoopBound: readOptNum(args, "loops"),
    coldSstoreCount: readOptNum(args, "sstore"),
    blockGasLimitCeiling: readOptNum(args, "limit"),
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[EVM GAS PROVER] ${report.regime} | Cyclomatic=${report.cyclomaticPaths} | WorstGas=${report.worstCaseGasUsed}/${report.blockGasLimitCeiling} | CEI=${report.ceiInvariantSatisfied}`,
  );
}

export function computeNationalLabs264To268ShipMetrics() {
  const clock = evaluateOpticalLatticeAtomicClockRelativisticSync();
  const insar = evaluateInterferometricSarDeformation();
  const mpd = evaluateMagnetoplasmadynamicThrusterMhd();
  const qnet = evaluateQuantumEntanglementRepeaterBbpssw();
  const evm = evaluateSmartContractBytecodeGasSymbolicVerifier();
  const nationalLabsNominal =
    clock.regime === "FEMTOSECOND_TAI_LOCKED" &&
    insar.regime === "PHASE_UNWRAPPED_COHERENT" &&
    mpd.regime === "LORENTZ_PLASMA_ACCELERATION_LOCKED" &&
    qnet.regime === "BELL_PAIR_DISTILLATION_LOCKED" &&
    evm.regime === "SYMBOLIC_GAS_AND_CEI_PROVED";
  return {
    nationalLabsNominal,
    clockRegime: clock.regime,
    insarRegime: insar.regime,
    mpdRegime: mpd.regime,
    qnetRegime: qnet.regime,
    evmRegime: evm.regime,
    clock,
    insar,
    mpd,
    qnet,
    evm,
  };
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
