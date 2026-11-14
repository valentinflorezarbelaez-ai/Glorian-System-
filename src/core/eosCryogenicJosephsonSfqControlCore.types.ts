/**
 * src/core/eosCryogenicJosephsonSfqControlCore.types.ts
 * SPEC-260 / CHANGE-129: Cryogenic Josephson Junction & SFQ Control Core Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type CryogenicJosephsonRegime =
  "OVERDAMPED_SFQ_LOCKED" | "THERMAL_HEADROOM_WARNING" | "QUASIPARTICLE_HYSTERESIS_RISK";

export interface CryogenicJosephsonSfqOptions {
  readonly cryoArrayId?: string;
  readonly mixingChamberTempMk?: number;
  readonly criticalCurrentMicroAmps?: number;
  readonly shuntResistanceOhms?: number;
  readonly junctionCapacitanceFf?: number;
  readonly sfqClockGhz?: number;
  readonly activeJunctionCount?: number;
  readonly stageCoolingCapacityMicroWatts?: number;
}

export interface CryogenicJosephsonSfqAssessment {
  readonly specId: "SPEC-260";
  readonly cryoArrayId: string;
  readonly mixingChamberTempMk: number;
  readonly criticalCurrentMicroAmps: number;
  readonly shuntResistanceOhms: number;
  readonly junctionCapacitanceFf: number;
  readonly sfqClockGhz: number;
  readonly activeJunctionCount: number;
  readonly characteristicVoltageMicroVolts: number;
  readonly characteristicFreqGhz: number;
  readonly stewartMcCumberBetaC: number;
  readonly dynamicSfqPowerMicroWatts: number;
  readonly stageCoolingCapacityMicroWatts: number;
  readonly thermalLoadRatio: number;
  readonly quasiparticleThermalNoiseGamma: number;
  readonly regime: CryogenicJosephsonRegime;
  readonly cryoSfqDigestSha256: string;
}
