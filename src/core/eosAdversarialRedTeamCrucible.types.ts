/**
 * EOS Sovereign Control Plane — Layer-0 Pure TypeScript
 * Module: Adversarial Red-Team Crucible & Minimax Exploit-Patch Game Types
 * Specification: SPEC-368 / CHANGE-230
 * Requirements: FR-368-01 through FR-368-07
 * Invariants: Zero external dependencies, pure mechanical sympathy, line ceiling <= 800
 */

export type AttackVectorType = "PROMPT_INJECTION" | "INVARIANT_VIOLATION" | "PATHOLOGICAL_PAYLOAD" | "RACE_CONDITION";

export type ExploitClassification = "PENETRATED" | "DEFENDED";

export type TournamentState = "IDLE" | "ATTACKING" | "EVALUATING" | "PATCHING" | "CONVERGED" | "EXHAUSTED";

export type DefensiveAction = "SANITIZE" | "REJECT" | "ISOLATE" | "WRAP";

export interface AttackVector {
  id: string;
  vectorType: AttackVectorType;
  target: string;
  payload: Record<string, unknown> | string;
  expectedInvariant: string;
  sha256: string;
  timestamp: number;
}

export interface EvaluationResult {
  attackId: string;
  classification: ExploitClassification;
  latencyMs: number;
  violatedInvariant?: string;
  stateDiff?: Record<string, unknown>;
  trace: string[];
  sha256: string;
}

export interface CegisCounterexample {
  id: string;
  attackId: string;
  vectorType: AttackVectorType;
  payload: unknown;
  violatedInvariant: string;
  priorState: Record<string, unknown>;
  posteriorState: Record<string, unknown>;
  timestamp: number;
}

export interface DefensivePatch {
  id: string;
  counterexampleId: string;
  ruleName: string;
  action: DefensiveAction;
  guardExpression: string;
  neutralizesAttack: boolean;
  regressionPass: boolean;
  appliedAtRound: number;
}

export interface CrucibleTournamentRound {
  roundNumber: number;
  attacksLaunched: number;
  attacksPenetrated: number;
  attacksDefended: number;
  patchesSynthesized: number;
  penetrationRate: number;
  durationMs: number;
}

export interface TournamentScorecard {
  tournamentId: string;
  target: string;
  totalRounds: number;
  finalState: TournamentState;
  initialPenetrationRate: number;
  finalPenetrationRate: number;
  robustnessScore: number;
  counterexamplesCount: number;
  patchesCount: number;
  converged: boolean;
}

export interface CrucibleReceipt {
  receiptId: string;
  sha256: string;
  target: string;
  rounds: CrucibleTournamentRound[];
  scorecard: TournamentScorecard;
  generatedAt: string;
}
