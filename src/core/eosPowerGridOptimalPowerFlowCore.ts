/**
 * SPEC-103 / CHANGE-127 — Layer-0 DC Optimal Power Flow & Frequency Stability Core.
 * Inspired by State Grid UHV transmission control & hyperscale AI cluster grid droop.
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  CorridorFlowStatus,
  GeneratorDispatchAllocation,
  GridGeneratorUnit,
  GridOpfOptions,
  GridOpfReport,
  GridOpfVerdict,
  TransmissionCorridor,
} from "./eosPowerGridOptimalPowerFlowCore.types.ts";

export type {
  CorridorFlowStatus,
  GeneratorDispatchAllocation,
  GridGeneratorUnit,
  GridOpfOptions,
  GridOpfReport,
  GridOpfVerdict,
  TransmissionCorridor,
} from "./eosPowerGridOptimalPowerFlowCore.types.ts";

const DEFAULT_GENERATORS: readonly GridGeneratorUnit[] = [
  { id: "GEN-NUCLEAR-BASE", marginalCostPerMwh: 14, minOutputMw: 600, maxOutputMw: 2000, droopPercent: 4 },
  { id: "GEN-HYDRO-FLEX", marginalCostPerMwh: 22, minOutputMw: 200, maxOutputMw: 1400, droopPercent: 4 },
  { id: "GEN-CCGT-GAS", marginalCostPerMwh: 44, minOutputMw: 100, maxOutputMw: 1400, droopPercent: 5 },
  { id: "GEN-PEAKER-TURBINE", marginalCostPerMwh: 82, minOutputMw: 0, maxOutputMw: 700, droopPercent: 5 },
];

const DEFAULT_CORRIDORS: readonly TransmissionCorridor[] = [
  { id: "UHV-NORTH-AI-TRUNK", thermalLimitMw: 2600, baseLoadShareRatio: 0.42 },
  { id: "UHV-HYDRO-SPINE", thermalLimitMw: 2100, baseLoadShareRatio: 0.34 },
  { id: "UHV-METRO-TIE", thermalLimitMw: 1800, baseLoadShareRatio: 0.24 },
];

function round4(v: number): number {
  return Number(v.toFixed(4));
}

function validateGridOptions(
  nominalFrequencyHz: number,
  systemInertiaSec: number,
  totalDemandMw: number,
  datacenterStepLoadMw: number,
  generators: readonly GridGeneratorUnit[],
  corridors: readonly TransmissionCorridor[],
): void {
  assertPrecondition(nominalFrequencyHz === 50 || nominalFrequencyHz === 60, "nominalFrequencyHz must be 50 or 60.");
  assertPrecondition(Number.isFinite(systemInertiaSec) && systemInertiaSec > 0, "systemInertiaSec must be > 0.");
  assertPrecondition(Number.isFinite(totalDemandMw) && totalDemandMw > 0, "totalDemandMw must be > 0.");
  assertPrecondition(
    Number.isFinite(datacenterStepLoadMw) && datacenterStepLoadMw >= 0,
    "datacenterStepLoadMw must be >= 0.",
  );
  assertPrecondition(generators.length > 0, "At least one generator unit is required.");
  for (const unit of generators) {
    assertPrecondition(unit.maxOutputMw > 0 && unit.minOutputMw >= 0, `Invalid capacity bounds on unit ${unit.id}.`);
    assertPrecondition(unit.minOutputMw <= unit.maxOutputMw, `minOutputMw > maxOutputMw on unit ${unit.id}.`);
  }
  assertPrecondition(corridors.length > 0, "At least one transmission corridor is required.");
}

function dispatchMeritOrder(
  generators: readonly GridGeneratorUnit[],
  totalRequiredMw: number,
): {
  readonly allocations: readonly GeneratorDispatchAllocation[];
  readonly totalDispatchedMw: number;
  readonly totalCost: number;
  readonly betaMwPerHz: (nominalHz: number) => number;
} {
  const onlineUnits = generators
    .filter((u) => u.online !== false)
    .slice()
    .sort((a, b) => a.marginalCostPerMwh - b.marginalCostPerMwh || a.id.localeCompare(b.id));

  let remaining = totalRequiredMw;
  const minBooked = new Map<string, number>();
  for (const u of onlineUnits) {
    const commit = Math.min(u.minOutputMw, remaining);
    minBooked.set(u.id, commit);
    remaining -= commit;
  }

  let totalDispatchedMw = 0;
  let totalCost = 0;
  const allocations: GeneratorDispatchAllocation[] = [];
  for (const u of onlineUnits) {
    const base = minBooked.get(u.id) ?? 0;
    const headroom = Math.max(0, u.maxOutputMw - base);
    const extra = Math.min(headroom, Math.max(0, remaining));
    remaining -= extra;
    const dispatched = round4(base + extra);
    totalDispatchedMw += dispatched;
    totalCost += dispatched * u.marginalCostPerMwh;
    allocations.push({
      id: u.id,
      dispatchedMw: dispatched,
      utilizationRatio: round4(dispatched / u.maxOutputMw),
      hourlyCostUsd: round4(dispatched * u.marginalCostPerMwh),
    });
  }

  const betaMwPerHz = (nominalHz: number): number =>
    onlineUnits.reduce((acc, u) => acc + u.maxOutputMw / (((u.droopPercent ?? 4) / 100) * nominalHz), 0);

  return {
    allocations,
    totalDispatchedMw: round4(totalDispatchedMw),
    totalCost: round4(totalCost),
    betaMwPerHz,
  };
}

function resolveGridVerdict(
  unservedDemandMw: number,
  maxLineLoadingRatio: number,
  deltaFreqHz: number,
  nadirFrequencyHz: number,
  nominalFrequencyHz: 50 | 60,
  rocofHzPerSec: number,
): GridOpfVerdict {
  if (unservedDemandMw > 1e-6 || maxLineLoadingRatio > 1.2 || nadirFrequencyHz < nominalFrequencyHz - 1.2) {
    return "BLACKOUT_LOAD_SHED_REQUIRED";
  }
  if (maxLineLoadingRatio >= 0.9 || Math.abs(deltaFreqHz) > 0.3 || rocofHzPerSec > 0.5) {
    return "THERMAL_OR_FREQUENCY_STRESS";
  }
  return "GRID_OPF_STABLE";
}

export class EosPowerGridOptimalPowerFlowCore {
  static solveDcOpfAndFrequencyStability(options: GridOpfOptions = {}): GridOpfReport {
    const nominalFrequencyHz: 50 | 60 = options.nominalFrequencyHz ?? 60;
    const systemInertiaSec = options.systemInertiaSec ?? 5.5;
    const totalDemandMw = options.totalDemandMw ?? 4200;
    const datacenterStepLoadMw = options.datacenterStepLoadMw ?? 120;
    const generators = options.generators ?? DEFAULT_GENERATORS;
    const corridors = options.corridors ?? DEFAULT_CORRIDORS;

    validateGridOptions(
      nominalFrequencyHz,
      systemInertiaSec,
      totalDemandMw,
      datacenterStepLoadMw,
      generators,
      corridors,
    );

    const totalRequiredMw = round4(totalDemandMw + datacenterStepLoadMw);
    const dispatch = dispatchMeritOrder(generators, totalRequiredMw);
    const unservedDemandMw = round4(Math.max(0, totalRequiredMw - dispatch.totalDispatchedMw));

    const corridorFlows: CorridorFlowStatus[] = corridors.map((c) => {
      assertPrecondition(c.thermalLimitMw > 0, `Corridor ${c.id} thermalLimitMw must be > 0.`);
      const flowMw = round4(
        c.flowMw !== undefined ? c.flowMw : dispatch.totalDispatchedMw * (c.baseLoadShareRatio ?? 1 / corridors.length),
      );
      return {
        id: c.id,
        flowMw,
        thermalLimitMw: c.thermalLimitMw,
        loadingRatio: round4(Math.abs(flowMw) / c.thermalLimitMw),
      };
    });

    const maxLineLoadingRatio = round4(Math.max(...corridorFlows.map((c) => c.loadingRatio)));
    const totalOnlineCapacity = generators.filter((u) => u.online !== false).reduce((a, u) => a + u.maxOutputMw, 0);
    const effectiveSystemMva = Math.max(options.baseSystemMva ?? totalOnlineCapacity, 1);
    const stiffness = Math.max(dispatch.betaMwPerHz(nominalFrequencyHz), 1e-6);

    const deltaFreqHz = round4(-datacenterStepLoadMw / stiffness);
    const nadirFrequencyHz = round4(nominalFrequencyHz + deltaFreqHz * 1.15);
    const rocofHzPerSec = round4(
      (datacenterStepLoadMw * nominalFrequencyHz) / (2 * systemInertiaSec * effectiveSystemMva),
    );
    const minBusVoltagePu = round4(
      Math.max(0.75, 1.0 - 0.08 * Math.max(0, maxLineLoadingRatio - 0.5) - (unservedDemandMw > 0 ? 0.12 : 0)),
    );

    const verdict = resolveGridVerdict(
      unservedDemandMw,
      maxLineLoadingRatio,
      deltaFreqHz,
      nadirFrequencyHz,
      nominalFrequencyHz,
      rocofHzPerSec,
    );

    const payload = {
      specId: "SPEC-103" as const,
      nominalFrequencyHz,
      totalRequiredMw,
      totalDispatchedMw: dispatch.totalDispatchedMw,
      unservedDemandMw,
      totalDispatchCostPerHour: dispatch.totalCost,
      allocations: dispatch.allocations,
      corridorFlows,
      maxLineLoadingRatio,
      deltaFreqHz,
      nadirFrequencyHz,
      rocofHzPerSec,
      minBusVoltagePu,
      verdict,
    };

    const gridOpfDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, gridOpfDigestSha256 });
  }
}
