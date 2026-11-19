/**
 * EOS SYSTEM — HELM PACKAGING & RELEASE GOVERNOR CLI (Layer 0)
 * Governed by SPEC-275, CHANGE-137
 */

import path from "node:path";
import { EosHelmReleaseGovernor } from "../../src/core/eosHelmReleaseGovernor.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

export const HANDLERS = {};

async function cmd_toolchain_helm_lint(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const chartArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/k8s/glorian-enterprise-workload";
  const chartPath = path.isAbsolute(chartArg) ? chartArg : path.join(root, chartArg);

  const report = EosHelmReleaseGovernor.lintChart(chartPath);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    if (!report.clean) process.exitCode = 1;
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN HELM CHART LINT GOVERNOR (SPEC-275)`);
  console.log(`===============================================================`);
  console.log(`  Chart Target         : ${report.chartPath}`);
  console.log(`  Lint Verdict         : ${report.clean ? "✔ PASS (STRICT)" : "✖ LINT_FAILED"}`);
  console.log(`  Latency              : ${report.latencyMs} ms`);
  if (report.rawOutput) console.log(`  Output Diagnostics   :\n${report.rawOutput}`);
  if (report.error) console.log(`  Error                : ${report.error}`);
  console.log(`  Receipt SHA-256      : sha256:${report.sha256Receipt}`);
  console.log(`===============================================================\n`);
  if (!report.clean) process.exitCode = 1;
}

async function cmd_toolchain_helm_template(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const chartArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/k8s/glorian-enterprise-workload";
  const chartPath = path.isAbsolute(chartArg) ? chartArg : path.join(root, chartArg);
  const releaseArg = args.find((a) => a.startsWith("--release="));
  const releaseName = releaseArg ? releaseArg.split("=")[1] : "glorian-preview";
  const valArg = args.find((a) => a.startsWith("--values="));
  const valuesFile = valArg
    ? path.isAbsolute(valArg.split("=")[1])
      ? valArg.split("=")[1]
      : path.join(root, valArg.split("=")[1])
    : undefined;

  const report = EosHelmReleaseGovernor.templateChart(chartPath, releaseName, { valuesFile });

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== "PASS") process.exitCode = 1;
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN HELM TEMPLATE MATERIALIZER (SPEC-275)`);
  console.log(`===============================================================`);
  console.log(`  Chart Target         : ${report.chartPath}`);
  console.log(`  Release Name         : ${report.releaseName}`);
  console.log(`  Materialization      : ${report.status === "PASS" ? "✔ PASS" : "✖ TEMPLATE_FAILED"}`);
  console.log(`  Rendered Documents   : ${report.documentCount} (${report.workloadDocumentCount} Workloads)`);
  console.log(`  Latency              : ${report.latencyMs} ms`);
  console.log(`  Receipt SHA-256      : sha256:${report.sha256Receipt}`);
  if (report.error) console.log(`  Diagnostics          : ${report.error}`);
  console.log(`===============================================================\n`);
  if (report.status !== "PASS") process.exitCode = 1;
}

async function cmd_toolchain_helm_deploy(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const isLiveApply = args.includes("--yes");
  const chartArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/k8s/glorian-enterprise-workload";
  const chartPath = path.isAbsolute(chartArg) ? chartArg : path.join(root, chartArg);
  const releaseArg = args.find((a) => a.startsWith("--release="));
  const releaseName = releaseArg ? releaseArg.split("=")[1] : "glorian-enterprise-app";
  const ctxArg = args.find((a) => a.startsWith("--context="));
  const customContext = ctxArg ? ctxArg.split("=")[1] : undefined;
  const valArg = args.find((a) => a.startsWith("--values="));
  const valuesFile = valArg
    ? path.isAbsolute(valArg.split("=")[1])
      ? valArg.split("=")[1]
      : path.join(root, valArg.split("=")[1])
    : undefined;
  const receiptPath = resolveEvidencePath("HELM_RECEIPT.json", root);

  const report = EosHelmReleaseGovernor.deployChart(chartPath, releaseName, {
    customContext,
    valuesFile,
    dryRun: !isLiveApply,
    receiptPath,
  });

  const isSuccess = report.status === "DRY_RUN_PASSED" || report.status === "RELEASE_DEPLOYED";

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    if (!isSuccess) process.exitCode = 1;
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN HELM GATED RELEASE GOVERNOR (SPEC-275)`);
  console.log(`===============================================================`);
  console.log(`  Release Name         : ${report.releaseName}`);
  console.log(`  Target Context       : ${report.targetContext}`);
  console.log(`  Execution Mode       : ${report.dryRun ? "DRY-RUN (Server Admission)" : "LIVE APPLY"}`);
  console.log(`  Release Status       : ${isSuccess ? "✔ " + report.status : "✖ " + report.status}`);
  console.log(`  Stages Evaluated     : ${report.stages.length}`);
  for (const s of report.stages) {
    const icon = s.passed ? "✔ PASS" : "✖ FAIL";
    console.log(`    [${icon}] [${s.stage.padEnd(16)}] ${s.message}`);
  }
  if (report.error) console.log(`  Error Diagnostics    : ${report.error}`);
  console.log(`  Receipt SHA-256      : sha256:${report.sha256Receipt}`);
  console.log(`===============================================================\n`);
  if (!isSuccess) process.exitCode = 1;
}

HANDLERS["toolchain:helm:lint"] = cmd_toolchain_helm_lint;
HANDLERS["toolchain:helm:template"] = cmd_toolchain_helm_template;
HANDLERS["toolchain:helm:deploy"] = cmd_toolchain_helm_deploy;

export async function handleHelmCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
