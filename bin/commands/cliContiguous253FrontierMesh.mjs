import { EosSurfaceCodeQuantumErrorCorrectionCore } from "../../src/core/eosSurfaceCodeQuantumErrorCorrectionCore.ts";
import { EosLeoConstellationOpticalRoutingCore } from "../../src/core/eosLeoConstellationOpticalRoutingCore.ts";
import { EosPowerGridOptimalPowerFlowCore } from "../../src/core/eosPowerGridOptimalPowerFlowCore.ts";
import { EosBioSequenceFoldingConfidenceCore } from "../../src/core/eosBioSequenceFoldingConfidenceCore.ts";
import { EosInertialFusionLawsonIgnitionCore } from "../../src/core/eosInertialFusionLawsonIgnitionCore.ts";
import { EosComputationalLithographyOpcCore } from "../../src/core/eosComputationalLithographyOpcCore.ts";
import { EosDifferentialPrivacyAbacGovernorCore } from "../../src/core/eosDifferentialPrivacyAbacGovernorCore.ts";
import { EosLobAlmgrenChrissVpinCore } from "../../src/core/eosLobAlmgrenChrissVpinCore.ts";
import { EosUnifiedMemoryDmaDvfsQosCore } from "../../src/core/eosUnifiedMemoryDmaDvfsQosCore.ts";
import { EosRelativisticBeamTwissLuminosityCore } from "../../src/core/eosRelativisticBeamTwissLuminosityCore.ts";

function readOptNum(args, name) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  if (!found) return undefined;
  const parsed = Number(found.slice(prefix.length));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readOptStr(args, name) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

