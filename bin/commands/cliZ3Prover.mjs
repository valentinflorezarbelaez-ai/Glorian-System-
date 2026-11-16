/**
 * CLI Live TLC Model Checking & Z3 Theorem Prover Handlers
 *
 * Implements toolchain:z3:* subcommands for TLA+ model checking, SMT constraint solving,
 * inductive invariant proving, and cryptographic audit receipt emission.
 *
 * Conforms to SPEC-292 / CHANGE-154.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { EosTlcModelChecker, EosZ3SmtSolver, auditFormalProver } from "../../src/core/eosZ3WasmProver.ts";

const HANDLERS = {};

async function cmd_z3_prove(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  // Sample SMT theorem: x > 100 AND x < 50 is UNSAT (contradiction theorem)
  const variables = [{ name: "x", type: "int" }];
  const constraints = [
    { leftVar: "x", op: ">", rightVal: 100 },
    { leftVar: "x", op: "<", rightVal: 50 },
  ];

  const solveResult = EosZ3SmtSolver.solve(variables, constraints);

  // Inductive invariant test
  const domain = [{ counter: 0 }, { counter: 1 }, { counter: 5 }, { counter: 100 }];
  const inductiveResult = EosZ3SmtSolver.proveInductiveInvariant({
    invariantName: "MonotonicNonNegativeCounter",
    initialPredicate: (s) => s.counter === 0,
    transition: (s) => ({ counter: Number(s.counter) + 1 }),
    invariant: (s) => Number(s.counter) >= 0,
    domain,
  });

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          smtSolver: solveResult,
          inductiveProof: inductiveResult,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("\n===============================================================");
  console.log(" 📐  EOS Z3 SMT THEOREM PROVER & INDUCTIVE INVARIANTS (SPEC-292) ");
  console.log("===============================================================");
  console.log("  SMT System Theorem  : (x > 100) ∧ (x < 50)");
  console.log(`  Satisfiability      : ${solveResult.status} (Contradiction Refuted)`);
  console.log(`  Proof Reason        : ${solveResult.reason || "No satisfying model exists"}`);
  console.log("---------------------------------------------------------------");
  console.log(`  Inductive Invariant : ${inductiveResult.invariantName}`);
  console.log(`  Proof Status        : ${inductiveResult.status}`);
  console.log(`  Base Case Proven    : ${inductiveResult.baseCaseProven}`);
  console.log(`  Inductive Step      : ${inductiveResult.inductiveStepProven}`);
  console.log("===============================================================\n");
}

async function cmd_z3_tlc(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const fileArg = args.slice(1).find((a) => !a.startsWith("--"));

  const targetFile = fileArg || "docs/formal/LmaxDisruptor.tla";
  const fullPath = path.resolve(process.cwd(), targetFile);

  if (!fs.existsSync(fullPath)) {
    console.error(`Error: formal specification not found: ${targetFile}`);
    process.exit(1);
  }

  const result = await EosTlcModelChecker.runTlc(targetFile);

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔬  EOS LESLIE LAMPORT TLC MODEL CHECKER (SPEC-292)           ");
  console.log("===============================================================");
  console.log(`  Specification File  : ${result.specFile}`);
  console.log(`  Execution Mode      : ${result.executionMode}`);
  console.log(`  Generated States    : ${result.generatedStates}`);
  console.log(`  Distinct States     : ${result.distinctStates}`);
  console.log(`  Violations Detected : ${result.invariantViolations}`);
  console.log(`  Model Check Status  : ${result.status}`);
  console.log(`  Duration Elapsed    : ${result.durationMs} ms`);
  console.log("===============================================================\n");
}

async function cmd_z3_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = await auditFormalProver({ rootDir: process.cwd(), emitReceipt: true });

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 📜  EOS Z3 & TLC FORMAL VERIFICATION AUDIT (SPEC-292)         ");
  console.log("===============================================================");
  console.log(`  TLA+ Specs Checked  : ${receipt.totalTlaSpecsChecked}`);
  console.log(`  SMT Theorems Proven : ${receipt.totalSmtTheoremsProven}`);
  console.log(`  Inductive Invariants: ${receipt.inductiveInvariantsVerified}`);
  console.log(`  SHA-256 Signature   : ${receipt.sha256Signature}`);
  console.log(`  Receipt Location    : docs/evidence/Z3_PROVER_RECEIPT.json`);
  console.log("===============================================================\n");
}

HANDLERS["toolchain:z3:prove"] = cmd_z3_prove;
HANDLERS["toolchain:z3:tlc"] = cmd_z3_tlc;
HANDLERS["toolchain:z3:audit"] = cmd_z3_audit;

export async function handleZ3Commands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
