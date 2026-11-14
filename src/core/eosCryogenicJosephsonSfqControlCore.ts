/**
 * src/core/eosCryogenicJosephsonSfqControlCore.ts
 * SPEC-260 / CHANGE-129: Cryogenic Josephson Junction & SFQ Control Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertFinitePositive,
  assertIntMin,
  pickDefined,
  pickNonEmptyString,
  round12,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  CryogenicJosephsonRegime,
  CryogenicJosephsonSfqAssessment,
  CryogenicJosephsonSfqOptions,
} from "./eosCryogenicJosephsonSfqControlCore.types.ts";

const FLUX_QUANTUM_PHI0_WB = 2.067833848e-15;
const ELECTRON_CHARGE_C = 1.602176634e-19;
const BOLTZMANN_J_PER_K = 1.380649e-23;
const REDUCED_PLANCK_J_S = 1.054571817e-34;
const SFQ_ACTIVITY_FACTOR = 0.15;

export const DEFAULT_CRYOGENIC_JOSEPHSON_SFQ_OPTIONS: Readonly<Required<CryogenicJosephsonSfqOptions>> = deepFreeze({
  cryoArrayId: "CRYO-SFQ-15MK-STAGE-01",
  mixingChamberTempMk: 15.0,
  criticalCurrentMicroAmps: 250.0,
  shuntResistanceOhms: 2.08,
  junctionCapacitanceFf: 180.0,
  sfqClockGhz: 28.0,
  activeJunctionCount: 65536,
  stageCoolingCapacityMicroWatts: 700.0,
});

function resolveValidatedCryoParams(options: CryogenicJosephsonSfqOptions) {
  return {
    cryoArrayId: pickNonEmptyString(options.cryoArrayId, DEFAULT_CRYOGENIC_JOSEPHSON_SFQ_OPTIONS.cryoArrayId),
    mixingChamberTempMk: assertFinitePositive(
      pickDefined(options.mixingChamberTempMk, DEFAULT_CRYOGENIC_JOSEPHSON_SFQ_OPTIONS.mixingChamberTempMk),
      "mixingChamberTempMk",
    ),
    criticalCurrentMicroAmps: assertFinitePositive(
      pickDefined(options.criticalCurrentMicroAmps, DEFAULT_CRYOGENIC_JOSEPHSON_SFQ_OPTIONS.criticalCurrentMicroAmps),
      "criticalCurrentMicroAmps",
    ),
    shuntResistanceOhms: assertFinitePositive(
      pickDefined(options.shuntResistanceOhms, DEFAULT_CRYOGENIC_JOSEPHSON_SFQ_OPTIONS.shuntResistanceOhms),
      "shuntResistanceOhms",
    ),
    junctionCapacitanceFf: assertFinitePositive(
      pickDefined(options.junctionCapacitanceFf, DEFAULT_CRYOGENIC_JOSEPHSON_SFQ_OPTIONS.junctionCapacitanceFf),
      "junctionCapacitanceFf",
    ),
    sfqClockGhz: assertFinitePositive(
      pickDefined(options.sfqClockGhz, DEFAULT_CRYOGENIC_JOSEPHSON_SFQ_OPTIONS.sfqClockGhz),
      "sfqClockGhz",
    ),
    activeJunctionCount: assertIntMin(
      pickDefined(options.activeJunctionCount, DEFAULT_CRYOGENIC_JOSEPHSON_SFQ_OPTIONS.activeJunctionCount),
      1,
      "activeJunctionCount",
    ),
    stageCoolingCapacityMicroWatts: assertFinitePositive(
      pickDefined(
        options.stageCoolingCapacityMicroWatts,
        DEFAULT_CRYOGENIC_JOSEPHSON_SFQ_OPTIONS.stageCoolingCapacityMicroWatts,
      ),
      "stageCoolingCapacityMicroWatts",
    ),
  };
}

function classifyCryoRegime(betaC: number, thermalLoadRatio: number, tempMk: number): CryogenicJosephsonRegime {
  if (betaC > 1.0 || thermalLoadRatio > 1.0 || tempMk > 100.0) return "QUASIPARTICLE_HYSTERESIS_RISK";
  if (betaC > 0.85 || thermalLoadRatio > 0.75) return "THERMAL_HEADROOM_WARNING";
  return "OVERDAMPED_SFQ_LOCKED";
}

export class EosCryogenicJosephsonSfqControlCore {
  static evaluateCryogenicJosephsonSfqControl(
    options: CryogenicJosephsonSfqOptions = {},
  ): CryogenicJosephsonSfqAssessment {
    const p = resolveValidatedCryoParams(options);
    const icAmps = p.criticalCurrentMicroAmps * 1e-6;
    const capFarads = p.junctionCapacitanceFf * 1e-15;

    const characteristicVoltageMicroVolts = round6(p.criticalCurrentMicroAmps * p.shuntResistanceOhms);
    const characteristicFreqGhz = round6((characteristicVoltageMicroVolts * 1e-6) / (FLUX_QUANTUM_PHI0_WB * 1e9));
    const stewartMcCumberBetaC = round6(
      (2 * Math.PI * icAmps * p.shuntResistanceOhms * p.shuntResistanceOhms * capFarads) / FLUX_QUANTUM_PHI0_WB,
    );

    const dynamicSfqPowerMicroWatts = round6(
      p.activeJunctionCount *
        p.criticalCurrentMicroAmps *
        FLUX_QUANTUM_PHI0_WB *
        (p.sfqClockGhz * 1e9) *
        SFQ_ACTIVITY_FACTOR,
    );
    const thermalLoadRatio = round6(dynamicSfqPowerMicroWatts / p.stageCoolingCapacityMicroWatts);
    const quasiparticleThermalNoiseGamma = round12(
      (2 * ELECTRON_CHARGE_C * BOLTZMANN_J_PER_K * (p.mixingChamberTempMk * 1e-3)) / (REDUCED_PLANCK_J_S * icAmps),
    );
    const regime = classifyCryoRegime(stewartMcCumberBetaC, thermalLoadRatio, p.mixingChamberTempMk);

    const payload = {
      specId: "SPEC-260" as const,
      cryoArrayId: p.cryoArrayId,
      mixingChamberTempMk: p.mixingChamberTempMk,
      criticalCurrentMicroAmps: p.criticalCurrentMicroAmps,
      shuntResistanceOhms: p.shuntResistanceOhms,
      junctionCapacitanceFf: p.junctionCapacitanceFf,
      sfqClockGhz: p.sfqClockGhz,
      activeJunctionCount: p.activeJunctionCount,
      characteristicVoltageMicroVolts,
      characteristicFreqGhz,
      stewartMcCumberBetaC,
      dynamicSfqPowerMicroWatts,
      stageCoolingCapacityMicroWatts: p.stageCoolingCapacityMicroWatts,
      thermalLoadRatio,
      quasiparticleThermalNoiseGamma,
      regime,
    };
    const cryoSfqDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, cryoSfqDigestSha256 });
  }

  evaluate(options: CryogenicJosephsonSfqOptions = {}): CryogenicJosephsonSfqAssessment {
    return EosCryogenicJosephsonSfqControlCore.evaluateCryogenicJosephsonSfqControl(options);
  }
}

export const evaluateCryogenicJosephsonSfqControl =
  EosCryogenicJosephsonSfqControlCore.evaluateCryogenicJosephsonSfqControl;
