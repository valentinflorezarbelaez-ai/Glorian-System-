/**
 * Glorian System — Metamorphic, Differential & Structural-Shrinking Blind-Spot Hunter Types
 * Governed by SPEC-341 / CHANGE-203 / ADR-203-001..003
 */

export type BlindSpotErrorCode =
  "BLINDSPOT_INVALID_PARAMETERS" | "BLINDSPOT_EXECUTION_FAILED" | "BLINDSPOT_INVARIANT_BREACH";

export type GeneratorMode = "JSON_ANY" | "INT_ARRAY";

export type MetamorphicRelationName =
  "SORT_PERMUTATION_IDEMPOTENCE" | "FILTER_SUBSET_MONOTONICITY" | "JSON_ROUNDTRIP_INVERTIBILITY" | "CUSTOM";

export interface StructuralPropertyOptions<T = unknown> {
  readonly name: string;
  readonly seed?: number;
  readonly runs?: number;
  readonly maxDepth?: number;
  readonly maxShrinkSteps?: number;
  readonly generatorMode?: GeneratorMode;
  readonly generator?: (nextFloat: () => number, runIndex: number) => T;
  readonly predicate: (value: T) => boolean;
}

export interface StructuralPropertyReport<T = unknown> {
  readonly name: string;
  readonly seed: number;
  readonly runsExecuted: number;
  readonly passed: boolean;
  readonly initialFailingInput?: T;
  readonly minimalCounterexample?: T;
  readonly shrinkStepsTaken: number;
  readonly sha256Digest: string;
}

export interface DifferentialCampaignOptions<T = number[]> {
  readonly targetName: string;
  readonly seed?: number;
  readonly runs?: number;
  readonly maxShrinkSteps?: number;
  readonly generator?: (nextFloat: () => number, runIndex: number) => T;
  readonly referenceFn: (input: T) => unknown;
  readonly candidateFn: (input: T) => unknown;
}

export interface DifferentialCampaignResult {
  readonly targetName: string;
  readonly seed: number;
  readonly totalRuns: number;
  readonly divergenceCount: number;
  readonly equivalent: boolean;
  readonly initialDivergingInput?: unknown;
  readonly minimalDivergingInput?: unknown;
  readonly referenceOutput?: unknown;
  readonly candidateOutput?: unknown;
  readonly candidateError?: string;
  readonly shrinkStepsTaken: number;
  readonly sha256Digest: string;
}

export interface MetamorphicCampaignOptions {
  readonly relation: MetamorphicRelationName;
  readonly seed?: number;
  readonly runs?: number;
  readonly sortFn?: (items: readonly number[]) => number[];
  readonly filterFn?: (items: readonly number[], threshold: number) => number[];
  readonly roundtripFn?: {
    readonly serialize: (value: unknown) => string;
    readonly deserialize: (serialized: string) => unknown;
  };
  readonly customRelation?: {
    readonly transform: (input: unknown, nextFloat: () => number) => unknown;
    readonly evaluate: (input: unknown) => unknown;
    readonly holds: (outA: unknown, outB: unknown, inputA: unknown, inputB: unknown) => boolean;
  };
}

export interface MetamorphicCampaignResult {
  readonly relation: MetamorphicRelationName;
  readonly seed: number;
  readonly totalRuns: number;
  readonly violationCount: number;
  readonly passed: boolean;
  readonly minimalCounterexample?: unknown;
  readonly detail: string;
  readonly sha256Digest: string;
}

export interface BoundaryFuzzOutcome {
  readonly statusCode: number;
  readonly body?: unknown;
}

export interface BoundaryFuzzCampaignOptions {
  readonly targetName: string;
  readonly seed?: number;
  readonly iterations?: number;
  readonly customCorpus?: ReadonlyArray<unknown>;
  readonly handler: (payload: unknown, iteration: number) => BoundaryFuzzOutcome | Promise<BoundaryFuzzOutcome>;
}

export interface SyncBoundaryFuzzCampaignOptions {
  readonly targetName: string;
  readonly seed?: number;
  readonly iterations?: number;
  readonly customCorpus?: ReadonlyArray<unknown>;
  readonly handler: (payload: unknown, iteration: number) => BoundaryFuzzOutcome;
}

export interface BoundaryFuzzCampaignResult {
  readonly targetName: string;
  readonly seed: number;
  readonly iterations: number;
  readonly handledCount: number;
  readonly unhandledExceptionCount: number;
  readonly http5xxCount: number;
  readonly stabilityScore: number;
  readonly statusCounts: Readonly<Record<string, number>>;
  readonly firstFailingPayload?: unknown;
  readonly firstFailureReason?: string;
  readonly sha256Digest: string;
}

export interface BlindSpotHunterAuditReceipt {
  readonly specRef: "SPEC-341";
  readonly seed: number;
  readonly structuralShrinkCaughtSortBug: boolean;
  readonly minimalSortCounterexampleLength: number;
  readonly differentialCaughtDivergence: boolean;
  readonly differentialParityConfirmed: boolean;
  readonly metamorphicSortPassed: boolean;
  readonly metamorphicFilterPassed: boolean;
  readonly metamorphicRoundtripPassed: boolean;
  readonly fuzzCampaignIterations: number;
  readonly fuzzUnhandledExceptions: number;
  readonly fuzzHttp5xxCount: number;
  readonly fuzzStabilityScore: number;
  readonly allPassed: boolean;
  readonly sha256Digest: string;
}

export type FleetProjectVerdict = "VERIFIED" | "FINDINGS" | "UNREACHABLE" | "NOT_VERIFIED";

export interface FleetProjectBlindSpotReport {
  readonly projectId: string;
  readonly projectName: string;
  readonly status: string;
  readonly authorization: string;
  readonly targetUrl?: string;
  readonly verdict: FleetProjectVerdict;
  readonly fuzzIterations: number;
  readonly passed: boolean;
  readonly stabilityScore: number;
  readonly unhandledExceptions: number;
  readonly http5xxCount: number;
  readonly reason?: string;
}

export interface FleetBlindSpotAuditReceipt {
  readonly specRef: "SPEC-341";
  readonly command: "toolchain:blindspot:fleet";
  readonly mode: "LIVE_PROBED" | "OFFLINE_NOT_VERIFIED";
  readonly totalFleetProjects: number;
  readonly auditedProjects: number;
  readonly allPassed: boolean;
  readonly meanStabilityScore: number;
  readonly projects: ReadonlyArray<FleetProjectBlindSpotReport>;
  readonly sha256Digest: string;
}
