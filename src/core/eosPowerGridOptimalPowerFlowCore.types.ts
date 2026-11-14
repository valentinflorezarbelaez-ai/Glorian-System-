/**
 * SPEC-103 / CHANGE-127 — UHV DC-OPF & Hyperscale Frequency Stability Types.
 */

export type GridOpfVerdict = "GRID_OPF_STABLE" | "THERMAL_OR_FREQUENCY_STRESS" | "BLACKOUT_LOAD_SHED_REQUIRED";

export interface GridGeneratorUnit {
  readonly id: string;
  readonly marginalCostPerMwh: number;
  readonly minOutputMw: number;
  readonly maxOutputMw: number;
  readonly droopPercent?: number;
  readonly online?: boolean;
}

export interface TransmissionCorridor {
  readonly id: string;
  readonly thermalLimitMw: number;
  readonly flowMw?: number;
  readonly baseLoadShareRatio?: number;
}

export interface GridOpfOptions {
  readonly nominalFrequencyHz?: 50 | 60;
  readonly systemInertiaSec?: number;
  readonly baseSystemMva?: number;
  readonly totalDemandMw?: number;
  readonly datacenterStepLoadMw?: number;
  readonly generators?: readonly GridGeneratorUnit[];
  readonly corridors?: readonly TransmissionCorridor[];
}

export interface GeneratorDispatchAllocation {
  readonly id: string;
  readonly dispatchedMw: number;
  readonly utilizationRatio: number;
  readonly hourlyCostUsd: number;
}

export interface CorridorFlowStatus {
  readonly id: string;
  readonly flowMw: number;
  readonly thermalLimitMw: number;
  readonly loadingRatio: number;
}

export interface GridOpfReport {
  readonly specId: "SPEC-103";
  readonly nominalFrequencyHz: 50 | 60;
  readonly totalRequiredMw: number;
  readonly totalDispatchedMw: number;
  readonly unservedDemandMw: number;
  readonly totalDispatchCostPerHour: number;
  readonly allocations: readonly GeneratorDispatchAllocation[];
  readonly corridorFlows: readonly CorridorFlowStatus[];
  readonly maxLineLoadingRatio: number;
  readonly deltaFreqHz: number;
  readonly nadirFrequencyHz: number;
  readonly rocofHzPerSec: number;
  readonly minBusVoltagePu: number;
  readonly verdict: GridOpfVerdict;
  readonly gridOpfDigestSha256: string;
}