export async function cmd_qec_decode(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const rawDistances = readOptStr(args, "distances");
  const distances = rawDistances ? rawDistances.split(",").map((s) => Number(s.trim())) : undefined;
  const report = EosSurfaceCodeQuantumErrorCorrectionCore.auditSurfaceCodeLogicalFidelity({
    distances,
    physicalErrorRate: readOptNum(args, "phys"),
    thresholdErrorRate: readOptNum(args, "threshold"),
    targetLogicalErrorRate: readOptNum(args, "target"),
    logicalQubitCount: readOptNum(args, "logical"),
    magicStateFactories: readOptNum(args, "factories"),
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[SURFACE QEC] ${report.verdict} | Lambda=${report.lambdaFactor} | d=${report.selectedDistance} | pL=${report.achievedLogicalErrorRate} | PhysQubits=${report.totalPhysicalQubitsRequired}`,
  );
}

export async function cmd_leo_route(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const report = EosLeoConstellationOpticalRoutingCore.planOpticalIslRouteAndQkdBudget({
    altitudeKm: readOptNum(args, "altitude"),
    sourceNodeId: readOptStr(args, "src"),
    destinationNodeId: readOptStr(args, "dst"),
    qber: readOptNum(args, "qber"),
    relativeVelocityKmPerSec: readOptNum(args, "vel"),
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[LEO OPTICAL ISL] ${report.verdict} | Path=${report.routePath.join("->")} | Optical=${report.opticalLatencyMs}ms vs Fiber=${report.fiberEquivalentLatencyMs}ms (${report.vacuumSpeedupRatio}x) | QKD=${report.qkdSecretKeyRateKbps}kbps`,
  );
}

export async function cmd_grid_opf(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const rawFreq = readOptNum(args, "freq");
  const nominalFrequencyHz = rawFreq === 50 || rawFreq === 60 ? rawFreq : undefined;
  const report = EosPowerGridOptimalPowerFlowCore.solveDcOpfAndFrequencyStability({
    nominalFrequencyHz,
    totalDemandMw: readOptNum(args, "demand"),
    datacenterStepLoadMw: readOptNum(args, "step"),
    systemInertiaSec: readOptNum(args, "inertia"),
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[GRID DC-OPF] ${report.verdict} | Dispatched=${report.totalDispatchedMw}MW | MaxLine=${report.maxLineLoadingRatio} | Nadir=${report.nadirFrequencyHz}Hz | RoCoF=${report.rocofHzPerSec}Hz/s`,
  );
}

export async function cmd_bio_fold(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const rawPlddt = readOptNum(args, "plddt");
  const seq = readOptStr(args, "seq");
  const ref = readOptStr(args, "ref");
  const plddtPerResidue =
    rawPlddt !== undefined ? new Array((seq ?? "MKTAYIAKQRQISFVK").length).fill(rawPlddt) : undefined;
  const report = EosBioSequenceFoldingConfidenceCore.evaluateFoldingAndSequenceAlignment({
    sequence: seq,
    referenceSequence: ref,
    meanPaeAngstrom: readOptNum(args, "pae"),
    plddtPerResidue,
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[BIO FOLDING] ${report.verdict} | Len=${report.sequenceLength} | SW=${report.smithWatermanMaxScore} | Contacts=${report.contactPairsCount} | Clashes=${report.stericClashCount} | pLDDT=${report.meanPlddt}`,
  );
}

export async function cmd_fusion_ignite(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const report = EosInertialFusionLawsonIgnitionCore.evaluateLawsonIgnitionAndBurn({
    electronDensityM3: readOptNum(args, "density"),
    confinementTimeSec: readOptNum(args, "tau"),
    ionTemperatureKeV: readOptNum(args, "temp"),
    externalHeatingMw: readOptNum(args, "heating"),
    implosionAsymmetryP2OverP0: readOptNum(args, "p2p0"),
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[FUSION LAWSON] ${report.verdict} | Triple=${report.tripleProductKeVSecPerM3.toExponential(2)} | Q=${report.plasmaGainQ} | Alpha=${report.alphaHeatingMw.toExponential(2)}MW vs Loss=${report.totalLossMw.toExponential(2)}MW`,
  );
}

export async function cmd_litho_opc(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const report = EosComputationalLithographyOpcCore.evaluateComputationalLithographyOpc({
    wavelengthNm: readOptNum(args, "wavelength"),
    numericalAperture: readOptNum(args, "na"),
    targetCdNm: readOptNum(args, "cd"),
    opcIterations: readOptNum(args, "iterations"),
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[LITHO OPC] ${report.verdict} | Node=${report.processNode} | Rayleigh=${report.rayleighHalfPitchNm}nm | NILS=${report.nils} | EPE=${report.residualEpeNm}nm`,
  );
}

export async function cmd_privacy_abac(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const report = EosDifferentialPrivacyAbacGovernorCore.evaluateDifferentialPrivacyAbac({
    subjectClearance: readOptNum(args, "clearance"),
    epsilonAlreadySpent: readOptNum(args, "spent"),
    queryEpsilon: readOptNum(args, "epsilon"),
    deviceTrustScore: readOptNum(args, "trust"),
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[DP-ABAC] ${report.verdict} | ABAC=${report.abacAuthorized} | RemainingEps=${report.remainingEpsilonBudget} | LaplaceScale=${report.laplaceScale} | GaussianSigma=${report.gaussianSigma}`,
  );
}

export async function cmd_lob_vpin(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const report = EosLobAlmgrenChrissVpinCore.evaluateLobAlmgrenChrissVpin({
    symbol: readOptStr(args, "symbol"),
    bestBidPrice: readOptNum(args, "bid"),
    bestAskPrice: readOptNum(args, "ask"),
    orderSizeShares: readOptNum(args, "shares"),
    horizonSlices: readOptNum(args, "slices"),
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[LOB ALMGREN-CHRISS VPIN] ${report.verdict} | Mid=${report.midPrice} | Spread=${report.spreadBps}bps | IS=${report.expectedShortfallBps}bps | VPIN=${report.vpin}`,
  );
}

export async function cmd_dvfs_qos(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const report = EosUnifiedMemoryDmaDvfsQosCore.evaluateUnifiedMemoryDmaDvfsQos({
    totalUnifiedBandwidthGBps: readOptNum(args, "bw"),
    voltageVolts: readOptNum(args, "voltage"),
    frequencyGhz: readOptNum(args, "freq"),
    ambientTempC: readOptNum(args, "ambient"),
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[UNIFIED DVFS-QOS] ${report.verdict} | PState=${report.pState} | Granted=${report.totalGrantedGBps}/${report.totalUnifiedBandwidthGBps}GB/s | Power=${report.totalPackagePowerWatts}W | Tj=${report.junctionTempC}C`,
  );
}

export async function cmd_beam_twiss(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const report = EosRelativisticBeamTwissLuminosityCore.evaluateRelativisticBeamTwissLuminosity({
    beamEnergyGev: readOptNum(args, "energy"),
    fodoFocalLengthM: readOptNum(args, "focal"),
    betaStarM: readOptNum(args, "betastar"),
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[BEAM TWISS] ${report.verdict} | Gamma=${report.lorentzGamma} | Trace=${report.fodoMatrixTrace} | Det=${report.symplecticDeterminant} | L=${report.luminosityCm2s.toExponential(2)}cm-2s-1 | U0=${report.synchrotronLossKevPerTurn}keV`,
  );
}

export function evaluateContiguous253ShipSnapshot() {
  const qec = EosSurfaceCodeQuantumErrorCorrectionCore.auditSurfaceCodeLogicalFidelity();
  const leo = EosLeoConstellationOpticalRoutingCore.planOpticalIslRouteAndQkdBudget();
  const grid = EosPowerGridOptimalPowerFlowCore.solveDcOpfAndFrequencyStability();
  const bio = EosBioSequenceFoldingConfidenceCore.evaluateFoldingAndSequenceAlignment();
  const fusion = EosInertialFusionLawsonIgnitionCore.evaluateLawsonIgnitionAndBurn();
  const litho = EosComputationalLithographyOpcCore.evaluateComputationalLithographyOpc();
  const privacyAbac = EosDifferentialPrivacyAbacGovernorCore.evaluateDifferentialPrivacyAbac();
  const lobVpin = EosLobAlmgrenChrissVpinCore.evaluateLobAlmgrenChrissVpin();
  const dvfsQos = EosUnifiedMemoryDmaDvfsQosCore.evaluateUnifiedMemoryDmaDvfsQos();
  const beamTwiss = EosRelativisticBeamTwissLuminosityCore.evaluateRelativisticBeamTwissLuminosity();
  const allNominal =
    qec.verdict === "BELOW_THRESHOLD_SUPPRESSION" &&
    leo.verdict === "ISL_QUANTUM_LINK_LOCKED" &&
    grid.verdict === "GRID_OPF_STABLE" &&
    bio.verdict === "HIGH_CONFIDENCE_FOLD" &&
    fusion.verdict === "IGNITION_SELF_SUSTAINING" &&
    litho.verdict === "LITHO_OPC_CONVERGED" &&
    privacyAbac.verdict === "PRIVACY_AND_ABAC_AUTHORIZED" &&
    lobVpin.verdict === "EXECUTION_TRAJECTORY_OPTIMAL" &&
    dvfsQos.verdict === "QOS_AND_THERMAL_NOMINAL" &&
    beamTwiss.verdict === "BEAM_OPTICS_LUMINOSITY_LOCKED";
  return {
    allNominal,
    qecVerdict: qec.verdict,
    leoRouteVerdict: leo.verdict,
    gridOpfVerdict: grid.verdict,
    bioFoldVerdict: bio.verdict,
    fusionVerdict: fusion.verdict,
    lithoVerdict: litho.verdict,
    privacyAbacVerdict: privacyAbac.verdict,
    lobVpinVerdict: lobVpin.verdict,
    dvfsQosVerdict: dvfsQos.verdict,
    beamTwissVerdict: beamTwiss.verdict,
    qec,
    leo,
    grid,
    bio,
    fusion,
    litho,
    privacyAbac,
    lobVpin,
    dvfsQos,
    beamTwiss,
  };
}
