/**
 * EOS Sovereign Control Plane — Layer-0 Pure TypeScript
 * Module: Deterministic Replay Debugger & MCTS Time-Travel Studio Types
 * Specification: SPEC-370 / CHANGE-232
 * Requirements: FR-370-01 through FR-370-07
 * Invariants: Zero external dependencies, pure mechanical sympathy, line ceiling <= 800
 */

export type CheckpointActionType = "STATE_MUTATION" | "TOOL_INVOCATION" | "BRANCH_FORK" | "ROLLBACK" | "EVALUATION";

export interface ExecutionCheckpoint {
  tick: number;
  actionType: CheckpointActionType;
  actionPayload: Record<string, unknown> | string;
  stateSnapshot: Record<string, unknown>;
  stateHash: string;
  timestamp: number;
}

export interface MctsBranchNode {
  branchId: string;
  parentTick: number;
  name: string;
  alternativeAction: string;
  checkpoints: ExecutionCheckpoint[];
  visits: number;
  cumulativeReward: number;
  uctScore: number;
  status: "ACTIVE" | "PRUNED" | "CONVERGED";
}

export interface TimeSliderState {
  currentTick: number;
  cursorTick: number;
  maxTick: number;
  isAtHead: boolean;
  activeBranchId?: string;
}

export interface DeterministicReplayReceipt {
  receiptId: string;
  sha256: string;
  totalCheckpoints: number;
  totalBranches: number;
  bitExactVerification: boolean;
  winningBranch?: MctsBranchNode;
  generatedAt: string;
}
