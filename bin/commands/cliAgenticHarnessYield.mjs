/**
 * @file cliAgenticHarnessYield.mjs
 * @description CLI handler for SPEC-339 / CHANGE-201: Agentic Harness Engineering,
 * First-Pass PR Yield & Token Rework Telemetry Engine.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosAgenticHarnessYieldCore } from "../../src/core/eosAgenticHarnessYield.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = resolveEvidencePath("AGENTIC_HARNESS_YIELD_RECEIPT.json", ROOT);

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_harness_specgate(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const earsRequirements = Number(parseFlagValue(args, "--ears=", "4"));
  const bddScenarios = Number(parseFlagValue(args, "--bdd=", "6"));
  const adrCount = Number(parseFlagValue(args, "--adrs=", "3"));
  const ambiguityScore = Number(parseFlagValue(args, "--ambiguity=", "0.05"));
  const hasFormalTlaModel = parseFlagValue(args, "--tla=", "true") !== "false";

  const core = new EosAgenticHarnessYieldCore();
  const report = core.evaluateSpecReadiness({
    taskId: "SPEC-339-CLI",
    earsRequirements,
    bddScenarios,
    adrCount,
    hasFormalTlaModel,
    ambiguityScore,
  });

  const payload = {
    command: "toolchain:harness:specgate",
    ...report,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Agentic Harness: Spec-Driven Readiness Gate ===");
    console.log(`Task ID         : ${report.taskId}`);
    console.log(`Readiness Score : ${report.readinessScore}/100`);
    console.log(`Ambiguity Score : ${report.ambiguityScore}`);
    console.log(`Approved        : ${report.approved}`);
    if (report.missingCriteria.length > 0) {
      console.log(`Missing Criteria: ${report.missingCriteria.join(", ")}`);
    }
  }
}

async function cmd_harness_loop(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const maxRetries = Number(parseFlagValue(args, "--max-retries=", "3"));
  const unitRetries = Number(parseFlagValue(args, "--unit-failures=", "1"));

  const core = new EosAgenticHarnessYieldCore();
  const res = core.runHarnessLoop({
    spec: {
      taskId: "SPEC-339-HARNESS-LOOP",
      earsRequirements: 5,
      bddScenarios: 6,
      adrCount: 3,
      hasFormalTlaModel: true,
      ambiguityScore: 0.04,
    },
    maxRetries,
    stageFailures: unitRetries > 0 ? { UNIT_BDD: unitRetries } : {},
  });

  const payload = {
    command: "toolchain:harness:loop",
    taskId: res.taskId,
    stagesExecuted: res.stagesExecuted,
    firstPassSuccess: res.firstPassSuccess,
    totalRetries: res.totalRetries,
    firstPassTokens: res.firstPassTokens,
    reworkTokens: res.reworkTokens,
    totalTokens: res.totalTokens,
    reworkAmplificationFactor: res.reworkAmplificationFactor,
    estimatedCostUsd: res.estimatedCostUsd,
    prReady: res.prReady,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Agentic Harness: Multi-Stage Validation Loop ===");
    console.log(`Stages Executed : ${res.stagesExecuted.join(" -> ")}`);
    console.log(`First-Pass PR   : ${res.firstPassSuccess} (retries=${res.totalRetries})`);
    console.log(`Tokens (FP/RW)  : ${res.firstPassTokens} / ${res.reworkTokens} (total=${res.totalTokens})`);
    console.log(`Rework Factor   : ${res.reworkAmplificationFactor}x`);
    console.log(`PR Ready        : ${res.prReady}`);
  }
}

async function cmd_harness_yield(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const core = new EosAgenticHarnessYieldCore();
  const { sdd } = core.buildCanonicalBenchmarkCohorts();
  const summary = core.evaluateCohortTelemetry(sdd);

  const payload = {
    command: "toolchain:harness:yield",
    ...summary,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Agentic Harness: FinOps First-Pass PR Yield Telemetry ===");
    console.log(`Cohort Size     : ${summary.cohortSize} PRs`);
    console.log(`First-Pass Yield: ${(summary.firstPassYieldRatio * 100).toFixed(2)}%`);
    console.log(`Mean RAF        : ${summary.meanReworkAmplificationFactor}x`);
    console.log(`Rework Tokens   : ${summary.wastedReworkTokens}`);
    console.log(`Cost / Verified : $${summary.meanCostPerMergedPrUsd.toFixed(6)}`);
  }
}

async function cmd_harness_benchmark(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const core = new EosAgenticHarnessYieldCore();
  const report = core.compareSddVsVibeCohorts();

  const payload = {
    command: "toolchain:harness:benchmark",
    ...report,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Agentic Harness: SDD + Harness vs Vibe Coding Cohort Benchmark ===");
    console.log(`SDD FPY         : ${(report.sddCohort.firstPassYieldRatio * 100).toFixed(2)}%`);
    console.log(`Vibe FPY        : ${(report.vibeCohort.firstPassYieldRatio * 100).toFixed(2)}%`);
    console.log(`SDD Mean RAF    : ${report.sddCohort.meanReworkAmplificationFactor}x`);
    console.log(`Vibe Mean RAF   : ${report.vibeCohort.meanReworkAmplificationFactor}x`);
    console.log(`Token Savings   : ${(report.tokenSavingsRatio * 100).toFixed(2)}%`);
    console.log(`Cost Savings    : $${report.costSavingsUsd.toFixed(6)}`);
  }
}

async function cmd_harness_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const core = new EosAgenticHarnessYieldCore();
  const receipt = core.audit();

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Agentic Harness: Audit Receipt ===");
    console.log(`Spec Gate       : ${receipt.specGateEnforced}`);
    console.log(`Harness Loop    : ${receipt.harnessLoopConverged}`);
    console.log(`Retry Ceiling   : ${receipt.retryCeilingEnforced}`);
    console.log(
      `First-Pass Yield: ${receipt.firstPassYieldComputed} (${(receipt.sddFirstPassYieldRatio * 100).toFixed(1)}% vs ${(receipt.vibeFirstPassYieldRatio * 100).toFixed(1)}%)`,
    );
    console.log(
      `SDD > Vibe      : ${receipt.sddOutperformsVibe} (savings=${(receipt.tokenSavingsRatio * 100).toFixed(2)}%)`,
    );
    console.log(
      `Specboot Suite  : enrich=${receipt.storyEnrichmentVerified}, multiagent=${receipt.smartSpecMultiAgentVerified}, rtk=${receipt.rtkTokenCompressionVerified}`,
    );
    console.log(`All Passed      : ${receipt.allPassed}`);
    console.log(`SHA-256 Digest  : ${receipt.sha256Digest}`);
    console.log(`Receipt Saved   : ${RECEIPT_PATH}`);
  }
}

async function cmd_harness_enrich(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const ticketId = parseFlagValue(args, "--ticket=", "SPECBOOT-101");
  const title = parseFlagValue(args, "--title=", "Filter Candidates Endpoint");
  const rawStory = parseFlagValue(
    args,
    "--story=",
    "Expose GET /positions/:id/candidates with pagination and role validation.",
  );
  const layersRaw = parseFlagValue(args, "--layers=", "BACKEND,FRONTEND");
  const affectedLayers = layersRaw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s === "BACKEND" || s === "FRONTEND" || s === "DATABASE");
  const forceReEnrich = args.includes("--force");

  const core = new EosAgenticHarnessYieldCore();
  const report = core.enrichUserStory({ ticketId, title, rawStory, affectedLayers, forceReEnrich });
  const payload = { command: "toolchain:harness:enrich", ...report };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Agentic Harness: LIDR /enrich-us Technical Contract ===");
    console.log(`Ticket / Status : ${report.ticketId} -> ${report.status} (${report.targetJiraStatus})`);
    console.log(`Decisions Closed: ${report.decisionsClosed} | QA Scenarios: ${report.playwrightQaCatalog.length}`);
    console.log(`Verification    : ${report.mandatoryVerificationSteps.length} mandatory steps synthesized`);
  }
}

async function cmd_harness_multiagent(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const taskId = parseFlagValue(args, "--task=", "SPECBOOT-4AGENT-01");
  const architectureDocLines = Number(parseFlagValue(args, "--arch-lines=", "180"));
  const rawRepoExplorationTokens = Number(parseFlagValue(args, "--explore-tokens=", "48000"));

  const core = new EosAgenticHarnessYieldCore();
  const report = core.planSmartSpecCheapExecution({ taskId, architectureDocLines, rawRepoExplorationTokens });
  const payload = { command: "toolchain:harness:multiagent", ...report };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Agentic Harness: 4-Agent Smart Spec, Cheap Execution ===");
    console.log(
      `Arch Memory     : ${report.architectureDocLines}/${report.maxArchitectureDocLines} lines (compliant=${report.architectureMemoryCompliant})`,
    );
    console.log(
      `Tokens Savings  : ${(report.tokenSavingsRatio * 100).toFixed(2)}% (${report.smartSpecTotalTokens} vs ${report.monolithicExplorationTokens})`,
    );
    console.log(
      `Cost Savings    : ${(report.costSavingsRatio * 100).toFixed(2)}% ($${report.smartSpecCostUsd.toFixed(4)} vs $${report.monolithicFrontierCostUsd.toFixed(4)})`,
    );
  }
}

async function cmd_harness_rtk(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const commandType = parseFlagValue(args, "--cmd=", "test");
  const inlineRaw = parseFlagValue(args, "--input=", "");
  const defaultStream = `${Array.from({ length: 40 }, (_, i) => `  ✔ suite check #${i + 1} passed in 1.1ms`).join("\n")}\n✖ assertion failed in src/sample.ts:42`;
  const rawOutput = inlineRaw || defaultStream;

  const core = new EosAgenticHarnessYieldCore();
  const report = core.compressCliOutputRtk({ commandType, rawOutput });
  const payload = { command: "toolchain:harness:rtk", ...report };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Agentic Harness: RTK CLI Token Compression Proxy ===");
    console.log(`Command Type    : ${report.commandType}`);
    console.log(
      `Token Savings   : ${report.savingsPercent}% (${report.rawTokensEstimate} -> ${report.compressedTokensEstimate})`,
    );
    console.log(`Target >= 60%   : ${report.targetBandMet}`);
  }
}

HANDLERS["toolchain:harness:specgate"] = cmd_harness_specgate;
HANDLERS["toolchain:harness:loop"] = cmd_harness_loop;
HANDLERS["toolchain:harness:yield"] = cmd_harness_yield;
HANDLERS["toolchain:harness:benchmark"] = cmd_harness_benchmark;
HANDLERS["toolchain:harness:audit"] = cmd_harness_audit;
HANDLERS["toolchain:harness:enrich"] = cmd_harness_enrich;
HANDLERS["toolchain:harness:multiagent"] = cmd_harness_multiagent;
HANDLERS["toolchain:harness:rtk"] = cmd_harness_rtk;

export async function handleAgenticHarnessYieldCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:harness command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
