/**
 * @file cliCausalMetaLearning.mjs
 * @description CLI handler for SPEC-353 / CHANGE-215: Autonomous Causal Meta-Learning & Counterfactual Policy Engine.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EosDoCalculusEngine,
  EosCounterfactualReasoner,
  EosCausalMetaLearningCore,
} from "../../src/core/eosCausalMetaLearning.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("CAUSAL_META_LEARNING_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_causal_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosCausalMetaLearningCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Autonomous Causal Meta-Learning & Counterfactual Policy Engine (SPEC-353) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Status                  : ${receipt.status}`);
    console.log(`SCM Nodes               : ${receipt.scmNodesCount}`);
    console.log(`SCM Edges               : ${receipt.scmEdgesCount}`);
    console.log(`Topological Sort        : ${receipt.topologicalOrder.join(" -> ")}`);
    console.log(`Backdoor Criterion      : ${receipt.backdoorVerified ? "PASS" : "FAIL"}`);
    console.log(`3-Step Counterfactual   : ${receipt.counterfactualVerified ? "PASS" : "FAIL"}`);
    console.log(`ATE Policy Distillation : ${receipt.ateVerified ? "PASS" : "FAIL"}`);
    console.log(`TLC Model Verification  : ${receipt.tlcModelPass ? "PASS" : "FAIL"}`);
    console.log(`Receipt SHA-256         : ${receipt.sha256Receipt.slice(0, 16)}...`);
    console.log(`Receipt Saved           : ${receiptPath}`);
  }
}

async function cmd_causal_intervene(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const scm = EosCausalMetaLearningCore.generateReferenceModel();
  const mutilated = EosDoCalculusEngine.applyIntervention(scm, { X_policy: 1 });

  const result = {
    originalEdgesCount: scm.getEdges().length,
    mutilatedEdgesCount: mutilated.mutilatedScm.getEdges().length,
    severedEdges: mutilated.severedEdges,
    interventions: mutilated.interventions,
    topologicalOrder: mutilated.mutilatedScm.getTopologicalOrder(),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Pearl's Do-Calculus Graph Surgery ===");
    console.log(`Original Edge Count     : ${result.originalEdgesCount}`);
    console.log(`Mutilated Edge Count    : ${result.mutilatedEdgesCount}`);
    console.log(
      `Severed Parent Edges    : ${result.severedEdges.map((e) => `${e.from} -> ${e.to}`).join(", ") || "None"}`,
    );
    console.log(`Intervention Assignment : ${JSON.stringify(result.interventions)}`);
    console.log(`Mutilated Topo Order    : ${result.topologicalOrder.join(" -> ")}`);
  }
}

async function cmd_causal_counterfactual(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const scm = EosCausalMetaLearningCore.generateReferenceModel();
  const cf = EosCounterfactualReasoner.evaluateCounterfactual(scm, {
    observedEvidence: {
      W_workload: 60,
      X_policy: 1,
      M_queue: 17,
      Y_latency: 155,
    },
    intervention: { X_policy: 0 },
    targetVariable: "Y_latency",
  });

  if (isJson) {
    console.log(JSON.stringify(cf, null, 2));
  } else {
    console.log("=== Three-Step Algorithmic Counterfactual Evaluation ===");
    console.log(`Observed Factual Value  : Y_latency = ${cf.factualValue} ms (under X_policy = 1)`);
    console.log(`Abducted Exogenous Noise: ${JSON.stringify(cf.abductedNoise)}`);
    console.log(`Counterfactual Value    : Y_latency = ${cf.counterfactualValue} ms (had X_policy been 0)`);
    console.log(`Individual Treatment Eff: ${cf.individualTreatmentEffect} ms (ITE)`);
  }
}

HANDLERS["toolchain:causal:audit"] = cmd_causal_audit;
HANDLERS["toolchain:causal:intervene"] = cmd_causal_intervene;
HANDLERS["toolchain:causal:counterfactual"] = cmd_causal_counterfactual;

export async function handleCausalMetaLearningCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:causal command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
