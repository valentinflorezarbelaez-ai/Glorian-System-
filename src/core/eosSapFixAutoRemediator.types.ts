/**
 * EOS SapFix-Style Closed-Loop Autonomous Healer & Mutation Testing Engine Types
 *
 * SPEC-291 / CHANGE-153: Types for AST mutation testing, multi-candidate patch
 * synthesis, closed-loop regression verification, and cryptographic audit receipts.
 */

export type MutationCategory = "arithmetic" | "relational" | "equality" | "logical" | "boolean";

export interface AstMutant {
  id: string;
  filePath: string;
  line: number;
  column: number;
  originalOperator: string;
  mutatedOperator: string;
  mutatedSource: string;
  category: MutationCategory;
}

export interface MutantExecutionResult {
  id: string;
  line: number;
  originalOperator: string;
  mutatedOperator: string;
  status: "KILLED" | "SURVIVED";
  errorOutput?: string;
}

export interface SapFixMutationScoreReport {
  filePath: string;
  totalMutants: number;
  killedMutants: number;
  survivingMutants: number;
  mutationScore: number;
  mutants: MutantExecutionResult[];
}

export interface PatchCandidate {
  id: string;
  filePath: string;
  description: string;
  originalSnippet: string;
  replacementSnippet: string;
  fullPatchedSource: string;
  confidenceScore: number;
}

export interface RemediationResult {
  status: "HEALED" | "NO_VIABLE_PATCH";
  winningPatch?: PatchCandidate;
  evaluatedCandidatesCount: number;
  rejectedCandidates: Array<{ id: string; reason: string }>;
  unifiedDiff?: string;
  approvalHash?: string;
}

export interface SapFixAuditReceipt {
  timestampIso: string;
  specRef: "SPEC-291";
  totalMutantsEvaluated: number;
  totalPatchesSynthesized: number;
  winningPatchesCount: number;
  averageMutationScore: number;
  sha256Signature: string;
}
