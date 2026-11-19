/**
 * @file cliInductiveProofEngine.mjs
 * @description CLI handler for SPEC-360 / CHANGE-222: Autonomous Formal Verification & Metamorphic Proof Engine.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EosInductiveInvariantSynthesizer,
  EosInductiveProofEngineCore,
  EosMetamorphicRelationEngine,
} from "../../src/core/eosInductiveProofEngine.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("INDUCTIVE_PROOF_ENGINE_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_proof_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosInductiveProofEngineCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Autonomous Formal Verification & Metamorphic Proof Engine (SPEC-360) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`CEGIS Converged         : ${receipt.cegisResult.converged ? "YES" : "NO"}`);
    console.log(`Lemmas Synthesized      : ${receipt.cegisResult.synthesizedLemmas.length}`);
    console.log(`Counterexamples Pruned  : ${receipt.cegisResult.totalCounterexamplesPruned}`);
    console.log(`Metamorphic Symmetry    : ${receipt.metamorphicReport.symmetryPreserved ? "PRESERVED" : "VIOLATED"}`);
    console.log(`Transformations Tested  : ${receipt.metamorphicReport.transformationsTested}`);
    console.log(
      `Throughput              : ${Math.round(receipt.benchmark.throughputTransitionsSec).toLocaleString()} trans/sec`,
    );
    console.log(`Avg Lemma Latency       : ${receipt.benchmark.avgLemmaSynthesisLatencyUs.toFixed(1)} µs`);
    console.log(`TLC Model Verification  : ${receipt.tlcModelVerified ? "PASS" : "FAIL"}`);
    console.log(`Verdict                 : ${receipt.verdict}`);
    console.log(`Epistemic State         : ${receipt.epistemicState}`);
    console.log(`Receipt Saved           : ${receiptPath}`);
  }
}

async function cmd_proof_synthesize(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const initStates = [{ count: 0, status: "INIT" }];
  const candidateStates = [
    { count: 0, status: "INIT" },
    { count: 1, status: "ACTIVE" },
    { count: 2, status: "CORRUPTED" },
  ];
  const transitions = [(s) => ({ count: Number(s.count) + 1, status: s.status === "CORRUPTED" ? "FAILED" : "ACTIVE" })];
  const baseProperty = {
    name: "UncorruptedSafety",
    predicate: (s) => s.status !== "FAILED",
  };

  const result = EosInductiveInvariantSynthesizer.synthesize(initStates, candidateStates, transitions, baseProperty, 5);

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== CEGIS Inductive Invariant Synthesis ===");
    console.log(`Converged          : ${result.converged ? "YES" : "NO"}`);
    console.log(`Iterations         : ${result.iterations}`);
    console.log(`Base Case Verified : ${result.baseCaseVerified}`);
    console.log(`Inductive Step     : ${result.inductiveStepVerified}`);
    console.log(`Synthesized Lemmas : ${result.synthesizedLemmas.length}`);
    for (const l of result.synthesizedLemmas) {
      console.log(`  - [${l.id}] ${l.expression}`);
    }
  }
}

async function cmd_proof_verify(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const states = [
    { id: "A", val: 10, timestamp: 1000 },
    { id: "B", val: 20, timestamp: 2000 },
  ];
  const transition = (s) => ({ ...s, val: s.val * 2 });
  const invariant = (s) => typeof s.val === "number" && s.val > 0;

  const report = EosMetamorphicRelationEngine.testMetamorphicRelations(states, transition, invariant);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== Metamorphic Symmetry Verification ===");
    console.log(`Transformations Tested : ${report.transformationsTested}`);
    console.log(`Invariants Checked     : ${report.invariantsChecked}`);
    console.log(`Symmetry Preserved     : ${report.symmetryPreserved ? "YES (100% Equivalent)" : "NO"}`);
    console.log(`Violations             : ${report.violations.length}`);
  }
}

async function cmd_proof_bench(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const metrics = EosInductiveProofEngineCore.runBenchmark(1000);

  if (isJson) {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    console.log("=== Inductive Proof Synthesis Benchmark ===");
    console.log(`Transitions Evaluated : ${metrics.transitionsEvaluated.toLocaleString()}`);
    console.log(`Lemmas Synthesized    : ${metrics.lemmasSynthesized.toLocaleString()}`);
    console.log(`Total Duration        : ${metrics.totalDurationUs.toFixed(1)} µs`);
    console.log(`Avg Lemma Latency     : ${metrics.avgLemmaSynthesisLatencyUs.toFixed(1)} µs`);
    console.log(`Throughput            : ${Math.round(metrics.throughputTransitionsSec).toLocaleString()} trans/sec`);
  }
}

HANDLERS["toolchain:proof:audit"] = cmd_proof_audit;
HANDLERS["toolchain:proof:synthesize"] = cmd_proof_synthesize;
HANDLERS["toolchain:proof:verify"] = cmd_proof_verify;
HANDLERS["toolchain:proof:bench"] = cmd_proof_bench;

export async function handleInductiveProofEngineCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:proof command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
