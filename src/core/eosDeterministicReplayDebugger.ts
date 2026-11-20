/**
 * EOS Sovereign Control Plane — Layer-0 Pure TypeScript
 * Module: Deterministic Replay Debugger & MCTS Time-Travel Studio
 * Specification: SPEC-370 / CHANGE-232
 * Requirements: FR-370-01 through FR-370-07
 * Invariants: Zero external dependencies, pure mechanical sympathy, line ceiling <= 800
 */

import { createHash } from "node:crypto";
import type {
  CheckpointActionType,
  DeterministicReplayReceipt,
  ExecutionCheckpoint,
  MctsBranchNode,
  TimeSliderState,
} from "./eosDeterministicReplayDebugger.types.js";

function sha256Hex(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deterministic Replay Debugger & MCTS Time-Travel Studio Engine.
 */
export class EosDeterministicReplayDebugger {
  private checkpoints: ExecutionCheckpoint[] = [];
  private branches: Map<string, MctsBranchNode> = new Map();
  private currentTick = 0;
  private cursorTick = 0;
  private branchCounter = 0;
  private totalExplorationVisits = 0;

  public constructor() {
    // Initialize root checkpoint at tick 0
    const initialState = { status: "BOOTSTRAP", memory: {}, registers: {} };
    const hash = sha256Hex(JSON.stringify(initialState));
    this.checkpoints.push({
      tick: 0,
      actionType: "STATE_MUTATION",
      actionPayload: "INIT_CANONICAL_ROOT",
      stateSnapshot: initialState,
      stateHash: hash,
      timestamp: Date.now(),
    });
  }

  public recordCheckpoint(
    actionType: CheckpointActionType,
    actionPayload: Record<string, unknown> | string,
    stateSnapshot: Record<string, unknown>,
  ): ExecutionCheckpoint {
    this.currentTick++;
    this.cursorTick = this.currentTick;

    const clonedState = deepClone(stateSnapshot);
    const hash = sha256Hex(JSON.stringify(clonedState));

    const checkpoint: ExecutionCheckpoint = {
      tick: this.currentTick,
      actionType,
      actionPayload,
      stateSnapshot: clonedState,
      stateHash: hash,
      timestamp: Date.now(),
    };

    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  public rewindTo(targetTick: number): ExecutionCheckpoint {
    if (targetTick < 0 || targetTick > this.currentTick) {
      throw new RangeError(`Target tick ${targetTick} out of bounds [0, ${this.currentTick}]`);
    }

    this.cursorTick = targetTick;
    const cp = this.checkpoints[targetTick];
    if (!cp) {
      throw new Error(`Checkpoint at tick ${targetTick} not found`);
    }

    // Verify bit-exact cryptographic integrity of snapshot
    const currentHash = sha256Hex(JSON.stringify(cp.stateSnapshot));
    if (currentHash !== cp.stateHash) {
      throw new Error(`Bit-exact integrity mismatch at tick ${targetTick}`);
    }

    return cp;
  }

  public stepForward(): ExecutionCheckpoint | null {
    if (this.cursorTick >= this.currentTick) {
      return null;
    }
    this.cursorTick++;
    return this.checkpoints[this.cursorTick];
  }

  public stepBackward(): ExecutionCheckpoint | null {
    if (this.cursorTick <= 0) {
      return null;
    }
    this.cursorTick--;
    return this.checkpoints[this.cursorTick];
  }

  public createBranch(parentTick: number, name: string, alternativeAction: string): MctsBranchNode {
    if (parentTick < 0 || parentTick > this.currentTick) {
      throw new RangeError(`Parent tick ${parentTick} out of bounds`);
    }

    this.branchCounter++;
    const branchId = `BRANCH-${Date.now().toString(36).toUpperCase()}-${this.branchCounter.toString().padStart(3, "0")}`;

    const parentCp = this.checkpoints[parentTick];
    const initialBranchCp: ExecutionCheckpoint = {
      tick: parentTick,
      actionType: "BRANCH_FORK",
      actionPayload: { branchId, alternativeAction },
      stateSnapshot: deepClone(parentCp.stateSnapshot),
      stateHash: parentCp.stateHash,
      timestamp: Date.now(),
    };

    const node: MctsBranchNode = {
      branchId,
      parentTick,
      name,
      alternativeAction,
      checkpoints: [initialBranchCp],
      visits: 1,
      cumulativeReward: 0.5,
      uctScore: 0.5,
      status: "ACTIVE",
    };

    this.branches.set(branchId, node);
    this.totalExplorationVisits++;
    return node;
  }

  public evaluateUct(branchId: string, reward: number, explorationConstant = 1.414): number {
    const node = this.branches.get(branchId);
    if (!node) {
      throw new Error(`Branch ${branchId} not found`);
    }

    node.visits++;
    node.cumulativeReward += reward;
    this.totalExplorationVisits++;

    const exploitation = node.cumulativeReward / node.visits;
    const exploration = explorationConstant * Math.sqrt(Math.log(this.totalExplorationVisits) / node.visits);
    const uct = exploitation + exploration;
    node.uctScore = Math.round(uct * 1000) / 1000;

    return node.uctScore;
  }

  public getWinningBranch(): MctsBranchNode | undefined {
    let winning: MctsBranchNode | undefined;
    for (const b of this.branches.values()) {
      if (!winning || b.uctScore > winning.uctScore) {
        winning = b;
      }
    }
    return winning;
  }

  public getSliderState(): TimeSliderState {
    return {
      currentTick: this.currentTick,
      cursorTick: this.cursorTick,
      maxTick: this.currentTick,
      isAtHead: this.cursorTick === this.currentTick,
    };
  }

  public getCheckpoints(): ExecutionCheckpoint[] {
    return [...this.checkpoints];
  }

  public getBranches(): MctsBranchNode[] {
    return Array.from(this.branches.values());
  }

  public audit(): DeterministicReplayReceipt {
    const receiptId = `RCP-REPLAY-${Date.now().toString(36).toUpperCase()}`;

    // Verify all checkpoints bit-exactness
    let bitExactVerification = true;
    for (const cp of this.checkpoints) {
      const h = sha256Hex(JSON.stringify(cp.stateSnapshot));
      if (h !== cp.stateHash) {
        bitExactVerification = false;
        break;
      }
    }

    const winningBranch = this.getWinningBranch();
    const raw = JSON.stringify({
      receiptId,
      totalCheckpoints: this.checkpoints.length,
      totalBranches: this.branches.size,
      bitExactVerification,
      winningBranchId: winningBranch?.branchId,
    });

    return {
      receiptId,
      sha256: sha256Hex(raw),
      totalCheckpoints: this.checkpoints.length,
      totalBranches: this.branches.size,
      bitExactVerification,
      winningBranch,
      generatedAt: new Date().toISOString(),
    };
  }

  public static audit(): DeterministicReplayReceipt {
    const debuggerInst = new EosDeterministicReplayDebugger();
    // Simulate multi-step canonical trajectory and MCTS branches
    debuggerInst.recordCheckpoint("STATE_MUTATION", "LINT_PASS", { step: 1, errors: 0 });
    debuggerInst.recordCheckpoint("TOOL_INVOCATION", "RUN_TESTS", { step: 2, passed: 10 });
    const branch = debuggerInst.createBranch(1, "WHAT_IF_CONCURRENCY", "SPAWN_WORKER_THREADS");
    debuggerInst.evaluateUct(branch.branchId, 0.95);

    return debuggerInst.audit();
  }
}
