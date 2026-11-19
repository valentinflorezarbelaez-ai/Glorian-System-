/**
 * @file cliWorkStealingScheduler.mjs
 * @description CLI handler for SPEC-356 / CHANGE-218: Self-Rebalancing Work-Stealing Scheduler.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosChaseLevDeque, EosWorkStealingScheduler } from "../../src/core/eosWorkStealingScheduler.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("WORK_STEALING_SCHEDULER_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_sched_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosWorkStealingScheduler.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Self-Rebalancing Work-Stealing Scheduler (SPEC-356) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Worker Pool Size        : ${receipt.workerCount} workers`);
    console.log(`Tasks Tested            : ${receipt.tasksTested.toLocaleString()}`);
    console.log(`Total Steals Executed   : ${receipt.metrics.totalSteals.toLocaleString()}`);
    console.log(`Steal Success Rate      : ${(receipt.metrics.stealSuccessRate * 100).toFixed(1)}%`);
    console.log(
      `Throughput              : ${Math.round(receipt.metrics.throughputTasksPerSec).toLocaleString()} tasks/sec`,
    );
    console.log(`Average Latency         : ${receipt.metrics.avgExecutionLatencyNs.toFixed(1)} ns/task`);
    console.log(`Load Imbalance Factor   : ${receipt.metrics.loadImbalanceFactor.toFixed(3)}`);
    console.log(`TLC Model Verification  : ${receipt.tlcModelVerified ? "PASS" : "FAIL"}`);
    console.log(`Verdict                 : ${receipt.verdict}`);
    console.log(`Receipt Saved           : ${receiptPath}`);
  }
}

async function cmd_sched_bench(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const taskCount = 50000;
  const metrics = EosWorkStealingScheduler.runBenchmark(taskCount, 4);

  if (isJson) {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    console.log("=== Work-Stealing Multi-Worker Benchmark ===");
    console.log(`Workers Active    : ${metrics.workerCount}`);
    console.log(`Tasks Processed   : ${metrics.totalTasksProcessed.toLocaleString()}`);
    console.log(`Throughput        : ${Math.round(metrics.throughputTasksPerSec).toLocaleString()} tasks/sec`);
    console.log(`Avg Latency       : ${metrics.avgExecutionLatencyNs.toFixed(1)} ns/task`);
    console.log(`Total Steals      : ${metrics.totalSteals.toLocaleString()}`);
    console.log(`Steal Rate        : ${(metrics.stealSuccessRate * 100).toFixed(1)}%`);
    console.log(`Imbalance Factor  : ${metrics.loadImbalanceFactor.toFixed(3)}`);
  }
}

async function cmd_sched_spawn(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const scheduler = new EosWorkStealingScheduler(4);
  const task = scheduler.spawn("SAMPLE_TASK", (val) => `PROCESSED_${val}`, "HIGH");

  if (isJson) {
    console.log(JSON.stringify({ taskId: task.id, priority: task.priority, state: task.state }, null, 2));
  } else {
    console.log("=== Micro-Task Spawned ===");
    console.log(`Task ID   : ${task.id}`);
    console.log(`Priority  : ${task.priority}`);
    console.log(`State     : ${task.state}`);
  }
}

async function cmd_sched_steal(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const deque = new EosChaseLevDeque(16);
  deque.pushBottom({
    id: "task-001",
    priority: "NORMAL",
    payload: 100,
    execute: (x) => x * 2,
    createdAtNs: process.hrtime.bigint(),
    epoch: 0,
    state: "PENDING",
    stolenCount: 0,
  });

  const stealResult = deque.stealTop(0);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          status: stealResult.status,
          taskId: stealResult.task?.id,
          victimId: stealResult.victimId,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("=== Work-Stealing Top Steal Demonstration ===");
    console.log(`Steal Status : ${stealResult.status}`);
    console.log(`Stolen Task  : ${stealResult.task?.id}`);
    console.log(`Victim Worker: ${stealResult.victimId}`);
  }
}

HANDLERS["toolchain:sched:audit"] = cmd_sched_audit;
HANDLERS["toolchain:sched:bench"] = cmd_sched_bench;
HANDLERS["toolchain:sched:spawn"] = cmd_sched_spawn;
HANDLERS["toolchain:sched:steal"] = cmd_sched_steal;

export async function handleWorkStealingSchedulerCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:sched command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
