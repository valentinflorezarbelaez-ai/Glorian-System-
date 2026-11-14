/**
 * src/core/eosQuantumEntanglementRepeaterBbpsswCore.types.ts
 * SPEC-267 / CHANGE-130: Quantum Entanglement Repeater & BBPSSW Purification Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type QuantumRepeaterRegime =
  "BELL_PAIR_DISTILLATION_LOCKED" | "DECOHERENCE_RATE_DEGRADED" | "BELOW_PURIFICATION_THRESHOLD";

export interface QuantumRepeaterBbpsswOptions {
  readonly linkTopologyId?: string;
  readonly repeaterSwapLevels?: number;
  readonly purificationRounds?: number;
  readonly rawBellPairFidelity?: number;
  readonly entanglementAttemptRateHz?: number;
  readonly memoryCoherenceTimeMs?: number;
  readonly heraldingRoundTripMs?: number;
  readonly minEndToEndFidelity?: number;
}

export interface QuantumRepeaterBbpsswAssessment {
  readonly specId: "SPEC-267";
  readonly linkTopologyId: string;
  readonly repeaterSwapLevels: number;
  readonly purificationRounds: number;
  readonly rawBellPairFidelity: number;
  readonly entanglementAttemptRateHz: number;
  readonly memoryCoherenceTimeMs: number;
  readonly heraldingRoundTripMs: number;
  readonly minEndToEndFidelity: number;
  readonly purifiedLinkFidelity: number;
  readonly purificationSuccessProb: number;
  readonly segmentCount: number;
  readonly memoryDecoherenceFactor: number;
  readonly endToEndFidelity: number;
  readonly distilledEbitRatePerSec: number;
  readonly regime: QuantumRepeaterRegime;
  readonly quantumRepeaterDigestSha256: string;
}
