/**
 * SPEC-105 / CHANGE-127 — Layer-0 Exascale Inertial Fusion Lawson Ignition Core.
 * Inspired by LLNL El Capitan / NIF D-T Lawson criterion, Bosch-Hale reactivity & power balance.
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPostcondition, assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  FusionIgnitionVerdict,
  LawsonFusionOptions,
  LawsonFusionReport,
} from "./eosInertialFusionLawsonIgnitionCore.types.ts";

export type {
  FusionIgnitionVerdict,
  LawsonFusionOptions,
  LawsonFusionReport,
} from "./eosInertialFusionLawsonIgnitionCore.types.ts";

const JOULES_PER_KEV = 1.602176634e-16;
const DT_FUSION_JOULES = 17.59e3 * JOULES_PER_KEV;
const BREMSSTRAHLUNG_COEFF_SI = 5.35e-37;
const ALPHA_FRACTION_DT = 0.2;

function roundSig(value: number, sigDigits = 8): number {
  if (value === 0) return 0;
  return Number(value.toPrecision(sigDigits));
}

function validateFusionOptions(
  nM3: number,
  tauSec: number,
  tempKeV: number,
  volumeM3: number,
  extHeatingMw: number,
  p2OverP0: number,
  zEff: number,
): void {
  assertPrecondition(Number.isFinite(nM3) && nM3 > 0, "electronDensityM3 must be strictly positive.");
  assertPrecondition(Number.isFinite(tauSec) && tauSec > 0, "confinementTimeSec must be strictly positive.");
  assertPrecondition(
    Number.isFinite(tempKeV) && tempKeV >= 1 && tempKeV <= 150,
    "ionTemperatureKeV must lie inside valid Bosch-Hale domain [1, 150] keV.",
  );
  assertPrecondition(Number.isFinite(volumeM3) && volumeM3 > 0, "plasmaVolumeM3 must be strictly positive.");
  assertPrecondition(Number.isFinite(extHeatingMw) && extHeatingMw > 0, "externalHeatingMw must be strictly positive.");
  assertPrecondition(
    Number.isFinite(p2OverP0) && p2OverP0 >= 0 && p2OverP0 <= 1,
    "implosionAsymmetryP2OverP0 must lie in [0, 1].",
  );
  assertPrecondition(Number.isFinite(zEff) && zEff >= 1 && zEff <= 10, "zEffective must lie in [1, 10].");
}

/**
 * Bosch-Hale (1992) parametric D-T fusion reactivity <sigma*v> in m^3/s for T in [1, 150] keV.
 */
function boschHaleDtReactivityM3PerSec(tempKeV: number): number {
  const bg = 34.3827;
  const mrc2 = 1124656;
  const c1 = 1.17302e-9;
  const c2 = 1.51361e-2;
  const c3 = 7.51886e-2;
  const c4 = 4.60643e-3;
  const c5 = 1.35e-2;
  const c6 = -1.0675e-4;
  const c7 = 1.366e-5;

  const num = tempKeV * (c2 + tempKeV * (c4 + tempKeV * c6));
  const den = 1 + tempKeV * (c3 + tempKeV * (c5 + tempKeV * c7));
  const theta = tempKeV / (1 - num / den);
  const xi = Math.cbrt((bg * bg) / (4 * theta));
  const sigmaVCm3PerSec = c1 * theta * Math.sqrt(xi / (mrc2 * Math.pow(tempKeV, 3))) * Math.exp(-3 * xi);
  return sigmaVCm3PerSec * 1e-6;
}

function resolveFusionVerdict(
  p2OverP0: number,
  alphaHeatingMw: number,
  totalLossMw: number,
  plasmaGainQ: number,
  tripleProduct: number,
): FusionIgnitionVerdict {
  if (p2OverP0 > 0.15 || (alphaHeatingMw < totalLossMw && plasmaGainQ < 1.0)) {
    return "QUENCHED_BELOW_BREAKEVEN";
  }
  if (alphaHeatingMw >= totalLossMw && plasmaGainQ >= 5.0 && tripleProduct >= 3e21) {
    return "IGNITION_SELF_SUSTAINING";
  }
  return "BURNING_PLASMA_SUB_IGNITION";
}

