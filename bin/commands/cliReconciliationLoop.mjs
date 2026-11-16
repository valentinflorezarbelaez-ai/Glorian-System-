/**
 * CLI Autonomous Reconciliation Loop Handlers
 *
 * Implements toolchain:reconcile:* subcommands for fleet observation,
 * DAG convergence planning, surgical self-healing, and audit receipts.
 *
 * Conforms to SPEC-307 / CHANGE-169.
 */

import { EosAutonomousReconciliationLoopCore } from "../../src/core/eosAutonomousReconciliationLoop.ts";
import { EosOntologyCyclotron } from "../../src/core/eosOntologyCyclotron.ts";

const HANDLERS = {};
let cliCyclotron = null;

function getCliCyclotron() {
  if (!cliCyclotron) {
    cliCyclotron = new EosOntologyCyclotron();
    const now = Date.now();
    cliCyclotron.registerNode("fleet:control-plane", "CORE_SERVICE", { name: "Glorian Control Plane" }, now);
    cliCyclotron.registerNode("fleet:auth-enclave", "SECURITY_SERVICE", { name: "Hardware TEE" }, now);
    cliCyclotron.registerNode("fleet:agent-mesh", "AGENT_RUNTIME", { name: "Automerge CRDT Mesh" }, now);
    cliCyclotron.registerEdge("fleet:control-plane", "fleet:auth-enclave", "SECURED_BY", 1.0, now);
    cliCyclotron.registerEdge("fleet:control-plane", "fleet:agent-mesh", "SYNCHRONIZES_WITH", 1.0, now);
  }
  return cliCyclotron;
}

async function cmd_reconcile_observe(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const observation = EosAutonomousReconciliationLoopCore.observeFleetState(process.cwd());

  if (isJson) {
    console.log(JSON.stringify(observation, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN FLEET TELEMETRY OBSERVATION (SPEC-307)               `);
  console.log(`===============================================================`);
  console.log(`  Total Projects : ${observation.totalProjectsCount}`);
  console.log(`  Fleet Merkle   : ${observation.fleetMerkleRoot.slice(0, 24)}...`);
  console.log(`---------------------------------------------------------------`);
  for (const p of observation.projects) {
    console.log(`  [${p.status}] ${p.projectId.padEnd(30)} -> ${p.productionUrl}`);
  }
  console.log(`===============================================================\n`);
}

async function cmd_reconcile_plan(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const cyclotron = getCliCyclotron();
  const orientation = EosAutonomousReconciliationLoopCore.orientAnomalies(cyclotron);
  const plan = EosAutonomousReconciliationLoopCore.decideConvergencePlan(orientation);

  if (isJson) {
    console.log(JSON.stringify({ orientation, plan }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN RECONCILIATION CONVERGENCE PLAN (SPEC-307)           `);
  console.log(`===============================================================`);
  console.log(`  Plan ID          : ${plan.planId}`);
  console.log(`  Status           : ${orientation.status}`);
  console.log(`  Total Tasks      : ${plan.tasks.length}`);
  console.log(`  Estimated Cycles : ${plan.estimatedCycles}`);
  console.log(`---------------------------------------------------------------`);
  for (const t of plan.tasks) {
    console.log(`  - [${t.taskId}] ${t.type.padEnd(28)} -> ${t.description}`);
  }
  console.log(`===============================================================\n`);
}

async function cmd_reconcile_heal(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const cyclotron = getCliCyclotron();
  const orientation = EosAutonomousReconciliationLoopCore.orientAnomalies(cyclotron);
  const plan = EosAutonomousReconciliationLoopCore.decideConvergencePlan(orientation);
  const execution = EosAutonomousReconciliationLoopCore.actSurgicalRemediation(cyclotron, plan);

  if (isJson) {
    console.log(JSON.stringify(execution, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN SURGICAL RECONCILIATION EXECUTION (SPEC-307)         `);
  console.log(`===============================================================`);
  console.log(`  Plan ID       : ${execution.planId}`);
  console.log(`  Total Tasks   : ${execution.totalTasks}`);
  console.log(`  Executed      : ${execution.executedTasks}`);
  console.log(`  Failed        : ${execution.failedTasks}`);
  console.log(`  Post Harmony  : ${execution.postExecutionHarmony}`);
  console.log(`  Duration      : ${execution.durationUs} µs`);
  console.log(`===============================================================\n`);
}

async function cmd_reconcile_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = EosAutonomousReconciliationLoopCore.auditReconciliationPipeline({
    projectRoot: process.cwd(),
  });

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN RECONCILIATION AUDIT RECEIPT (SPEC-307)              `);
  console.log(`===============================================================`);
  console.log(`  Receipt Type        : ${receipt.receiptType}`);
  console.log(`  Observed Projects   : ${receipt.fleetObservedProjects}`);
  console.log(`  Convergence Achieved: ${receipt.convergenceAchieved ? "YES" : "NO"}`);
  console.log(`  Tasks Executed      : ${receipt.tasksExecutedCount}`);
  console.log(`  Remaining Anomalies : ${receipt.remainingAnomaliesCount}`);
  console.log(`  WASM Accelerated    : ${receipt.wasmKernelAccelerated ? "YES" : "NO"}`);
  console.log(`  SHA-256 Signature   : ${receipt.sha256Signature}`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:reconcile:observe"] = cmd_reconcile_observe;
HANDLERS["toolchain:reconcile:plan"] = cmd_reconcile_plan;
HANDLERS["toolchain:reconcile:heal"] = cmd_reconcile_heal;
HANDLERS["toolchain:reconcile:audit"] = cmd_reconcile_audit;

export async function handleReconcileCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}

export async function dispatchReconciliationLoop(command, commandContext) {
  return handleReconcileCommands(commandContext);
}
