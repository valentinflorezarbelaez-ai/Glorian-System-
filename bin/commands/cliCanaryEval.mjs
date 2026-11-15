/**
 * EOS SYSTEM — BAYESIAN CANARY EVALUATION CLI (Layer 0)
 * Governed by SPEC-280, CHANGE-142
 */

import fs from "node:fs";
import path from "node:path";
import { EosBayesianCanaryEvaluator } from "../../src/core/eosBayesianCanaryEvaluator.ts";

export const HANDLERS = {};

async function cmd_toolchain_canary_eval(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/canary/sample-canary-telemetry.json";

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Canary dataset file not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const report = EosBayesianCanaryEvaluator.evaluateCanary(content);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    if (report.rollbackRequired) process.exitCode = 1;
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN BAYESIAN DYNAMIC CANARY EVALUATOR (SPEC-280)`);
  console.log(`===============================================================`);
  console.log(`  Target Service       : ${report.serviceName}`);
  console.log(`  Verdict              : ${report.verdict === "PASS" ? "✔ PASS" : "✖ " + report.verdict}`);
  console.log(`  Composite Health     : ${report.compositeScore} / 100`);
  console.log(`  Rollback Required    : ${report.rollbackRequired ? "YES (AUTOMATIC)" : "NO"}`);
  console.log(
    `  Baseline P99 / Error : ${report.baselineMetrics.p99Ms} ms / ${(report.baselineMetrics.errorRate * 100).toFixed(2)}%`,
  );
  console.log(
    `  Canary P99 / Error   : ${report.canaryMetrics.p99Ms} ms / ${(report.canaryMetrics.errorRate * 100).toFixed(2)}%`,
  );
  console.log(`  Relative P99 Shift   : ${(report.deltaP99 * 100).toFixed(2)}%`);
  console.log(`  Error Rate Delta     : ${(report.deltaErrorRate * 100).toFixed(2)}%`);
  console.log(`  Receipt SHA-256      : sha256:${report.sha256Receipt}`);

  if (report.failureReasons.length > 0) {
    console.log(`---------------------------------------------------------------`);
    console.log(`  Failure / Regression Reasons:`);
    for (const r of report.failureReasons) {
      console.log(`  - [REGRESSION] ${r}`);
    }
  }

  if (report.rollbackManifest) {
    console.log(`---------------------------------------------------------------`);
    console.log(`  Rollback Action Manifest:`);
    console.log(`  - Action             : ${report.rollbackManifest.action}`);
    console.log(`  - Revert Target      : ${report.rollbackManifest.targetRevision}`);
    console.log(`  - Failed Revision    : ${report.rollbackManifest.failedRevision}`);
  }
  console.log(`===============================================================\n`);

  if (report.rollbackRequired) process.exitCode = 1;
}

async function cmd_toolchain_canary_score(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const nonFlags = args.slice(1).filter((a) => !a.startsWith("-"));

  let dataset;
  if (nonFlags.length >= 2) {
    const bPath = path.isAbsolute(nonFlags[0]) ? nonFlags[0] : path.join(root, nonFlags[0]);
    const cPath = path.isAbsolute(nonFlags[1]) ? nonFlags[1] : path.join(root, nonFlags[1]);
    const baseline = JSON.parse(fs.readFileSync(bPath, "utf8"));
    const canary = JSON.parse(fs.readFileSync(cPath, "utf8"));
    dataset = {
      serviceName: "canary-scored-service",
      baseline,
      canary,
    };
  } else {
    const defaultPath = path.join(root, "templates/canary/sample-canary-telemetry.json");
    dataset = JSON.parse(fs.readFileSync(defaultPath, "utf8"));
  }

  const report = EosBayesianCanaryEvaluator.evaluateCanary(dataset);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          serviceName: report.serviceName,
          compositeScore: report.compositeScore,
          verdict: report.verdict,
          deltaP99: report.deltaP99,
          deltaErrorRate: report.deltaErrorRate,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CANARY HEALTH SCORE (SPEC-280)`);
  console.log(`===============================================================`);
  console.log(`  Composite Score      : ${report.compositeScore} / 100`);
  console.log(`  Verdict              : ${report.verdict}`);
  console.log(`  P99 Shift            : ${(report.deltaP99 * 100).toFixed(2)}%`);
  console.log(`  Error Shift          : ${(report.deltaErrorRate * 100).toFixed(2)}%`);
  console.log(`===============================================================\n`);
}

async function cmd_toolchain_canary_rollback(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/canary/sample-canary-telemetry.json";

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  const content = fs.readFileSync(filePath, "utf8");
  const report = EosBayesianCanaryEvaluator.evaluateCanary(content);

  const manifest = report.rollbackManifest || {
    action: "NOOP_ROLLBACK_NOT_REQUIRED",
    serviceName: report.serviceName,
    verdict: report.verdict,
    message: "Canary health is acceptable; no rollback required.",
  };

  if (isJson) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN AUTOMATED ROLLBACK MANIFEST (SPEC-280)`);
  console.log(`===============================================================`);
  console.log(`  Action               : ${manifest.action}`);
  console.log(`  Target Service       : ${manifest.serviceName}`);
  if (manifest.targetRevision) {
    console.log(`  Revert Target        : ${manifest.targetRevision}`);
    console.log(`  Failed Revision      : ${manifest.failedRevision}`);
    console.log(`  Reasons              : ${manifest.reasons?.join(", ")}`);
  } else {
    console.log(`  Status               : Safe (No rollback triggered)`);
  }
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:canary:eval"] = cmd_toolchain_canary_eval;
HANDLERS["toolchain:canary:score"] = cmd_toolchain_canary_score;
HANDLERS["toolchain:canary:rollback"] = cmd_toolchain_canary_rollback;

export async function handleCanaryCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