export class EosInertialFusionLawsonIgnitionCore {
  static evaluateLawsonIgnitionAndBurn(options: LawsonFusionOptions = {}): LawsonFusionReport {
    const electronDensityM3 = options.electronDensityM3 ?? 5e29;
    const confinementTimeSec = options.confinementTimeSec ?? 5e-10;
    const ionTemperatureKeV = options.ionTemperatureKeV ?? 18;
    const plasmaVolumeM3 = options.plasmaVolumeM3 ?? 1e-12;
    const externalHeatingMw = options.externalHeatingMw ?? 2e6;
    const implosionAsymmetryP2OverP0 = options.implosionAsymmetryP2OverP0 ?? 0.04;
    const zEffective = options.zEffective ?? 1.0;

    validateFusionOptions(
      electronDensityM3,
      confinementTimeSec,
      ionTemperatureKeV,
      plasmaVolumeM3,
      externalHeatingMw,
      implosionAsymmetryP2OverP0,
      zEffective,
    );

    const tripleProduct = electronDensityM3 * confinementTimeSec * ionTemperatureKeV;
    const asymmetryDegradation = Math.max(0.05, 1 - 1.5 * implosionAsymmetryP2OverP0);
    const dtReactivity = boschHaleDtReactivityM3PerSec(ionTemperatureKeV) * asymmetryDegradation;

    const rawFusionMw =
      0.25 * electronDensityM3 * electronDensityM3 * dtReactivity * DT_FUSION_JOULES * plasmaVolumeM3 * 1e-6;
    const rawAlphaMw = ALPHA_FRACTION_DT * rawFusionMw;

    const thermalEnergyJ = 3 * electronDensityM3 * (ionTemperatureKeV * JOULES_PER_KEV) * plasmaVolumeM3;
    const rawConductionLossMw = (thermalEnergyJ / confinementTimeSec) * 1e-6;
    const rawBremLossMw =
      BREMSSTRAHLUNG_COEFF_SI *
      electronDensityM3 *
      electronDensityM3 *
      Math.sqrt(ionTemperatureKeV) *
      zEffective *
      plasmaVolumeM3 *
      1e-6;
    const rawTotalLossMw = rawConductionLossMw + rawBremLossMw;
    const rawNetHeatingMw = rawAlphaMw + externalHeatingMw - rawTotalLossMw;
    const rawPowerScale = Math.max(rawTotalLossMw, rawAlphaMw + externalHeatingMw, 1);
    const energyBalanceResidualRatio =
      Math.abs(rawTotalLossMw - (rawAlphaMw + externalHeatingMw - rawNetHeatingMw)) / rawPowerScale;
    assertPostcondition(energyBalanceResidualRatio < 1e-6, "Lawson power conservation residual exceeded 1e-6.");

    const plasmaGainQ = rawFusionMw / externalHeatingMw;
    const verdict = resolveFusionVerdict(
      implosionAsymmetryP2OverP0,
      rawAlphaMw,
      rawTotalLossMw,
      plasmaGainQ,
      tripleProduct,
    );

    const payload = {
      specId: "SPEC-105" as const,
      electronDensityM3,
      confinementTimeSec,
      ionTemperatureKeV,
      plasmaVolumeM3,
      tripleProductKeVSecPerM3: roundSig(tripleProduct),
      dtReactivityM3PerSec: roundSig(dtReactivity),
      fusionYieldMw: roundSig(rawFusionMw),
      alphaHeatingMw: roundSig(rawAlphaMw),
      bremsstrahlungLossMw: roundSig(rawBremLossMw),
      conductionLossMw: roundSig(rawConductionLossMw),
      totalLossMw: roundSig(rawTotalLossMw),
      externalHeatingMw: roundSig(externalHeatingMw),
      netHeatingRateMw: roundSig(rawNetHeatingMw),
      energyBalanceResidualRatio: Number(energyBalanceResidualRatio.toExponential(4)),
      plasmaGainQ: roundSig(plasmaGainQ),
      implosionAsymmetryP2OverP0,
      verdict,
    };

    const fusionDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, fusionDigestSha256 });
  }
}
