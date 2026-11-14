/**
 * src/core/eosUnifiedMemoryDmaDvfsQosCore.types.ts
 * SPEC-257 / CHANGE-128: Unified Memory Fabric DMA Arbitration, DVFS & Thermal QoS Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type DvfsPState = "P0_TURBO" | "P1_NOMINAL" | "P1_EFFICIENCY_CLAMP" | "P2_BW_THROTTLED" | "P3_THERMAL_EMERGENCY";

export type UnifiedMemoryQosVerdict =
  "QOS_AND_THERMAL_NOMINAL" | "DVFS_PSTATE_THROTTLED" | "THERMAL_OR_BANDWIDTH_SATURATED";

export interface DmaQosStreamSpec {
  readonly streamId: string;
  readonly priority: number;
  readonly requestedGBps: number;
}

export interface DmaQosStreamGrant {
  readonly streamId: string;
  readonly priority: number;
  readonly requestedGBps: number;
  readonly grantedGBps: number;
  readonly fulfilled: boolean;
}

export interface UnifiedMemoryDmaDvfsQosOptions {
  readonly socProfile?: string;
  readonly totalUnifiedBandwidthGBps?: number;
  readonly streams?: readonly DmaQosStreamSpec[];
  readonly effectiveCapacitanceNf?: number;
  readonly voltageVolts?: number;
  readonly frequencyGhz?: number;
  readonly staticLeakageWatts?: number;
  readonly ambientTempC?: number;
  readonly thermalResistanceCPerW?: number;
  readonly maxJunctionTempC?: number;
}

export interface UnifiedMemoryDmaDvfsQosReport {
  readonly specId: "SPEC-257";
  readonly socProfile: string;
  readonly totalUnifiedBandwidthGBps: number;
  readonly totalRequestedGBps: number;
  readonly totalGrantedGBps: number;
  readonly utilizationRatio: number;
  readonly dynamicPowerWatts: number;
  readonly totalPackagePowerWatts: number;
  readonly junctionTempC: number;
  readonly maxJunctionTempC: number;
  readonly pState: DvfsPState;
  readonly grantedStreams: readonly DmaQosStreamGrant[];
  readonly verdict: UnifiedMemoryQosVerdict;
  readonly dvfsQosDigestSha256: string;
}
