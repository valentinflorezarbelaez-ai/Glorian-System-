/**
 * @file cliZkCircuitSynthesizer.mjs
 * @description CLI handler for SPEC-350 / CHANGE-212: Autonomous Zero-Knowledge Circuit Synthesizer.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosZkCircuitSynthesizerCore } from "../../src/core/eosZkCircuitSynthesizer.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("ZK_CIRCUIT_SYNTHESIZER_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_zkcirc_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosZkCircuitSynthesizerCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Autonomous Zero-Knowledge Circuit Synthesizer (SPEC-350) ===");
    console.log(`Spec                   : ${receipt.specId}`);
    console.log(`Status                 : ${receipt.status}`);
    console.log(`Field Arithmetic       : ${receipt.fieldArithmeticVerified ? "PASS" : "FAIL"}`);
    console.log(`R1CS Arithmetization   : ${receipt.r1csSynthesisVerified ? "PASS" : "FAIL"}`);
    console.log(`Boolean Enforcement    : ${receipt.booleanEnforcementVerified ? "PASS" : "FAIL"}`);
    console.log(`Multiplexer Integrity  : ${receipt.multiplexerVerified ? "PASS" : "FAIL"}`);
    console.log(`Witness Satisfied      : ${receipt.witnessSatisfied ? "PASS" : "FAIL"}`);
    console.log(`Constraints Compiled   : ${receipt.constraintsCount}`);
    console.log(`Proof Certificate      : ${receipt.proofCertificateSha256}`);
    console.log(`Receipt Saved          : ${receiptPath}`);
  }
}

async function cmd_zkcirc_compile(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const circ = new EosZkCircuitSynthesizerCore();
  const a = circ.allocatePublicInput("a");
  const b = circ.allocatePrivateInput("b");
  const c = circ.allocatePublicInput("c");
  circ.enforceMul(a, b, c, "a * b == c");

  const compiled = circ.compile();

  if (isJson) {
    console.log(JSON.stringify(compiled, null, 2));
  } else {
    console.log("=== Compiled Zero-Knowledge R1CS Circuit ===");
    console.log(`Field Prime            : ${compiled.prime}`);
    console.log(`Total Variables        : ${compiled.variables.length}`);
    console.log(`Public Inputs          : ${compiled.publicInputsCount}`);
    console.log(`Private Inputs         : ${compiled.privateInputsCount}`);
    console.log(`R1CS Constraints       : ${compiled.constraints.length}`);
  }
}

async function cmd_zkcirc_verify(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const circ = new EosZkCircuitSynthesizerCore();
  const a = circ.allocatePublicInput("a");
  const b = circ.allocatePrivateInput("b");
  const c = circ.allocatePublicInput("c");
  circ.enforceMul(a, b, c, "a * b == c");

  // a = 3, b = 4, c = 12
  const witness = [1n, 3n, 4n, 12n];
  const res = circ.verifyWitness(witness);

  if (isJson) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log("=== Zero-Knowledge Witness Verification ===");
    console.log(`Constraint Relation    : a * b == c (3 * 4 == 12)`);
    console.log(`Satisfied              : ${res.satisfied ? "PASS" : "FAIL"}`);
  }
}

HANDLERS["toolchain:zkcirc:audit"] = cmd_zkcirc_audit;
HANDLERS["toolchain:zkcirc:compile"] = cmd_zkcirc_compile;
HANDLERS["toolchain:zkcirc:verify"] = cmd_zkcirc_verify;

export async function handleZkCircuitSynthesizerCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:zkcirc command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
