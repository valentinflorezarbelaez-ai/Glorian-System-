/**
 * EOS Neuromorphic Hyper-Heuristic Planner — Types
 *
 * SPEC-352 / CHANGE-214: Autonomous Multi-Modal Neuromorphic Hyper-Heuristic Planner.
 * Strictly pure Layer-0: zero runtime external dependencies.
 */

export interface NeuronConfig {
  readonly vRest: number; // in micro-volts (e.g. -70000 µV)
  readonly vThreshold: number; // in micro-volts (e.g. -55000 µV)
  readonly vReset: number; // in micro-volts (e.g. -70000 µV)
  readonly leakFactor: number; // leakage coefficient (0.0 to 1.0)
  readonly refractoryPeriodMs: number; // refractory lockout in ms
}

export interface SpikeEvent {
  readonly neuronId: string;
  readonly timestampMs: number;
  readonly amplitudeUv: number;
}

export interface SynapseConfig {
  readonly sourceId: string;
  readonly targetId: string;
  weight: number; // clamped within [minWeight, maxWeight]
  readonly minWeight: number;
  readonly maxWeight: number;
  readonly ltpRate: number; // Long-Term Potentiation rate
  readonly ltdRate: number; // Long-Term Depression rate
}

export interface MultiModalTelemetry {
  readonly cpuSaturation: number; // [0.0, 1.0]
  readonly memoryPressure: number; // [0.0, 1.0]
  readonly agentQueueDepth: number; // [0.0, 1.0]
  readonly latencyVariance: number; // [0.0, 1.0]
  readonly errorRate: number; // [0.0, 1.0]
}

export type LowLevelHeuristicType =
  "BATCH_COALESCE" | "SPECULATIVE_DEDUPLICATION" | "PROACTIVE_BACKPRESSURE" | "CACHE_PREWARM" | "LOAD_SHED";

export interface HeuristicDescriptor {
  readonly id: LowLevelHeuristicType;
  readonly description: string;
  utilityScore: number;
  executionCount: number;
  parameters: Record<string, number | string | boolean>;
}

export interface HyperHeuristicDecision {
  readonly cycleId: string;
  readonly timestamp: string;
  readonly selectedHeuristic: LowLevelHeuristicType;
  readonly spikeTrainLength: number;
  readonly activeNeuronsCount: number;
  readonly confidence: number;
  readonly parameters: Record<string, number | string | boolean>;
}

export interface NeuromorphicAuditReceipt {
  readonly timestamp: string;
  readonly specId: string;
  readonly lifDynamicsVerified: boolean;
  readonly stdpPlasticityVerified: boolean;
  readonly sensoryEncodingVerified: boolean;
  readonly hyperHeuristicSelectionVerified: boolean;
  readonly feedbackConvergenceVerified: boolean;
  readonly tlcModelPass: boolean;
  readonly status: "HEALTHY" | "DEGRADED";
}
