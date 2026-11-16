/**
 * EOS Live TLC Model Checking & Z3 Theorem Prover Engine Types
 *
 * SPEC-292 / CHANGE-154: Types for TLA+ model checking, SMT solving,
 * inductive invariant proving, and counterexample test translation.
 */

export interface TlcExecutionResult {
  specFile: string;
  executionMode: "LIVE_LOCAL_TLC" | "SIMULATED_EXPLORATION";
  generatedStates: number;
  distinctStates: number;
  invariantViolations: number;
  status: "PASS" | "INVARIANT_VIOLATION" | "DEADLOCK";
  counterexampleTrace?: Array<Record<string, unknown>>;
  durationMs: number;
}

export type SmtOperator = "<" | "<=" | ">" | ">=" | "==" | "!=";

export interface SmtVariable {
  name: string;
  type: "int" | "bool";
  minBound?: number;
  maxBound?: number;
}

export interface SmtConstraint {
  leftVar: string;
  op: SmtOperator;
  rightVal: number | string | boolean;
}

export interface SmtSolveResult {
  status: "SAT" | "UNSAT" | "UNKNOWN";
  model?: Record<string, number | boolean>;
  reason?: string;
}

export interface StateTransition {
  fromState: Record<string, number | boolean>;
  toState: Record<string, number | boolean>;
  actionName: string;
}

export interface InductiveProofResult {
  invariantName: string;
  status: "INDUCTIVE_INVARIANT_PROVEN" | "VIOLATION_DETECTED";
  baseCaseProven: boolean;
  inductiveStepProven: boolean;
  counterexample?: Record<string, number | boolean>;
}

export interface Z3ProverAuditReceipt {
  timestampIso: string;
  specRef: "SPEC-292";
  totalTlaSpecsChecked: number;
  totalSmtTheoremsProven: number;
  inductiveInvariantsVerified: number;
  sha256Signature: string;
}
