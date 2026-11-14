/**
 * src/core/eosUnifiedMemoryDmaDvfsQosCore.ts
 * SPEC-257 / CHANGE-128: Unified Memory Fabric DMA Arbitration, DVFS & Thermal QoS Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertClosedRange,
  assertFiniteGreaterThan,
  assertFiniteNonNegative,
  assertFinitePositive,
  pickDefined,
  pickNonEmptyString,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  DmaQosStreamGrant,
  DmaQosStreamSpec,
  DvfsPState,
  UnifiedMemoryDmaDvfsQosOptions,
  UnifiedMemoryDmaDvfsQosReport,
  UnifiedMemoryQosVerdict,
} from "./eosUnifiedMemoryDmaDvfsQosCore.types.ts";

const DEFAULT_DMA_STREAMS: readonly DmaQosStreamSpec[] = [
  { streamId: "DISPLAY_SCANOUT", priority: 0, requestedGBps: 120 },
  { streamId: "NPU_TENSOR_DMA", priority: 1, requestedGBps: 320 },
  { streamId: "GPU_UNIFIED_POOL", priority: 2, requestedGBps: 200 },
  { streamId: "PCIE_NVME_INGRESS", priority: 3, requestedGBps: 80 },
];

function validateDmaStreams(streams: readonly DmaQosStreamSpec[]): readonly DmaQosStreamSpec[] {
  assertPrecondition(streams.length >= 1, "streams must contain at least one DMA stream.");
  for (const s of streams) {
    assertPrecondition(s.streamId.trim().length > 0, "Each DMA stream requires a non-empty streamId.");
    assertFiniteNonNegative(s.priority, "stream.priority");
    assertFiniteNonNegative(s.requestedGBps, "stream.requestedGBps");
  }
  return streams;
}

function resolveValidatedDvfsParams(options: UnifiedMemoryDmaDvfsQosOptions) {
  return {
    socProfile: pickNonEmptyString(options.socProfile, "Glorian-Neural-UMem-SoC"),
    totalUnifiedBandwidthGBps: assertFinitePositive(
      pickDefined(options.totalUnifiedBandwidthGBps, 800),
      "totalUnifiedBandwidthGBps",
    ),
    streams: validateDmaStreams(pickDefined(options.streams, DEFAULT_DMA_STREAMS)),
    effectiveCapacitanceNf: assertFinitePositive(
      pickDefined(options.effectiveCapacitanceNf, 18.5),
      "effectiveCapacitanceNf",
    ),
    voltageVolts: assertClosedRange(
      pickDefined(options.voltageVolts, 0.85),
      0.4,
      1.6,
      "voltageVolts must lie within electrical bounds [0.4, 1.6] V.",
    ),
    frequencyGhz: assertClosedRange(
      pickDefined(options.frequencyGhz, 3.2),
      0.2,
      6.5,
      "frequencyGhz must lie within [0.2, 6.5] GHz.",
    ),
    staticLeakageWatts: assertFiniteNonNegative(pickDefined(options.staticLeakageWatts, 6.0), "staticLeakageWatts"),
    ambientTempC: assertClosedRange(
      pickDefined(options.ambientTempC, 32.0),
      -20,
      85,
      "ambientTempC must be in [-20, 85] C.",
    ),
    thermalResistanceCPerW: assertFinitePositive(
      pickDefined(options.thermalResistanceCPerW, 0.42),
      "thermalResistanceCPerW",
    ),
    maxJunctionTempC: assertFiniteGreaterThan(
      pickDefined(options.maxJunctionTempC, 95.0),
      50,
      "maxJunctionTempC must be > 50 C.",
    ),
  };
}

function arbitrateDmaStreams(
  streams: readonly DmaQosStreamSpec[],
  capacityGBps: number,
): { grantedStreams: readonly DmaQosStreamGrant[]; totalRequestedGBps: number; totalGrantedGBps: number } {
  const ordered = [...streams].sort((a, b) => a.priority - b.priority || a.streamId.localeCompare(b.streamId));
  let remaining = capacityGBps;
  let totalRequested = 0;
  let totalGranted = 0;
  const grants: DmaQosStreamGrant[] = [];

  for (const s of ordered) {
    totalRequested += s.requestedGBps;
    const granted = round6(Math.min(s.requestedGBps, remaining));
    remaining = round6(Math.max(0, remaining - granted));
    totalGranted += granted;
    grants.push(
      deepFreeze({
        streamId: s.streamId,
        priority: s.priority,
        requestedGBps: s.requestedGBps,
        grantedGBps: granted,
        fulfilled: granted >= s.requestedGBps - 1e-9,
      }),
    );
  }
  return {
    grantedStreams: grants,
    totalRequestedGBps: round6(totalRequested),
    totalGrantedGBps: round6(totalGranted),
  };
}

function classifyDvfsThermalState(
  junctionTempC: number,
  maxJunctionTempC: number,
  utilizationRatio: number,
  frequencyGhz: number,
): { pState: DvfsPState; verdict: UnifiedMemoryQosVerdict } {
  if (junctionTempC > maxJunctionTempC + 10) {
    return { pState: "P3_THERMAL_EMERGENCY", verdict: "THERMAL_OR_BANDWIDTH_SATURATED" };
  }
  if (utilizationRatio > 1.0) {
    return { pState: "P2_BW_THROTTLED", verdict: "THERMAL_OR_BANDWIDTH_SATURATED" };
  }
  if (junctionTempC > maxJunctionTempC || utilizationRatio > 0.95) {
    return { pState: "P1_EFFICIENCY_CLAMP", verdict: "DVFS_PSTATE_THROTTLED" };
  }
  return {
    pState: frequencyGhz >= 3.0 ? "P0_TURBO" : "P1_NOMINAL",
    verdict: "QOS_AND_THERMAL_NOMINAL",
  };
}

export class EosUnifiedMemoryDmaDvfsQosCore {
  static evaluateUnifiedMemoryDmaDvfsQos(options: UnifiedMemoryDmaDvfsQosOptions = {}): UnifiedMemoryDmaDvfsQosReport {
    const p = resolveValidatedDvfsParams(options);
    const { grantedStreams, totalRequestedGBps, totalGrantedGBps } = arbitrateDmaStreams(
      p.streams,
      p.totalUnifiedBandwidthGBps,
    );
    const utilizationRatio = round6(totalRequestedGBps / p.totalUnifiedBandwidthGBps);
    const dynamicPowerWatts = round6(p.effectiveCapacitanceNf * p.voltageVolts * p.voltageVolts * p.frequencyGhz);
    const totalPackagePowerWatts = round6(dynamicPowerWatts + p.staticLeakageWatts);
    const junctionTempC = round6(p.ambientTempC + totalPackagePowerWatts * p.thermalResistanceCPerW);
    const { pState, verdict } = classifyDvfsThermalState(
      junctionTempC,
      p.maxJunctionTempC,
      utilizationRatio,
      p.frequencyGhz,
    );

    const payload = {
      specId: "SPEC-257" as const,
      socProfile: p.socProfile,
      totalUnifiedBandwidthGBps: p.totalUnifiedBandwidthGBps,
      totalRequestedGBps,
      totalGrantedGBps,
      utilizationRatio,
      dynamicPowerWatts,
      totalPackagePowerWatts,
      junctionTempC,
      maxJunctionTempC: p.maxJunctionTempC,
      pState,
      grantedStreams,
      verdict,
    };
    const dvfsQosDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, dvfsQosDigestSha256 });
  }
}

export const evaluateUnifiedMemoryDmaDvfsQos = EosUnifiedMemoryDmaDvfsQosCore.evaluateUnifiedMemoryDmaDvfsQos;
