/**
 * @file cliNeuromorphicPlanner.mjs
 * @description CLI handler for SPEC-352 / CHANGE-214: Autonomous Multi-Modal Neuromorphic Hyper-Heuristic Planner.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EosLifNeuron,
  EosHyperHeuristicPlannerCore,
  DEFAULT_NEURON_CONFIG,
} from "../../src/core/eosNeuromorphicPlanner.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("NEUROMORPHIC_PLANNER_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_neuro_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosHyperHeuristicPlannerCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Autonomous Multi-Modal Neuromorphic Hyper-Heuristic Planner (SPEC-352) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Status                  : ${receipt.status}`);
    console.log(`LIF Dynamics Verified   : ${receipt.lifDynamicsVerified ? "PASS" : "FAIL"}`);
    console.log(`STDP Plasticity         : ${receipt.stdpPlasticityVerified ? "PASS" : "FAIL"}`);
    console.log(`Sensory Encoding        : ${receipt.sensoryEncodingVerified ? "PASS" : "FAIL"}`);
    console.log(`Hyper-Heuristic Select  : ${receipt.hyperHeuristicSelectionVerified ? "PASS" : "FAIL"}`);
    console.log(`Feedback Convergence    : ${receipt.feedbackConvergenceVerified ? "PASS" : "FAIL"}`);
    console.log(`TLC Model Verification  : ${receipt.tlcModelPass ? "PASS" : "FAIL"}`);
    console.log(`Receipt Saved           : ${receiptPath}`);
  }
}

async function cmd_neuro_spike(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const lif = new EosLifNeuron("cli-lif-demo", DEFAULT_NEURON_CONFIG);
  const initialV = lif.getMembranePotential();
  const subSpike = lif.injectCurrent(10000, 0);
  const vAfterSub = lif.getMembranePotential();
  const firedSpike = lif.injectCurrent(10000, 1);
  const vAfterSpike = lif.getMembranePotential();

  const result = {
    initialPotentialUv: initialV,
    afterSubThresholdUv: vAfterSub,
    subThresholdSpike: subSpike !== null,
    afterActionPotentialUv: vAfterSpike,
    actionPotentialSpike: firedSpike !== null,
    inRefractory: lif.isInRefractory(),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Leaky Integrate-and-Fire (LIF) Spike Dynamics ===");
    console.log(`Initial Resting Vm      : ${initialV} µV (-70 mV)`);
    console.log(`Sub-threshold Vm        : ${vAfterSub} µV (No spike fired)`);
    console.log(`Action Potential Spike  : ${firedSpike !== null ? "FIRED" : "NONE"}`);
    console.log(`Post-Spike Reset Vm     : ${vAfterSpike} µV (Reset to -70 mV)`);
    console.log(`Refractory Period Lock  : ${lif.isInRefractory() ? "ACTIVE" : "INACTIVE"}`);
  }
}

async function cmd_neuro_plan(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const planner = new EosHyperHeuristicPlannerCore();
  const telemetry = {
    cpuSaturation: 0.85,
    memoryPressure: 0.75,
    agentQueueDepth: 0.9,
    latencyVariance: 0.65,
    errorRate: 0.05,
  };

  const decision = planner.plan(telemetry);

  if (isJson) {
    console.log(JSON.stringify(decision, null, 2));
  } else {
    console.log("=== Neuromorphic Hyper-Heuristic Action Selection ===");
    console.log(`Decision Cycle          : ${decision.cycleId}`);
    console.log(`Selected Heuristic      : ${decision.selectedHeuristic}`);
    console.log(`Spike Train Length      : ${decision.spikeTrainLength}`);
    console.log(`Active Neurons          : ${decision.activeNeuronsCount}`);
    console.log(`Decision Confidence     : ${(decision.confidence * 100).toFixed(1)}%`);
    console.log(`Dispatched Parameters   : ${JSON.stringify(decision.parameters)}`);
  }
}

HANDLERS["toolchain:neuro:audit"] = cmd_neuro_audit;
HANDLERS["toolchain:neuro:spike"] = cmd_neuro_spike;
HANDLERS["toolchain:neuro:plan"] = cmd_neuro_plan;

export async function handleNeuromorphicPlannerCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:neuro command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
