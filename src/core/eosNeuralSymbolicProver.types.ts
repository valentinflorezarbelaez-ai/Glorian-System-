/**
 * EOS Self-Synthesizing Neural-Symbolic Prover Types (SPEC-349)
 *
 * Types for CDCL SAT solving, linear bound inference, trace-based
 * inductive invariant synthesis, and CEGAR refinement.
 */

export type Literal = number; // >0 for variable x, <0 for not x
export type Clause = Literal[];
export type CnfFormula = Clause[];

export interface SatResult {
  sat: boolean;
  assignment?: Record<number, boolean>;
  learnedClausesCount: number;
  decisionsCount: number;
}

export interface VariableInterval {
  variable: string;
  min: number;
  max: number;
}

export interface LinearConstraint {
  coefficients: Record<string, number>;
  op: "<=" | ">=" | "==";
  bound: number;
}

export type StateVector = Record<string, number>;
export type StateTrace = StateVector[];

export interface CandidatePredicate {
  id: string;
  expression: string;
  test: (state: StateVector) => boolean;
}

export interface InductiveVerificationResult {
  initiated: boolean;
  consecutive: boolean;
  safe: boolean;
  inductive: boolean;
  counterexample?: {
    preState: StateVector;
    postState: StateVector;
  };
}

export interface CegarLoopResult {
  synthesizedPredicate: CandidatePredicate;
  refinementRounds: number;
  finalVerification: InductiveVerificationResult;
}

export interface NeuralSymbolicProverReceipt {
  receiptId: string;
  timestamp: string;
  specId: string;
  status: "VERIFIED" | "FAILED";
  satSolverVerified: boolean;
  boundPropagationVerified: boolean;
  inductiveSynthesisVerified: boolean;
  cegarRefinementVerified: boolean;
  activeSynthesizers: string[];
  proofCertificateSha256: string;
}
