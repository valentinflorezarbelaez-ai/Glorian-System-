/**
 * EOS Autonomous Zero-Knowledge Circuit Synthesizer Types (SPEC-350)
 *
 * Types for finite field arithmetic, R1CS constraints, witness vectors,
 * and circuit compilation.
 */

export type FieldElement = bigint;

export type VariableType = "CONSTANT_ONE" | "PUBLIC_INPUT" | "PRIVATE_INPUT" | "INTERMEDIATE";

export interface CircuitVariable {
  index: number;
  name: string;
  type: VariableType;
}

export type LinearCombination = Map<number, bigint>;

export interface SerializedLinearCombination {
  terms: Record<number, string>; // varIndex -> bigint as decimal string
}

export interface R1csConstraint {
  A: LinearCombination;
  B: LinearCombination;
  C: LinearCombination;
  description?: string;
}

export interface SerializedR1csConstraint {
  A: Record<number, string>;
  B: Record<number, string>;
  C: Record<number, string>;
  description?: string;
}

export interface CompiledCircuit {
  prime: string; // decimal string representation of field prime
  variables: CircuitVariable[];
  constraints: SerializedR1csConstraint[];
  publicInputsCount: number;
  privateInputsCount: number;
  intermediateCount: number;
}

export interface VerificationResult {
  satisfied: boolean;
  failedConstraintIndex?: number;
  expectedC?: string;
  actualC?: string;
}

export interface ZkCircuitAuditReceipt {
  receiptId: string;
  timestamp: string;
  specId: string;
  status: "VERIFIED" | "FAILED";
  fieldArithmeticVerified: boolean;
  r1csSynthesisVerified: boolean;
  booleanEnforcementVerified: boolean;
  multiplexerVerified: boolean;
  witnessSatisfied: boolean;
  constraintsCount: number;
  proofCertificateSha256: string;
}
