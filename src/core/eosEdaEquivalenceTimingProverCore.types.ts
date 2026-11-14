/**
 * SPEC-247 / CHANGE-124 — Layer-0 EDA Equivalence, Static Timing & seL4 Non-Interference Types.
 */

export interface TimingNodeInput {
  readonly nodeId: string;
  readonly delayMicros: number;
  readonly dependsOn?: readonly string[];
}

export type SecurityDomainLevel = "HIGH_SECRET" | "KERNEL" | "LOW_PUBLIC";

export interface InformationFlowEdgeInput {
  readonly sourceId: string;
  readonly sourceDomain: SecurityDomainLevel;
  readonly sinkId: string;
  readonly sinkDomain: SecurityDomainLevel;
  readonly declassified?: boolean;
}

export interface LecCounterexample {
  readonly input: number;
  readonly referenceOutput: number | string | boolean;
  readonly candidateOutput: number | string | boolean;
}

export interface ProveEdaAndSeL4Options {
  readonly circuitId?: string;
  readonly referenceFn?: (x: number) => number | string | boolean;
  readonly candidateFn?: (x: number) => number | string | boolean;
  readonly inputDomain?: readonly number[];
  readonly timingDag?: readonly TimingNodeInput[];
  readonly clockBudgetMicros?: number;
  readonly flows?: readonly InformationFlowEdgeInput[];
}

export interface EdaEquivalenceTimingReport {
  readonly circuitId: string;
  readonly lecEquivalent: boolean;
  readonly inputsTestedCount: number;
  readonly firstCounterexample?: LecCounterexample;
  readonly criticalPathDelayMicros: number;
  readonly criticalPathNodes: readonly string[];
  readonly clockBudgetMicros: number;
  readonly slackMicros: number;
  readonly timingMet: boolean;
  readonly nonInterferenceVerified: boolean;
  readonly illegalFlows: readonly string[];
  readonly verdict: "SILICON_FORMAL_VERIFIED" | "FORMAL_VIOLATION_BLOCKED";
  readonly proverDigestSha256: string;
}
