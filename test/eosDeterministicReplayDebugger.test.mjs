/**
 * EOS Sovereign Control Plane — Layer-0 Pure ESM Test
 * Test Suite: Deterministic Replay Debugger & MCTS Time-Travel Studio (SPEC-370 / CHANGE-232)
 * Scenarios: BDD-1999 through BDD-2004
 * Invariant: Zero external dependencies, pure node:test and node:assert.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosDeterministicReplayDebugger } from "../src/core/eosDeterministicReplayDebugger.ts";

test("BDD-1999: Discrete Checkpointing of Agent Execution Trajectory", () => {
  const dbg = new EosDeterministicReplayDebugger();
  const cp1 = dbg.recordCheckpoint("STATE_MUTATION", "AST_PARSE", { filesParsed: 4, errors: 0 });

  assert.strictEqual(cp1.tick, 1);
  assert.strictEqual(cp1.actionType, "STATE_MUTATION");
  assert.strictEqual(cp1.actionPayload, "AST_PARSE");
  assert.strictEqual(cp1.stateHash.length, 64);
  assert.ok(cp1.timestamp > 0);

  const cp2 = dbg.recordCheckpoint("TOOL_INVOCATION", "RUN_LINTER", { filesParsed: 4, lintErrors: 0 });

  assert.strictEqual(cp2.tick, 2);
  assert.notStrictEqual(cp1.stateHash, cp2.stateHash);
  assert.strictEqual(dbg.getCheckpoints().length, 3); // tick 0 (root) + tick 1 + tick 2
});

test("BDD-2000: Bit-Exact State Restoration via Time-Travel Rewind", () => {
  const dbg = new EosDeterministicReplayDebugger();
  const cp1 = dbg.recordCheckpoint("STATE_MUTATION", "ACTION_1", { score: 10 });
  dbg.recordCheckpoint("STATE_MUTATION", "ACTION_2", { score: 50 });
  dbg.recordCheckpoint("STATE_MUTATION", "ACTION_3", { score: 100 });

  // Rewind back to tick 1
  const restored = dbg.rewindTo(1);
  assert.strictEqual(restored.tick, 1);
  assert.strictEqual(restored.stateHash, cp1.stateHash);
  assert.deepStrictEqual(restored.stateSnapshot, { score: 10 });

  const slider = dbg.getSliderState();
  assert.strictEqual(slider.cursorTick, 1);
  assert.strictEqual(slider.maxTick, 3);
  assert.strictEqual(slider.isAtHead, false);
});

test("BDD-2001: Counterfactual MCTS Alternative Branching", () => {
  const dbg = new EosDeterministicReplayDebugger();
  dbg.recordCheckpoint("STATE_MUTATION", "CANONICAL_STEP_1", { status: "A" });
  dbg.recordCheckpoint("STATE_MUTATION", "CANONICAL_STEP_2", { status: "B" });

  // Create counterfactual branch from tick 1
  const branch = dbg.createBranch(1, "WHAT_IF_ALTERNATIVE", "SPAWN_WORKER");
  assert.ok(branch.branchId.startsWith("BRANCH-"));
  assert.strictEqual(branch.parentTick, 1);
  assert.strictEqual(branch.status, "ACTIVE");
  assert.strictEqual(branch.checkpoints.length, 1);
  assert.strictEqual(branch.checkpoints[0].tick, 1);

  // Canonical checkpoints must remain unaltered
  assert.strictEqual(dbg.getCheckpoints().length, 3);
});

test("BDD-2002: UCT Scoring and Optimal Trajectory Selection", () => {
  const dbg = new EosDeterministicReplayDebugger();
  dbg.recordCheckpoint("STATE_MUTATION", "ROOT", { balance: 100 });

  const branchA = dbg.createBranch(1, "BRANCH_A", "POLICY_RETRY");
  const branchB = dbg.createBranch(1, "BRANCH_B", "POLICY_FALLBACK");

  // Evaluate rewards
  dbg.evaluateUct(branchA.branchId, 0.2); // low reward
  dbg.evaluateUct(branchB.branchId, 0.95); // high reward

  const winning = dbg.getWinningBranch();
  assert.ok(winning);
  assert.strictEqual(winning.branchId, branchB.branchId);
  assert.ok(winning.uctScore > branchA.uctScore);
});

test("BDD-2003: Interactive Time-Slider Step Navigation", () => {
  const dbg = new EosDeterministicReplayDebugger();
  dbg.recordCheckpoint("STATE_MUTATION", "STEP_1", { pos: 1 });
  dbg.recordCheckpoint("STATE_MUTATION", "STEP_2", { pos: 2 });
  dbg.recordCheckpoint("STATE_MUTATION", "STEP_3", { pos: 3 });

  // Currently at head (tick 3)
  assert.strictEqual(dbg.getSliderState().cursorTick, 3);
  assert.strictEqual(dbg.stepForward(), null); // cannot step forward from head

  // Step backward
  const back1 = dbg.stepBackward();
  assert.ok(back1);
  assert.strictEqual(back1.tick, 2);
  assert.strictEqual(dbg.getSliderState().cursorTick, 2);

  const back2 = dbg.stepBackward();
  assert.ok(back2);
  assert.strictEqual(back2.tick, 1);

  // Step forward
  const fwd = dbg.stepForward();
  assert.ok(fwd);
  assert.strictEqual(fwd.tick, 2);
});

test("BDD-2004: Full Diagnostic Audit and Replay Debugger Receipt", () => {
  const receipt = EosDeterministicReplayDebugger.audit();

  assert.ok(receipt.receiptId.startsWith("RCP-REPLAY-"));
  assert.strictEqual(receipt.sha256.length, 64);
  assert.ok(receipt.totalCheckpoints >= 3);
  assert.ok(receipt.totalBranches >= 1);
  assert.strictEqual(receipt.bitExactVerification, true);
  assert.ok(receipt.winningBranch);
  assert.ok(new Date(receipt.generatedAt).getTime() > 0);
});
