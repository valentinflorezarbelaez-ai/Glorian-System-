/**
 * @file cliAdversarialRedTeamCrucible.mjs
 * @description CLI handler for SPEC-368 / CHANGE-230: Adversarial Red-Team Crucible & Minimax Exploit-Patch Game.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosAdversarialRedTeamCrucible } from "../../src/core/eosAdversarialRedTeamCrucible.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("ADVERSARIAL_RED_TEAM_CRUCIBLE_RECEIPT.json", root);
}

function getTarget(args, commandContext) {
  return (
    args.find((a) => !a.startsWith("--") && !a.startsWith("toolchain:") && a !== commandContext?.command) ||
    "eos-system-control-plane"
  );
}

const HANDLERS = {};

async function cmd_crucible_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const target = getTarget(args, commandContext);
  const crucible = new EosAdversarialRedTeamCrucible();
  const receipt = crucible.auditCrucible(target);
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
    console.log("=== Adversarial Red-Team Crucible & Minimax Exploit-Patch Game (SPEC-368) ===");
    console.log(`Receipt ID                : ${receipt.receiptId}`);
    console.log(`Target                    : ${receipt.target}`);
    console.log(`Final State               : ${receipt.scorecard.finalState}`);
    console.log(`Robustness Score          : ${receipt.scorecard.robustnessScore}/100`);
    console.log(`Initial Penetration Rate  : ${receipt.scorecard.initialPenetrationRate}%`);
    console.log(`Final Penetration Rate    : ${receipt.scorecard.finalPenetrationRate}%`);
    console.log(`Counterexamples Captured  : ${receipt.scorecard.counterexamplesCount}`);
    console.log(`Defensive Patches Synthesized: ${receipt.scorecard.patchesCount}`);
    console.log(`Converged                 : ${receipt.scorecard.converged}`);
    console.log(`Integrity SHA-256         : ${receipt.sha256}`);
  }
}

async function cmd_crucible_attack(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const target = getTarget(args, commandContext);
  const vType = args.includes("--injection")
    ? "PROMPT_INJECTION"
    : args.includes("--payload")
      ? "PATHOLOGICAL_PAYLOAD"
      : args.includes("--race")
        ? "RACE_CONDITION"
        : "INVARIANT_VIOLATION";

  const crucible = new EosAdversarialRedTeamCrucible();
  const attack = crucible.launchAttack(target, vType);

  if (isJson) {
    console.log(JSON.stringify(attack, null, 2));
  } else {
    console.log(`[CRUCIBLE] Generated Adversarial Attack:`);
    console.log(`ID         : ${attack.id}`);
    console.log(`Type       : ${attack.vectorType}`);
    console.log(`Target     : ${attack.target}`);
    console.log(`Invariant  : ${attack.expectedInvariant}`);
    console.log(`SHA-256    : ${attack.sha256}`);
  }
}

async function cmd_crucible_patch(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const target = getTarget(args, commandContext);
  const crucible = new EosAdversarialRedTeamCrucible();

  const ce = {
    id: `CEGIS-SAMPLE-${Date.now().toString(36)}`,
    attackId: "ATK-SAMPLE-0001",
    vectorType: "INVARIANT_VIOLATION",
    payload: { command: "TRANSFER_CREDITS", amount: -500 },
    violatedInvariant: "BALANCE_INTEGRITY_NON_NEGATIVE",
    priorState: { balance: 100 },
    posteriorState: { balance: -400 },
    timestamp: Date.now(),
  };

  const patch = crucible.synthesizePatch(ce, 1);
  crucible.registerPatch(target, patch);

  if (isJson) {
    console.log(JSON.stringify(patch, null, 2));
  } else {
    console.log(`[CRUCIBLE] Synthesized CEGIS Defensive Patch:`);
    console.log(`ID         : ${patch.id}`);
    console.log(`Rule       : ${patch.ruleName}`);
    console.log(`Action     : ${patch.action}`);
    console.log(`Guard      : ${patch.guardExpression}`);
    console.log(`Neutralized: ${patch.neutralizesAttack}`);
    console.log(`Regression : ${patch.regressionPass ? "PASSED" : "FAILED"}`);
  }
}

async function cmd_crucible_tournament(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const target = getTarget(args, commandContext);
  const roundsArg = args.find((a) => a.startsWith("--rounds="));
  const rounds = roundsArg ? Number.parseInt(roundsArg.split("=")[1], 10) : 4;

  const crucible = new EosAdversarialRedTeamCrucible();
  const scorecard = crucible.executeTournament(target, rounds, 4);

  if (isJson) {
    console.log(JSON.stringify(scorecard, null, 2));
  } else {
    console.log(`=== Minimax Tournament Scorecard ===`);
    console.log(`Tournament ID      : ${scorecard.tournamentId}`);
    console.log(`Target             : ${scorecard.target}`);
    console.log(`Total Rounds       : ${scorecard.totalRounds}`);
    console.log(`Final State        : ${scorecard.finalState}`);
    console.log(`Initial Exploit %  : ${scorecard.initialPenetrationRate}%`);
    console.log(`Final Exploit %    : ${scorecard.finalPenetrationRate}%`);
    console.log(`Robustness Score   : ${scorecard.robustnessScore}/100`);
    console.log(`Patches Applied    : ${scorecard.patchesCount}`);
    console.log(`Converged          : ${scorecard.converged}`);
  }
}

HANDLERS["toolchain:crucible:audit"] = cmd_crucible_audit;
HANDLERS["toolchain:crucible:attack"] = cmd_crucible_attack;
HANDLERS["toolchain:crucible:patch"] = cmd_crucible_patch;
HANDLERS["toolchain:crucible:tournament"] = cmd_crucible_tournament;

export async function handleAdversarialRedTeamCrucibleCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:crucible command: ${command}`);
  }
  await handler(commandContext);
  return true;
}

export function registerCommands(router) {
  for (const [cmd, fn] of Object.entries(HANDLERS)) {
    router.register(cmd, fn);
  }
}

export { cmd_crucible_audit, cmd_crucible_attack, cmd_crucible_patch, cmd_crucible_tournament };
