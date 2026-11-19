/**
 * @file cliDiscreteEventSimulationHypervisor.mjs
 * @description CLI handler for SPEC-334 / CHANGE-196: Deterministic Discrete-Event Simulation
 * Hypervisor & Time-Travel Fault Injection Engine (DESH).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosDiscreteEventSimulationHypervisorCore } from "../../src/core/eosDiscreteEventSimulationHypervisor.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("DESH_RECEIPT.json", root);
}

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_desh_schedule(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const eventType = parseFlagValue(args, "--type=", "HEARTBEAT");
  const delayNs = Number(parseFlagValue(args, "--delay=", "50000000"));
  const source = parseFlagValue(args, "--source=", "node-leader");
  const target = parseFlagValue(args, "--target=", "node-replica-1");

  const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: "cli-seed-1" });
  hypervisor.registerNode(source, "COORDINATOR");
  hypervisor.registerNode(target, "REPLICA");

  const scheduledEvent = hypervisor.sendEvent(source, target, eventType, { msg: "ping" }, delayNs);

  const payload = {
    command: "toolchain:desh:schedule",
    scheduledEvent,
    virtualTimeNs: hypervisor.getVirtualTimeNs(),
    queueLength: hypervisor.getQueueLength(),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== DESH: Discrete Event Scheduled ===");
    console.log(`Event ID       : ${scheduledEvent.id}`);
    console.log(`Event Type     : ${scheduledEvent.eventType}`);
    console.log(`Source -> Target: ${scheduledEvent.sourceNodeId} -> ${scheduledEvent.targetNodeId}`);
    console.log(`Scheduled Time : ${scheduledEvent.scheduledTimeNs} ns`);
    console.log(`Queue Length   : ${payload.queueLength}`);
  }
}

async function cmd_desh_step(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const steps = Number(parseFlagValue(args, "--steps=", "3"));

  const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: "cli-step-seed" });
  hypervisor.registerNode("node-a", "SENDER");
  hypervisor.registerNode("node-b", "RECEIVER");

  hypervisor.sendEvent("node-a", "node-b", "MSG-1", { data: 1 }, 1000);
  hypervisor.sendEvent("node-a", "node-b", "MSG-2", { data: 2 }, 2000);
  hypervisor.sendEvent("node-a", "node-b", "MSG-3", { data: 3 }, 3000);

  const stepResults = [];
  for (let i = 0; i < steps; i++) {
    const res = hypervisor.step();
    stepResults.push(res);
  }

  const payload = {
    command: "toolchain:desh:step",
    stepsExecuted: stepResults.length,
    finalVirtualTimeNs: hypervisor.getVirtualTimeNs(),
    results: stepResults,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== DESH: Simulation Step Execution ===");
    console.log(`Steps Executed   : ${payload.stepsExecuted}`);
    console.log(`Final Virtual Time: ${payload.finalVirtualTimeNs} ns`);
    for (const res of stepResults) {
      if (res.event) {
        console.log(` - Event ${res.event.id} dispatched at ${res.virtualTimeNs} ns`);
      }
    }
  }
}

async function cmd_desh_inject(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const faultType = parseFlagValue(args, "--fault=", "NETWORK_PARTITION");

  const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: "cli-fault-seed" });
  hypervisor.registerNode("node-east-1", "BROKER");
  hypervisor.registerNode("node-west-1", "BROKER");

  let faultRule;
  if (faultType === "NETWORK_PARTITION") {
    faultRule = hypervisor.setPartition(["node-east-1"], ["node-west-1"]);
  } else {
    faultRule = hypervisor.addFaultRule({
      type: "PACKET_DROP",
      probability: 1.0,
      sourceNodeId: "node-east-1",
      targetNodeId: "node-west-1",
      active: true,
    });
  }

  hypervisor.sendEvent("node-east-1", "node-west-1", "SYNC", { count: 10 }, 500);
  const stepRes = hypervisor.step();

  const payload = {
    command: "toolchain:desh:inject",
    faultRule,
    faultApplied: stepRes.faultApplied,
    delivered: !stepRes.faultApplied,
    virtualTimeNs: hypervisor.getVirtualTimeNs(),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== DESH: Byzantine Fault Injection ===");
    console.log(`Fault ID     : ${faultRule.faultId}`);
    console.log(`Fault Type   : ${faultRule.type}`);
    console.log(`Fault Applied: ${payload.faultApplied}`);
    console.log(`Delivered    : ${payload.delivered}`);
  }
}

async function cmd_desh_rollback(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: "cli-rollback-seed" });
  hypervisor.registerNode("node-1", "LEADER", { stateVal: "INITIAL" });
  hypervisor.sendEvent("node-1", "node-1", "STEP_A", {}, 100);
  hypervisor.step();

  const checkpoint = hypervisor.createCheckpoint("cp-snapshot-1");

  hypervisor.sendEvent("node-1", "node-1", "STEP_B", {}, 200);
  hypervisor.step();
  const timeAfterStepB = hypervisor.getVirtualTimeNs();

  const rollbackSuccess = hypervisor.rollback("cp-snapshot-1");
  const timeAfterRollback = hypervisor.getVirtualTimeNs();

  const payload = {
    command: "toolchain:desh:rollback",
    checkpointId: checkpoint.checkpointId,
    stateHash: checkpoint.stateHash,
    timeAfterStepB,
    timeAfterRollback,
    rollbackSuccess,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== DESH: Time-Travel Rollback ===");
    console.log(`Checkpoint ID      : ${payload.checkpointId}`);
    console.log(`State Hash SHA-256 : ${payload.stateHash}`);
    console.log(`Time Before Rollback: ${payload.timeAfterStepB} ns`);
    console.log(`Time After Rollback : ${payload.timeAfterRollback} ns`);
    console.log(`Rollback Verified  : ${payload.rollbackSuccess}`);
  }
}

async function cmd_desh_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seed = parseFlagValue(args, "--seed=", "sovereign-audit-seed-42");

  const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed });
  hypervisor.registerNode("alpha", "COORDINATOR", { eventCount: 0 });
  hypervisor.registerNode("beta", "WORKER", { eventCount: 0 });

  hypervisor.sendEvent("alpha", "beta", "JOB-1", { task: "compute" }, 100);
  hypervisor.sendEvent("beta", "alpha", "JOB-DONE", { status: "OK" }, 200);
  hypervisor.step();
  hypervisor.createCheckpoint("audit-cp-1");
  hypervisor.step();

  const receipt = hypervisor.audit();
  const root = commandContext.root || ROOT;
  const receiptPath = getReceiptPath(root);

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== DESH: Audit Receipt ===");
    console.log(`Run ID               : ${receipt.runId}`);
    console.log(`Seed                 : ${receipt.seed}`);
    console.log(`Virtual Time         : ${receipt.virtualTimeNs} ns`);
    console.log(`Events Processed     : ${receipt.eventsProcessed}`);
    console.log(`Faults Injected      : ${receipt.faultsInjected}`);
    console.log(`Checkpoints Created  : ${receipt.checkpointsCreated}`);
    console.log(`Virtual Time Monot   : ${receipt.virtualTimeMonotonicity}`);
    console.log(`PRNG Determinism     : ${receipt.prngDeterminism}`);
    console.log(`Snapshot Consistency : ${receipt.snapshotConsistency}`);
    console.log(`Audit Hash SHA-256   : ${receipt.auditHash}`);
    console.log(`Receipt Saved        : ${receiptPath}`);
  }
}

HANDLERS["toolchain:desh:schedule"] = cmd_desh_schedule;
HANDLERS["toolchain:desh:step"] = cmd_desh_step;
HANDLERS["toolchain:desh:inject"] = cmd_desh_inject;
HANDLERS["toolchain:desh:rollback"] = cmd_desh_rollback;
HANDLERS["toolchain:desh:audit"] = cmd_desh_audit;

export async function handleDiscreteEventSimulationHypervisorCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:desh command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
