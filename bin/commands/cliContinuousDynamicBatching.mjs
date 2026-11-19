/**
 * @file cliContinuousDynamicBatching.mjs
 * @description CLI handler for SPEC-319 / CHANGE-181: Continuous Dynamic
 * Sequence Batching & Iteration-Level Request Scheduler.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosContinuousDynamicBatchingCore } from "../../src/core/eosContinuousDynamicBatching.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = resolveEvidencePath("CONTINUOUS_DYNAMIC_BATCHING_RECEIPT.json", ROOT);

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_continuous_schedule(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const batchSize = Number(parseFlagValue(args, "--batch=", "4"));
  const count = Number(parseFlagValue(args, "--requests=", "4"));

  const engine = new EosContinuousDynamicBatchingCore({ maxBatchSize: batchSize });
  for (let i = 0; i < count; i++) {
    engine.enqueue({
      requestId: `cli-req-${i + 1}`,
      promptTokens: [100, 101],
      maxTokens: 4 + (i % 3),
      priority: i === 0 ? "HIGH" : "NORMAL",
    });
  }

  const admitted = engine.admitPending();

  const result = {
    command: "toolchain:continuous:schedule",
    maxBatchSize: batchSize,
    totalEnqueued: count,
    admittedCount: admitted.length,
    admittedRequestIds: admitted,
    pendingCount: engine.getPendingQueue().length,
    activeSlots: engine.getActiveSlots().map((s) => ({
      slotIndex: s.slotIndex,
      requestId: s.request ? s.request.requestId : null,
      status: s.request ? s.request.status : "FREE",
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Continuous Dynamic Batching Scheduler ===");
    console.log(`Max Batch Size   : ${batchSize}`);
    console.log(`Admitted Requests: ${admitted.length} (${admitted.join(", ")})`);
    console.log(`Pending in Queue : ${result.pendingCount}`);
  }
}

async function cmd_continuous_step(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const batchSize = Number(parseFlagValue(args, "--batch=", "4"));

  const engine = new EosContinuousDynamicBatchingCore({ maxBatchSize: batchSize });
  engine.enqueue({ requestId: "seq-fast", promptTokens: [10], maxTokens: 1 }); // finishes on step 1
  engine.enqueue({ requestId: "seq-long", promptTokens: [20], maxTokens: 4 });
  engine.enqueue({ requestId: "seq-waiting", promptTokens: [30], maxTokens: 3 });

  const stepResult = engine.step();

  const result = {
    command: "toolchain:continuous:step",
    step: stepResult.step,
    activeSlotCount: stepResult.activeSlotCount,
    admittedRequestIds: stepResult.admittedRequestIds,
    finishedRequestIds: stepResult.finishedRequestIds,
    tokensEmittedThisStep: stepResult.tokensEmittedThisStep,
    elapsedMs: Number(stepResult.elapsedMs.toFixed(3)),
    slotsAfterStep: engine.getActiveSlots().map((s) => ({
      slotIndex: s.slotIndex,
      requestId: s.request ? s.request.requestId : null,
      tokensGenerated: s.request ? s.request.generatedTokens.length : 0,
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Iteration-Level Forward Step ===");
    console.log(`Step Number   : ${stepResult.step}`);
    console.log(`Active Slots  : ${stepResult.activeSlotCount}`);
    console.log(`Finished Reqs : ${stepResult.finishedRequestIds.join(", ") || "none"}`);
    console.log(`Tokens Emitted: ${stepResult.tokensEmittedThisStep}`);
  }
}

async function cmd_continuous_preempt(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const slotIdx = Number(parseFlagValue(args, "--slot=", "0"));

  const engine = new EosContinuousDynamicBatchingCore({ maxBatchSize: 2 });
  engine.enqueue({ requestId: "preempt-target", promptTokens: [100], maxTokens: 10, priority: "LOW" });
  engine.admitPending();

  const preemptedId = engine.preemptSlot(slotIdx);

  const result = {
    command: "toolchain:continuous:preempt",
    targetSlot: slotIdx,
    preemptedRequestId: preemptedId,
    pendingQueueLength: engine.getPendingQueue().length,
    activeSlotsAfterPreempt: engine.getActiveSlots().map((s) => ({
      slotIndex: s.slotIndex,
      status: s.request ? s.request.status : "FREE",
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Continuous Dynamic Preemption ===");
    console.log(`Preempted Request: ${preemptedId}`);
    console.log(`Queue Length     : ${result.pendingQueueLength}`);
  }
}

async function cmd_continuous_metrics(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const engine = new EosContinuousDynamicBatchingCore({ maxBatchSize: 4 });
  for (let i = 0; i < 5; i++) {
    engine.enqueue({ requestId: `metric-req-${i}`, promptTokens: [10], maxTokens: 2 + i });
  }

  // Run 4 steps
  for (let s = 0; s < 4; s++) {
    engine.step();
  }

  const metrics = engine.getMetrics();
  const result = {
    command: "toolchain:continuous:metrics",
    ...metrics,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Continuous Batching Telemetry ===");
    console.log(`Requests Served : ${metrics.totalRequestsServed}`);
    console.log(`Tokens Emitted  : ${metrics.totalTokensGenerated}`);
    console.log(`Slot Utilization: ${(metrics.averageSlotUtilization * 100).toFixed(1)}%`);
    console.log(`Preemptions     : ${metrics.totalPreemptions}`);
  }
}

async function cmd_continuous_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const count = Number(parseFlagValue(args, "--count=", "6"));

  const engine = new EosContinuousDynamicBatchingCore({ maxBatchSize: 4 });
  const receipt = engine.audit(count);

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Continuous Batching Invariant Audit ===");
    console.log(`Status         : ${receipt.auditStatus}`);
    console.log(`Tested Reqs    : ${receipt.totalRequestsTested}`);
    console.log(`Completed Reqs : ${receipt.completedRequestsCount}`);
    console.log(`Slot Leaks     : ${receipt.noSlotLeaksVerified ? "NONE" : "LEAK_DETECTED"}`);
    console.log(`SHA-256 Seal   : ${receipt.sha256Receipt}`);
    console.log(`Receipt Saved  : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:continuous:schedule"] = cmd_continuous_schedule;
HANDLERS["toolchain:continuous:step"] = cmd_continuous_step;
HANDLERS["toolchain:continuous:preempt"] = cmd_continuous_preempt;
HANDLERS["toolchain:continuous:metrics"] = cmd_continuous_metrics;
HANDLERS["toolchain:continuous:audit"] = cmd_continuous_audit;

export async function handleContinuousBatchingCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:continuous command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
