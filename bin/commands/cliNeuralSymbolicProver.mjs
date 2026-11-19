/**
 * @file cliNeuralSymbolicProver.mjs
 * @description CLI handler for SPEC-349 / CHANGE-211: Self-Synthesizing Neural-Symbolic Prover.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosNeuralSymbolicProverCore } from "../../src/core/eosNeuralSymbolicProver.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("NEURAL_SYMBOLIC_PROVER_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_prover_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosNeuralSymbolicProverCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Self-Synthesizing Neural-Symbolic Prover (SPEC-349) ===");
    console.log(`Spec                   : ${receipt.specId}`);
    console.log(`Status                 : ${receipt.status}`);
    console.log(`CDCL SAT Engine        : ${receipt.satSolverVerified ? "PASS" : "FAIL"}`);
    console.log(`Bound Propagation      : ${receipt.boundPropagationVerified ? "PASS" : "FAIL"}`);
    console.log(`Inductive Synthesis    : ${receipt.inductiveSynthesisVerified ? "PASS" : "FAIL"}`);
    console.log(`CEGAR Refinement Loop  : ${receipt.cegarRefinementVerified ? "PASS" : "FAIL"}`);
    console.log(`Active Synthesizers    : ${receipt.activeSynthesizers.join(", ")}`);
    console.log(`Proof Certificate      : ${receipt.proofCertificateSha256}`);
    console.log(`Receipt Saved          : ${receiptPath}`);
  }
}

async function cmd_prover_sat(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  // Sample CNF: (x1 or x2) and (!x1 or x3) and (!x2 or !x3)
  const formula = [
    [1, 2],
    [-1, 3],
    [-2, -3],
  ];
  const res = EosNeuralSymbolicProverCore.solveCnf(formula);

  if (isJson) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log("=== Propositional DPLL/CDCL SAT Evaluation ===");
    console.log(`Formula CNF   : (x1 ∨ x2) ∧ (¬x1 ∨ x3) ∧ (¬x2 ∨ ¬x3)`);
    console.log(`Satisfiable   : ${res.sat ? "YES" : "NO"}`);
    console.log(`Assignment    :`, JSON.stringify(res.assignment));
    console.log(`Decisions     : ${res.decisionsCount}`);
    console.log(`Learned Lemas : ${res.learnedClausesCount}`);
  }
}

async function cmd_prover_synth(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const initStates = [{ tokens: 10, capacity: 10 }];
  const transitionFn = (s) => {
    const next = [];
    if (s.tokens > 0) next.push({ tokens: s.tokens - 1, capacity: s.capacity });
    if (s.tokens < s.capacity) next.push({ tokens: s.tokens + 1, capacity: s.capacity });
    return next;
  };
  const safetyFn = (s) => s.tokens >= 0 && s.tokens <= s.capacity;
  const initialTraces = [
    { tokens: 10, capacity: 10 },
    { tokens: 8, capacity: 10 },
  ];
  const sampleSpace = [];
  for (let t = 0; t <= 10; t++) {
    sampleSpace.push({ tokens: t, capacity: 10 });
  }

  const result = EosNeuralSymbolicProverCore.runCegarLoop(
    initStates,
    transitionFn,
    safetyFn,
    initialTraces,
    sampleSpace,
    10,
  );

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          predicate: result.synthesizedPredicate.expression,
          refinementRounds: result.refinementRounds,
          inductive: result.finalVerification.inductive,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("=== Autonomous Inductive Invariant Synthesis (CEGAR) ===");
    console.log(`Synthesized Invariant : ${result.synthesizedPredicate.expression}`);
    console.log(`Refinement Rounds     : ${result.refinementRounds}`);
    console.log(`Initiation Proven     : ${result.finalVerification.initiated ? "PASS" : "FAIL"}`);
    console.log(`Consecution Proven    : ${result.finalVerification.consecutive ? "PASS" : "FAIL"}`);
    console.log(`Safety Adequate       : ${result.finalVerification.safe ? "PASS" : "FAIL"}`);
    console.log(`Inductive Soundness   : ${result.finalVerification.inductive ? "PASS" : "FAIL"}`);
  }
}

HANDLERS["toolchain:prover:audit"] = cmd_prover_audit;
HANDLERS["toolchain:prover:sat"] = cmd_prover_sat;
HANDLERS["toolchain:prover:synth"] = cmd_prover_synth;

export async function handleNeuralSymbolicProverCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:prover command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
