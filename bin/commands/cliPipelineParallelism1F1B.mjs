/**
 * @file cliPipelineParallelism1F1B.mjs
 * @description CLI handler for SPEC-322 / CHANGE-184: Pipeline Parallelism
 * Engine (1F1B Interleaved Activation Schedule & Micro-Batching).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosPipelineParallelism1F1BCore } from "../../src/core/eosPipelineParallelism1F1B.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/PIPELINE_PARALLELISM_1F1B_RECEIPT.json");

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_pipeline_stages(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numStages = Number(parseFlagValue(args, "--stages=", "4"));

  const engine = new EosPipelineParallelism1F1BCore();
  const stages = engine.buildTopology(numStages);

  const result = {
    command: "toolchain:pipeline:stages",
    numStages,
    stages: stages.map((s) => ({
      stageId: s.stageId,
      predecessorStageId: s.predecessorStageId,
      successorStageId: s.successorStageId,
      weightsShape: [s.weights.length, s.weights[0].length],
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Pipeline Parallelism Stage Topology ===");
    console.log(`Stages (P)     : ${numStages}`);
    for (const s of result.stages) {
      console.log(
        `  Stage ${s.stageId}: Pred=${s.predecessorStageId ?? "NONE"}, Succ=${s.successorStageId ?? "NONE"}, Weights=[${s.weightsShape.join("x")}]`,
      );
    }
  }
}

async function cmd_pipeline_warmup(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numStages = Number(parseFlagValue(args, "--stages=", "4"));

  const engine = new EosPipelineParallelism1F1BCore();
  const stages = engine.buildTopology(numStages);
  const warmupSchedule = stages.map((s) => ({
    stageId: s.stageId,
    warmupForwardSteps: engine.getWarmupCount(s.stageId, numStages),
    maxStashedDuringWarmup: engine.getWarmupCount(s.stageId, numStages),
  }));

  const result = {
    command: "toolchain:pipeline:warmup",
    numStages,
    warmupSchedule,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Pipeline Parallelism Warmup Schedule ===");
    console.log(`Stages (P)     : ${numStages}`);
    for (const w of warmupSchedule) {
      console.log(`  Stage ${w.stageId}: Warmup Forward Steps = ${w.warmupForwardSteps} (W_p = P - p - 1)`);
    }
  }
}

async function cmd_pipeline_1f1b(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numStages = Number(parseFlagValue(args, "--stages=", "4"));
  const numMicroBatches = Number(parseFlagValue(args, "--microbatches=", "8"));

  const engine = new EosPipelineParallelism1F1BCore();
  const { actions, result: simResult } = engine.run1F1BSchedule({
    numStages,
    numMicroBatches,
  });

  const steadyStateActions = actions.filter((a) => a.phase === "STEADY_STATE_1F1B" && a.action !== "IDLE");

  const result = {
    command: "toolchain:pipeline:1f1b",
    numStages,
    numMicroBatches,
    totalSteadyStateActions: steadyStateActions.length,
    peakActivationsPerStage: simResult.peakActivationsPerStage,
    activationMemoryBounded: simResult.activationMemoryBounded,
    sample1F1BActions: steadyStateActions.slice(0, 10),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== 1F1B Steady-State Interleaved Schedule ===");
    console.log(`Stages (P)     : ${numStages}`);
    console.log(`Micro-Batches  : ${numMicroBatches}`);
    console.log(`1F1B Actions   : ${steadyStateActions.length}`);
    console.log(`Bounded Mem <=P: ${simResult.activationMemoryBounded}`);
    console.log("Sample 1F1B Actions:");
    for (const a of result.sample1F1BActions) {
      console.log(
        `  Step ${a.step} | Stage ${a.stageId} | ${a.action} MB#${a.microBatchId} (Stashed: ${a.stashedActivationsCount})`,
      );
    }
  }
}

async function cmd_pipeline_schedule(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numStages = Number(parseFlagValue(args, "--stages=", "4"));
  const numMicroBatches = Number(parseFlagValue(args, "--microbatches=", "8"));

  const engine = new EosPipelineParallelism1F1BCore();
  const { result: simResult } = engine.run1F1BSchedule({
    numStages,
    numMicroBatches,
  });

  const result = {
    command: "toolchain:pipeline:schedule",
    numStages,
    numMicroBatches,
    totalScheduleSteps: simResult.totalScheduleSteps,
    bubbleSteps: simResult.bubbleSteps,
    bubbleFraction: simResult.bubbleFraction,
    theoreticalBubbleFraction: simResult.theoreticalBubbleFraction,
    peakActivationsPerStage: simResult.peakActivationsPerStage,
    activationMemoryBounded: simResult.activationMemoryBounded,
    zeroLeakageVerified: simResult.zeroLeakageVerified,
    elapsedMs: simResult.elapsedMs,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== 1F1B Pipeline Schedule Execution ===");
    console.log(`Stages (P)     : ${numStages}`);
    console.log(`Micro-Batches  : ${numMicroBatches}`);
    console.log(`Total Steps    : ${simResult.totalScheduleSteps}`);
    console.log(`Bubble Steps   : ${simResult.bubbleSteps}`);
    console.log(`Bubble Fraction: ${(simResult.bubbleFraction * 100).toFixed(2)}%`);
    console.log(`Theoretical BF : ${(simResult.theoreticalBubbleFraction * 100).toFixed(2)}%`);
    console.log(`Zero Leakage   : ${simResult.zeroLeakageVerified}`);
    console.log(`Elapsed Time   : ${simResult.elapsedMs.toFixed(2)} ms`);
  }
}

async function cmd_pipeline_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numStages = Number(parseFlagValue(args, "--stages=", "4"));
  const numMicroBatches = Number(parseFlagValue(args, "--microbatches=", "8"));

  const engine = new EosPipelineParallelism1F1BCore();
  const receipt = engine.audit(numStages, numMicroBatches);

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== 1F1B Pipeline Parallelism Invariant Audit ===");
    console.log(`Status         : ${receipt.auditStatus}`);
    console.log(`Stages (P)     : ${receipt.numStages}`);
    console.log(`Micro-Batches  : ${receipt.numMicroBatches}`);
    console.log(`Max Stashed Act: ${receipt.maxStashedActivations} (<= ${receipt.numStages})`);
    console.log(`Peak Memory Bnd: ${receipt.peakMemoryBoundedCertified}`);
    console.log(`Zero Leakage OK: ${receipt.zeroLeakageCertified}`);
    console.log(`Bubble Optimal : ${receipt.bubbleFractionOptimal}`);
    console.log(`SHA-256 Seal   : ${receipt.sha256Receipt}`);
    console.log(`Receipt Saved  : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:pipeline:stages"] = cmd_pipeline_stages;
HANDLERS["toolchain:pipeline:warmup"] = cmd_pipeline_warmup;
HANDLERS["toolchain:pipeline:1f1b"] = cmd_pipeline_1f1b;
HANDLERS["toolchain:pipeline:schedule"] = cmd_pipeline_schedule;
HANDLERS["toolchain:pipeline:audit"] = cmd_pipeline_audit;

export async function handlePipelineCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:pipeline command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
