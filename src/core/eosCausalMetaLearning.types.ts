/**
 * Core Type Definitions for SPEC-353 / CHANGE-215:
 * Autonomous Causal Meta-Learning & Counterfactual Policy Engine
 *
 * Implements Judea Pearl's Causal Hierarchy:
 * - Layer 1: Association (Observational SCM)
 * - Layer 2: Intervention (Do-Calculus & Backdoor Adjustment)
 * - Layer 3: Counterfactuals (Abduction -> Action -> Prediction)
 *
 * Pure Layer-0. Zero external dependencies.
 */

export type CausalVariableType = "CONTINUOUS" | "DISCRETE" | "BINARY";

export interface CausalNode {
  id: string;
  name: string;
  type: CausalVariableType;
  exogenousParentId: string;
  domain?: [number, number];
  description?: string;
}

export interface CausalEdge {
  from: string;
  to: string;
  weight?: number;
  metadata?: Record<string, string | number>;
}

export type StructuralFormula = (parents: Record<string, number>, noise: number) => number;
export type NoiseInverterFormula = (observedValue: number, parents: Record<string, number>) => number;

export interface StructuralEquation {
  targetNodeId: string;
  parentIds: string[];
  formula: StructuralFormula;
  noiseInverter: NoiseInverterFormula;
}

export interface StructuralCausalModelConfig {
  name: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  equations: Record<string, StructuralEquation>;
}

export interface InterventionAssignment {
  [variableId: string]: number;
}

export interface CounterfactualQuery {
  observedEvidence: Record<string, number>;
  intervention: InterventionAssignment;
  targetVariable: string;
}

export interface CounterfactualResult {
  observedEvidence: Record<string, number>;
  abductedNoise: Record<string, number>;
  counterfactualValues: Record<string, number>;
  targetVariable: string;
  factualValue: number;
  counterfactualValue: number;
  individualTreatmentEffect: number;
}

export interface BackdoorTestResult {
  treatment: string;
  outcome: string;
  candidateAdjustmentSet: string[];
  isAdmissible: boolean;
  violations: string[];
  totalBackdoorPathsCount: number;
  blockedPathsCount: number;
}

export interface AverageTreatmentEffectResult {
  treatment: string;
  outcome: string;
  baselineControlValue: number;
  treatedInterventionValue: number;
  expectedControlOutcome: number;
  expectedTreatedOutcome: number;
  averageTreatmentEffect: number;
  isCausallySignificant: boolean;
}

export interface CausalAuditReceipt {
  status: "HEALTHY" | "DEGRADED";
  timestampIso: string;
  specId: "SPEC-353";
  changeId: "CHANGE-215";
  scmNodesCount: number;
  scmEdgesCount: number;
  topologicalOrder: string[];
  backdoorVerified: boolean;
  counterfactualVerified: boolean;
  ateVerified: boolean;
  tlcModelPass: boolean;
  sha256Receipt: string;
}
