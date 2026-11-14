/**
 * src/core/eosRelativisticBeamTwissLuminosityCore.ts
 * SPEC-258 / CHANGE-128: Relativistic Symplectic FODO Twiss Lattice & Luminosity Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertFiniteGreaterThan,
  assertFinitePositive,
  assertHalfOpenRightRange,
  assertIntMin,
  pickDefined,
  pickNonEmptyString,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  BeamOpticsVerdict,
  RelativisticBeamTwissOptions,
  RelativisticBeamTwissReport,
} from "./eosRelativisticBeamTwissLuminosityCore.types.ts";

type Matrix2x2 = readonly [number, number, number, number];

function mul2x2(a: Matrix2x2, b: Matrix2x2): Matrix2x2 {
  return [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
}

function computeSymplecticFodoMatrix(halfCellLengthM: number, focalLengthM: number) {
  const halfFocus: Matrix2x2 = [1, 0, -1 / (2 * focalLengthM), 1];
  const drift: Matrix2x2 = [1, halfCellLengthM, 0, 1];
  const defocus: Matrix2x2 = [1, 0, 1 / focalLengthM, 1];
  const cell = mul2x2(halfFocus, mul2x2(drift, mul2x2(defocus, mul2x2(drift, halfFocus))));
  const fodoMatrixTrace = round6(cell[0] + cell[3]);
  const symplecticDeterminant = round6(cell[0] * cell[3] - cell[1] * cell[2]);
  const fodoStable = Math.abs(fodoMatrixTrace) < 2;

  if (!fodoStable) {
    return {
      fodoMatrixTrace,
      symplecticDeterminant,
      fodoStable: false,
      phaseAdvanceDeg: 180,
      betaMaxM: 0,
      betaMinM: 0,
    };
  }

  const cosMu = Math.max(-0.999999999, Math.min(0.999999999, fodoMatrixTrace / 2));
  const muRad = Math.acos(cosMu);
  const sinHalfMu = halfCellLengthM / (2 * focalLengthM);
  const sinMu = Math.sin(muRad);
  return {
    fodoMatrixTrace,
    symplecticDeterminant,
    fodoStable: true,
    phaseAdvanceDeg: round6((muRad * 180) / Math.PI),
    betaMaxM: round6((2 * halfCellLengthM * (1 + sinHalfMu)) / sinMu),
    betaMinM: round6((2 * halfCellLengthM * (1 - sinHalfMu)) / sinMu),
  };
}

function resolveValidatedBeamParams(options: RelativisticBeamTwissOptions) {
  const restMassGev = assertFinitePositive(pickDefined(options.restMassGev, 0.938272088), "restMassGev");
  const beamEnergyGev = assertFiniteGreaterThan(
    pickDefined(options.beamEnergyGev, 6800),
    restMassGev,
    "beamEnergyGev must exceed restMassGev (ultrarelativistic gamma > 1).",
  );
  return {
    colliderId: pickNonEmptyString(options.colliderId, "HL-LHC-IP1-Optics"),
    beamEnergyGev,
    restMassGev,
    fodoHalfCellLengthM: assertFinitePositive(pickDefined(options.fodoHalfCellLengthM, 53.45), "fodoHalfCellLengthM"),
    fodoFocalLengthM: assertFinitePositive(pickDefined(options.fodoFocalLengthM, 38.0), "fodoFocalLengthM"),
    normalizedEmittanceUm: assertFinitePositive(
      pickDefined(options.normalizedEmittanceUm, 2.5),
      "normalizedEmittanceUm",
    ),
    betaStarM: assertFinitePositive(pickDefined(options.betaStarM, 0.3), "betaStarM"),
    bunchesPerBeam: assertIntMin(pickDefined(options.bunchesPerBeam, 2760), 1, "bunchesPerBeam"),
    protonsPerBunch: assertFinitePositive(pickDefined(options.protonsPerBunch, 1.15e11), "protonsPerBunch"),
    revolutionFrequencyHz: assertFinitePositive(
      pickDefined(options.revolutionFrequencyHz, 11245.5),
      "revolutionFrequencyHz",
    ),
    crossingAngleReductionFactor: assertHalfOpenRightRange(
      pickDefined(options.crossingAngleReductionFactor, 0.835),
      0,
      1,
      "crossingAngleReductionFactor must be in (0, 1].",
    ),
    bendingRadiusM: assertFinitePositive(pickDefined(options.bendingRadiusM, 2803.95), "bendingRadiusM"),
    maxSynchrotronLossKev: assertFinitePositive(
      pickDefined(options.maxSynchrotronLossKev, 15.0),
      "maxSynchrotronLossKev",
    ),
  };
}

export class EosRelativisticBeamTwissLuminosityCore {
  static evaluateRelativisticBeamTwissLuminosity(
    options: RelativisticBeamTwissOptions = {},
  ): RelativisticBeamTwissReport {
    const p = resolveValidatedBeamParams(options);
    const lorentzGamma = round6(p.beamEnergyGev / p.restMassGev);
    const relativisticBeta = Math.sqrt(Math.max(0, 1 - 1 / (lorentzGamma * lorentzGamma)));
    const fodo = computeSymplecticFodoMatrix(p.fodoHalfCellLengthM, p.fodoFocalLengthM);

    const geometricEmittanceM = (p.normalizedEmittanceUm * 1e-6) / (relativisticBeta * lorentzGamma);
    const ipBeamSigmaUm = round6(Math.sqrt(geometricEmittanceM * p.betaStarM) * 1e6);
    const sigmaCm = ipBeamSigmaUm * 1e-4;
    const luminosityCm2s =
      (p.bunchesPerBeam *
        p.protonsPerBunch *
        p.protonsPerBunch *
        p.revolutionFrequencyHz *
        p.crossingAngleReductionFactor) /
      (4 * Math.PI * sigmaCm * sigmaCm);

    const protonMassRef = 0.938272088;
    const synchrotronLossKevPerTurn = round6(
      7.79e-12 * Math.pow(protonMassRef / p.restMassGev, 4) * (Math.pow(p.beamEnergyGev, 4) / p.bendingRadiusM),
    );

    const verdict: BeamOpticsVerdict = !fodo.fodoStable
      ? "LATTICE_RESONANCE_UNSTABLE"
      : synchrotronLossKevPerTurn > p.maxSynchrotronLossKev
        ? "SYNCHROTRON_LOSS_ELEVATED"
        : "BEAM_OPTICS_LUMINOSITY_LOCKED";

    const payload = {
      specId: "SPEC-258" as const,
      colliderId: p.colliderId,
      beamEnergyGev: p.beamEnergyGev,
      lorentzGamma,
      relativisticBeta,
      fodoMatrixTrace: fodo.fodoMatrixTrace,
      symplecticDeterminant: fodo.symplecticDeterminant,
      fodoStable: fodo.fodoStable,
      phaseAdvanceDeg: fodo.phaseAdvanceDeg,
      betaMaxM: fodo.betaMaxM,
      betaMinM: fodo.betaMinM,
      geometricEmittanceM,
      ipBeamSigmaUm,
      luminosityCm2s,
      synchrotronLossKevPerTurn,
      verdict,
    };
    const beamOpticsDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, beamOpticsDigestSha256 });
  }
}

export const evaluateRelativisticBeamTwissLuminosity =
  EosRelativisticBeamTwissLuminosityCore.evaluateRelativisticBeamTwissLuminosity;
