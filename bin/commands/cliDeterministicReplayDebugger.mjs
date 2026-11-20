/**
 * @file cliDeterministicReplayDebugger.mjs
 * @description CLI handler for SPEC-370 / CHANGE-232: Deterministic Replay Debugger & MCTS Time-Travel Studio.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosDeterministicReplayDebugger } from "../../src/core/eosDeterministicReplayDebugger.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("DETERMINISTIC_REPLAY_DEBUGGER_RECEIPT.json", root);
}

function getPositionalArg(args, commandContext) {
  return args.find((a) => !a.startsWith("--") && !a.startsWith("toolchain:") && a !== commandContext?.command);
}

const HANDLERS = {};

async function cmd_replay_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosDeterministicReplayDebugger.audit();
  const receiptPath = getReceiptPath(ROOT);

  try {
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  } catch (err) {
    console.error(`Warning: Could not persist evidence receipt: ${err.message}`);
  }

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Deterministic Replay Debugger & MCTS Time-Travel Studio (SPEC-370) ===");
    console.log(`Receipt ID            : ${receipt.receiptId}`);
    console.log(`Total Checkpoints     : ${receipt.totalCheckpoints}`);
    console.log(`MCTS Branches Created : ${receipt.totalBranches}`);
    console.log(`Bit-Exact Verified    : ${receipt.bitExactVerification}`);
    console.log(`Winning Branch ID     : ${receipt.winningBranch?.branchId ?? "none"}`);
    console.log(`Winning UCT Score     : ${receipt.winningBranch?.uctScore ?? "n/a"}`);
    console.log(`Integrity SHA-256     : ${receipt.sha256}`);
  }
}

async function cmd_replay_record(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const action = getPositionalArg(args, commandContext) || "AST_MUTATION_STEP";
  const step = args.find((a) => a.startsWith("--step="))?.split("=")[1] || "1";

  const dbg = new EosDeterministicReplayDebugger();
  const cp = dbg.recordCheckpoint("STATE_MUTATION", action, {
    step: Number.parseInt(step, 10),
    action,
    verified: true,
  });

  if (isJson) {
    console.log(JSON.stringify(cp, null, 2));
  } else {
    console.log(`[REPLAY DEBUGGER] Recorded Checkpoint:`);
    console.log(`Tick       : ${cp.tick}`);
    console.log(`Action Type: ${cp.actionType}`);
    console.log(
      `Payload    : ${typeof cp.actionPayload === "object" ? JSON.stringify(cp.actionPayload) : cp.actionPayload}`,
    );
    console.log(`State Hash : ${cp.stateHash}`);
  }
}

async function cmd_replay_step(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const dbg = new EosDeterministicReplayDebugger();
  // Setup 3 checkpoints
  dbg.recordCheckpoint("STATE_MUTATION", "INIT", { tick: 1 });
  dbg.recordCheckpoint("TOOL_INVOCATION", "LINT", { tick: 2 });
  dbg.recordCheckpoint("STATE_MUTATION", "FIX", { tick: 3 });

  let cp;
  if (args.includes("--back")) {
    cp = dbg.stepBackward();
  } else if (args.includes("--rewind")) {
    const tickArg = args.find((a) => a.startsWith("--tick="))?.split("=")[1] || "0";
    cp = dbg.rewindTo(Number.parseInt(tickArg, 10));
  } else {
    cp = dbg.stepForward();
  }

  const slider = dbg.getSliderState();

  if (isJson) {
    console.log(JSON.stringify({ checkpoint: cp, slider }, null, 2));
  } else {
    console.log(`[TIME-SLIDER] Cursor at Tick ${slider.cursorTick} / ${slider.maxTick} (IsAtHead: ${slider.isAtHead})`);
    if (cp) {
      console.log(`Current State Hash : ${cp.stateHash}`);
      console.log(`Action Payload     : ${JSON.stringify(cp.actionPayload)}`);
    }
  }
}

async function cmd_replay_branch(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const name = getPositionalArg(args, commandContext) || "WHAT_IF_ALTERNATIVE_FIX";
  const parentTickArg = args.find((a) => a.startsWith("--tick="))?.split("=")[1] || "1";
  const parentTick = Number.parseInt(parentTickArg, 10);

  const dbg = new EosDeterministicReplayDebugger();
  dbg.recordCheckpoint("STATE_MUTATION", "BOOT_ENV", { tick: 1 });
  dbg.recordCheckpoint("TOOL_INVOCATION", "RUN_TESTS", { tick: 2 });

  const safeTick = Math.min(parentTick, dbg.getSliderState().currentTick);
  const branch = dbg.createBranch(safeTick, name, "TRY_LOCK_FREE_ATOMIC_SWAP");
  const uct = dbg.evaluateUct(branch.branchId, 0.9);

  if (isJson) {
    console.log(JSON.stringify({ branch, uct }, null, 2));
  } else {
    console.log(`[MCTS TIME-TRAVEL] Created Counterfactual Branch:`);
    console.log(`Branch ID  : ${branch.branchId}`);
    console.log(`Parent Tick: ${branch.parentTick}`);
    console.log(`Name       : ${branch.name}`);
    console.log(`Action     : ${branch.alternativeAction}`);
    console.log(`UCT Score  : ${uct}`);
    console.log(`Visits     : ${branch.visits}`);
  }
}

HANDLERS["toolchain:replay:audit"] = cmd_replay_audit;
HANDLERS["toolchain:replay:record"] = cmd_replay_record;
HANDLERS["toolchain:replay:step"] = cmd_replay_step;
HANDLERS["toolchain:replay:branch"] = cmd_replay_branch;

export async function handleDeterministicReplayDebuggerCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:replay command: ${command}`);
  }
  await handler(commandContext);
  return true;
}

export function registerCommands(router) {
  for (const [cmd, fn] of Object.entries(HANDLERS)) {
    router.register(cmd, fn);
  }
}

export { cmd_replay_audit, cmd_replay_record, cmd_replay_step, cmd_replay_branch };
