/**
 * EOS Live TLC Model Checking & Z3 Theorem Prover Engine Types
 *
 * SPEC-292 / CHANGE-154: Types for TLA+ model checking, SMT solving,
 * inductive invariant proving, and counterexample test translation.
 */

export interface TlcExecutionResult {
  specFile: string;
  /** LIVE_LOCAL_TLC when TLC actually ran; UNAVAILABLE when java or the jar is missing. */
  executionMode: "LIVE_LOCAL_TLC" | "UNAVAILABLE";
  generatedStates: number;
  distinctStates: number;
  invariantViolations: number;
  status: "PASS" | "INVARIANT_VIOLATION" | "DEADLOCK" | "TIMEOUT" | "INCONCLUSIVE" | "NOT_VERIFIED";
  /** True only when TLC ran to a definitive verdict (PASS, INVARIANT_VIOLATION or DEADLOCK). */
  verified: boolean;
  reason?: string;
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
  /** PROVEN only when the domain is closed under the transition relation (SPEC-342 FR-4). */
  status: "INDUCTIVE_INVARIANT_PROVEN" | "HOLDS_ON_SAMPLED_DOMAIN" | "VIOLATION_DETECTED";
  baseCaseProven: boolean;
  inductiveStepProven: boolean;
  domainSize: number;
  domainClosedUnderTransition: boolean;
  counterexample?: Record<string, number | boolean>;
}

export interface SymbolicInductiveProofResult {
  invariantName: string;
  /** PROVEN when all negated invariant branches are UNSAT under premise (SMT Induction). */
  status: "INDUCTIVE_INVARIANT_PROVEN" | "VIOLATION_DETECTED" | "UNKNOWN";
  baseCaseProven: boolean;
  inductiveStepProven: boolean;
  counterexample?: Record<string, number | boolean>;
}

export interface Z3ProverAuditReceipt {
  timestampIso: string;
  specRef: "SPEC-292";
  /** Number of .tla files present in docs/formal. */
  totalTlaSpecsInventoried: number;
  /** Number of specs actually model-checked live by TLC with a PASS verdict. */
  totalTlaSpecsChecked: number;
  tlcSampleStatus: TlcExecutionResult["status"];
  totalSmtTheoremsProven: number;
  inductiveInvariantsVerified: number;
  /** SHA-256 over content fields only (timestamp excluded) — identical content, identical signature. */
  sha256Signature: string;
}
