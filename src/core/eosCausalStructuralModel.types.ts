/**
 * Glorian System — Autonomous Causal Discovery & Structural Equation Modeling Engine (SCM)
 * Governed by SPEC-338 / CHANGE-200 / ADR-200-001..003
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies.
 */

export type ScmErrorCode =
  "SCM_INVALID_PARAMETERS" | "SCM_CYCLE_DETECTED" | "SCM_UNKNOWN_VARIABLE" | "SCM_BACKDOOR_VIOLATION";

export interface StructuralVariableSpec {
  name: string;
  parents: string[];
  /**
   * Deterministic structural mechanism f_i(parentValues).
   * The full structural equation is X_i = f_i(PA_i) + U_i.
   */
  mechanism: (parents: Record<string, number>) => number;
}

export interface DSeparationQueryResult {
  source: string;
  target: string;
  conditionedOn: string[];
  dSeparated: boolean;
  ancestralSubgraphNodes: string[];
}

export interface BackdoorCriterionReport {
  treatment: string;
  outcome: string;
  candidateSet: string[];
  containsDescendantsOfTreatment: boolean;
  blocksAllBackdoorPaths: boolean;
  validBackdoorSet: boolean;
}

export interface InterventionalAteReport {
  treatment: string;
  outcome: string;
  treatedValue: number;
  controlValue: number;
  expectedOutcomeTreated: number;
  expectedOutcomeControl: number;
  trueInterventionalAte: number;
  severedParents: string[];
}

export interface ObservationalBackdoorAdjustmentReport {
  sampleCount: number;
  naiveObservationalSlope: number;
  backdoorAdjustedAte: number;
  trueInterventionalAte: number;
  confoundingBias: number;
  adjustedEstimationError: number;
}

export interface CounterfactualInferenceReport {
  factualEvidence: Record<string, number>;
  abductedExogenousNoise: Record<string, number>;
  interventions: Record<string, number>;
  counterfactualAssignment: Record<string, number>;
  targetVariable: string;
  factualTargetValue: number;
  counterfactualTargetValue: number;
  individualTreatmentEffect: number;
}

export interface ScmAuditReceipt {
  specRef: "SPEC-338";
  dagAcyclicEnforced: boolean;
  colliderDsepVerified: boolean;
  backdoorDeconfounded: boolean;
  doInterventionExact: boolean;
  counterfactualConsistent: boolean;
  trueAte: number;
  naiveBiasedSlope: number;
  backdoorAdjustedAte: number;
  allPassed: boolean;
  sha256Digest: string;
}
