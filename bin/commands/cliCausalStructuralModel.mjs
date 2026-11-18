/**
 * @file cliCausalStructuralModel.mjs
 * @description CLI handler for SPEC-338 / CHANGE-200: Autonomous Causal Discovery &
 * Structural Equation Modeling Engine (SCM).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosCausalStructuralModelCore } from "../../src/core/eosCausalStructuralModel.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/CAUSAL_SCM_RECEIPT.json");

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_scm_dsep(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const source = parseFlagValue(args, "--source=", "X");
  const target = parseFlagValue(args, "--target=", "D");
  const condRaw = parseFlagValue(args, "--given=", "C");
  const conditionedOn = condRaw ? condRaw.split(",").filter(Boolean) : [];

  const scm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();
  const res = scm.isDSeparated(source, target, conditionedOn);

  const payload = {
    command: "toolchain:scm:dsep",
    ...res,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Causal SCM: Lauritzen-Spiegelhalter d-Separation ===");
    console.log(`Query              : ${res.source} _||_ ${res.target} | {${res.conditionedOn.join(", ")}}`);
    console.log(`d-Separated        : ${res.dSeparated}`);
    console.log(`Ancestral Subgraph : ${res.ancestralSubgraphNodes.join(", ")}`);
  }
}

async function cmd_scm_backdoor(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const treatment = parseFlagValue(args, "--treatment=", "X");
  const outcome = parseFlagValue(args, "--outcome=", "Y");
  const setRaw = parseFlagValue(args, "--set=", "Z");
  const candidateSet = setRaw ? setRaw.split(",").filter(Boolean) : [];

  const scm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();
  const report = scm.verifyBackdoorCriterion(treatment, outcome, candidateSet);

  const payload = {
    command: "toolchain:scm:backdoor",
    ...report,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Causal SCM: Backdoor Criterion Verification ===");
    console.log(`Treatment -> Outcome: ${report.treatment} -> ${report.outcome}`);
    console.log(`Adjustment Set      : {${report.candidateSet.join(", ")}}`);
    console.log(`No Descendants of X : ${!report.containsDescendantsOfTreatment}`);
    console.log(`Blocks Backdoor     : ${report.blocksAllBackdoorPaths}`);
    console.log(`Valid Backdoor Set  : ${report.validBackdoorSet}`);
  }
}

async function cmd_scm_intervene(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const treatedValue = Number(parseFlagValue(args, "--treated=", "1"));
  const controlValue = Number(parseFlagValue(args, "--control=", "0"));

  const scm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();
  const report = scm.computeInterventionalAte("X", "Y", treatedValue, controlValue);

  const payload = {
    command: "toolchain:scm:intervene",
    ...report,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Causal SCM: Surgical do(X := x) Intervention ===");
    console.log(`Severed Incoming    : ${report.severedParents.join(", ")} -/-> ${report.treatment}`);
    console.log(`E[Y | do(X=${treatedValue})]     : ${report.expectedOutcomeTreated.toFixed(4)}`);
    console.log(`E[Y | do(X=${controlValue})]     : ${report.expectedOutcomeControl.toFixed(4)}`);
    console.log(`Interventional ATE  : ${report.trueInterventionalAte.toFixed(4)}`);
  }
}

async function cmd_scm_counterfactual(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const cfX = Number(parseFlagValue(args, "--do-x=", "3.0"));

  const scm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();
  const factual = scm.evaluateForward({ Z: 1.0, X: 0.5, Y: -0.2, C: 0, D: 0 });
  const cf = scm.inferCounterfactual({
    factualEvidence: factual,
    interventions: { X: cfX },
    targetVariable: "Y",
  });

  const payload = {
    command: "toolchain:scm:counterfactual",
    ...cf,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Causal SCM: 3-Step Counterfactual (Abduction -> Action -> Prediction) ===");
    console.log(`Factual X / Y       : ${factual.X.toFixed(4)} / ${cf.factualTargetValue.toFixed(4)}`);
    console.log(`Counterfactual do(X): ${cfX.toFixed(4)}`);
    console.log(`Counterfactual Y_x' : ${cf.counterfactualTargetValue.toFixed(4)}`);
    console.log(`Individual Effect   : ${cf.individualTreatmentEffect.toFixed(4)}`);
  }
}

async function cmd_scm_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const scm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();
  const receipt = scm.audit();

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Causal SCM: Audit Receipt ===");
    console.log(`DAG Acyclic Guard   : ${receipt.dagAcyclicEnforced}`);
    console.log(`Collider d-Sep      : ${receipt.colliderDsepVerified}`);
    console.log(`Backdoor De-biased  : ${receipt.backdoorDeconfounded}`);
    console.log(`do(X) Exact ATE     : ${receipt.doInterventionExact} (ATE=${receipt.trueAte})`);
    console.log(`Naive vs Adjusted   : ${receipt.naiveBiasedSlope} vs ${receipt.backdoorAdjustedAte}`);
    console.log(`Counterfactual Cons.: ${receipt.counterfactualConsistent}`);
    console.log(`All Passed          : ${receipt.allPassed}`);
    console.log(`SHA-256 Digest      : ${receipt.sha256Digest}`);
    console.log(`Receipt Saved       : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:scm:dsep"] = cmd_scm_dsep;
HANDLERS["toolchain:scm:backdoor"] = cmd_scm_backdoor;
HANDLERS["toolchain:scm:intervene"] = cmd_scm_intervene;
HANDLERS["toolchain:scm:counterfactual"] = cmd_scm_counterfactual;
HANDLERS["toolchain:scm:audit"] = cmd_scm_audit;

export async function handleCausalStructuralModelCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:scm command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
