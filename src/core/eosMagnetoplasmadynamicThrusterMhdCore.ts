/**
 * src/core/eosMagnetoplasmadynamicThrusterMhdCore.ts
 * SPEC-266 / CHANGE-130: Magnetoplasmadynamic (MPD) Thruster & Lorentz MHD Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertFiniteNonNegative,
  assertFinitePositive,
  pickDefined,
  pickNonEmptyString,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  MpdThrusterMhdAssessment,
  MpdThrusterMhdOptions,
  MpdThrusterRegime,
} from "./eosMagnetoplasmadynamicThrusterMhdCore.types.ts";

export const DEFAULT_MPD_THRUSTER_MHD_OPTIONS: Readonly<Required<MpdThrusterMhdOptions>> = deepFreeze({
  thrusterId: "AF-MPD-LITHIUM-500KW-01",
  dischargeCurrentAmps: 4200.0,
  appliedMagneticFieldTesla: 0.18,
  massFlowRateKgPerSec: 0.0012,
  anodeRadiusMeters: 0.055,
  cathodeRadiusMeters: 0.012,
  inputPowerKw: 450.0,
  propellantAtomicMassAmu: 6.94,
});

function resolveValidatedMpdParams(options: MpdThrusterMhdOptions) {
  const d = DEFAULT_MPD_THRUSTER_MHD_OPTIONS;
  const anodeRadiusMeters = assertFinitePositive(
    pickDefined(options.anodeRadiusMeters, d.anodeRadiusMeters),
    "anodeRadiusMeters",
  );
  const cathodeRadiusMeters = assertFinitePositive(
    pickDefined(options.cathodeRadiusMeters, d.cathodeRadiusMeters),
    "cathodeRadiusMeters",
  );
  assertPrecondition(
    anodeRadiusMeters > cathodeRadiusMeters,
    `anodeRadiusMeters (${anodeRadiusMeters}) must exceed cathodeRadiusMeters (${cathodeRadiusMeters})`,
  );
  return {
    thrusterId: pickNonEmptyString(options.thrusterId, d.thrusterId),
    dischargeCurrentAmps: assertFinitePositive(
      pickDefined(options.dischargeCurrentAmps, d.dischargeCurrentAmps),
      "dischargeCurrentAmps",
    ),
    appliedMagneticFieldTesla: assertFiniteNonNegative(
      pickDefined(options.appliedMagneticFieldTesla, d.appliedMagneticFieldTesla),
      "appliedMagneticFieldTesla",
    ),
    massFlowRateKgPerSec: assertFinitePositive(
      pickDefined(options.massFlowRateKgPerSec, d.massFlowRateKgPerSec),
      "massFlowRateKgPerSec",
    ),
    anodeRadiusMeters,
    cathodeRadiusMeters,
    inputPowerKw: assertFinitePositive(pickDefined(options.inputPowerKw, d.inputPowerKw), "inputPowerKw"),
    propellantAtomicMassAmu: assertFinitePositive(
      pickDefined(options.propellantAtomicMassAmu, d.propellantAtomicMassAmu),
      "propellantAtomicMassAmu",
    ),
  };
}

function classifyMpdRegime(onsetStabilityRatio: number): MpdThrusterRegime {
  if (onsetStabilityRatio > 1.0) return "ONSET_INSTABILITY_CRITICAL";
  if (onsetStabilityRatio > 0.85) return "ANODE_FALL_EROSION_WARNING";
  return "LORENTZ_PLASMA_ACCELERATION_LOCKED";
}

export class EosMagnetoplasmadynamicThrusterMhdCore {
  static evaluateMagnetoplasmadynamicThrusterMhd(options: MpdThrusterMhdOptions = {}): MpdThrusterMhdAssessment {
    const p = resolveValidatedMpdParams(options);
    const selfFieldThrustNewtons = round6(
      1e-7 *
        p.dischargeCurrentAmps *
        p.dischargeCurrentAmps *
        (Math.log(p.anodeRadiusMeters / p.cathodeRadiusMeters) + 0.75),
    );
    const appliedFieldThrustNewtons = round6(
      1.15 * p.dischargeCurrentAmps * p.appliedMagneticFieldTesla * p.anodeRadiusMeters,
    );
    const totalThrustNewtons = round6(selfFieldThrustNewtons + appliedFieldThrustNewtons);
    const exhaustVelocityMPerSec = round6(totalThrustNewtons / p.massFlowRateKgPerSec);
    const specificImpulseSec = round6(exhaustVelocityMPerSec / 9.80665);
    const onsetCriticalCurrentAmps = round6(
      (260000 * Math.sqrt(p.massFlowRateKgPerSec)) / Math.pow(p.propellantAtomicMassAmu, 0.25),
    );
    const onsetStabilityRatio = round6(p.dischargeCurrentAmps / onsetCriticalCurrentAmps);
    const thrustEfficiency = round6(
      Math.min(
        0.95,
        (totalThrustNewtons * totalThrustNewtons) / (2 * p.massFlowRateKgPerSec * (p.inputPowerKw * 1000)),
      ),
    );
    const regime = classifyMpdRegime(onsetStabilityRatio);

    const payload = {
      specId: "SPEC-266" as const,
      ...p,
      selfFieldThrustNewtons,
      appliedFieldThrustNewtons,
      totalThrustNewtons,
      exhaustVelocityMPerSec,
      specificImpulseSec,
      onsetCriticalCurrentAmps,
      onsetStabilityRatio,
      thrustEfficiency,
      regime,
    };
    return deepFreeze({
      ...payload,
      mpdThrusterDigestSha256: pureSha256(JSON.stringify(payload)),
    });
  }
}

export function evaluateMagnetoplasmadynamicThrusterMhd(options: MpdThrusterMhdOptions = {}): MpdThrusterMhdAssessment {
  return EosMagnetoplasmadynamicThrusterMhdCore.evaluateMagnetoplasmadynamicThrusterMhd(options);
}
