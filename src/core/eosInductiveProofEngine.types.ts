/**
 * SPEC-360 / CHANGE-222: Autonomous Formal Verification & Metamorphic Proof Engine (Automated Inductive Invariant Synthesizer & Z3/TLC Hybrid Co-Prover)
 * Type Definitions & Contracts.
 */

export type ProofStatePredicate = (state: Record<string, unknown>) => boolean;

export type TransitionFunction = (state: Record<string, unknown>) => Record<string, unknown>;

export interface TransitionCounterexample {
  readonly preState: Record<string, unknown>;
  readonly postState: Record<string, unknown>;
  readonly violatedProperty: string;
}

export interface CandidateLemma {
  readonly id: string;
  readonly expression: string;
  readonly predicate: ProofStatePredicate;
  readonly eliminatedCounterexamplesCount: number;
}

export interface CegisSynthesisResult {
  readonly converged: boolean;
  readonly iterations: number;
  readonly baseCaseVerified: boolean;
  readonly inductiveStepVerified: boolean;
  readonly synthesizedLemmas: readonly CandidateLemma[];
  readonly totalCounterexamplesPruned: number;
}

export interface MetamorphicTestReport {
  readonly transformationsTested: number;
  readonly symmetryPreserved: boolean;
  readonly invariantsChecked: number;
  readonly violations: readonly string[];
}

export interface ProofBenchmarkResult {
  readonly transitionsEvaluated: number;
  readonly lemmasSynthesized: number;
  readonly totalDurationUs: number;
  readonly avgLemmaSynthesisLatencyUs: number;
  readonly throughputTransitionsSec: number;
}

export interface ProofAuditReceipt {
  readonly specId: "SPEC-360";
  readonly changeId: "CHANGE-222";
  readonly timestamp: string;
  readonly cegisResult: CegisSynthesisResult;
  readonly metamorphicReport: MetamorphicTestReport;
  readonly benchmark: ProofBenchmarkResult;
  readonly tlcModelVerified: boolean;
  readonly verdict: "CONFORMANT";
  readonly epistemicState: "PRODUCTION_READY_WITHIN_TESTED_SCOPE";
}
