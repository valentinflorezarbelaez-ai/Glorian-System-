/**
 * SPEC-246 / CHANGE-123 — Layer-0 Golden SWE Benchmark Harness Types.
 */

export interface SweBenchmarkCaseInput {
  readonly caseId: string;
  readonly category: string;
  readonly expectedBlock: boolean;
  readonly actualBlock: boolean;
  readonly durationMs?: number;
}

export interface RunGoldenSweBenchmarkOptions {
  readonly casesOverride?: readonly SweBenchmarkCaseInput[];
}

export type ConfusionClassification = "TP" | "TN" | "FP" | "FN";

export interface SweBenchmarkCaseOutcome {
  readonly caseId: string;
  readonly category: string;
  readonly expectedBlock: boolean;
  readonly actualBlock: boolean;
  readonly classification: ConfusionClassification;
  readonly correct: boolean;
}

export interface GoldenSweBenchmarkReport {
  readonly totalCases: number;
  readonly truePositives: number;
  readonly trueNegatives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1Score: number;
  readonly falsePositiveRate: number;
  readonly accuracy: number;
  readonly outcomes: readonly SweBenchmarkCaseOutcome[];
  readonly benchmarkDigestSha256: string;
}
