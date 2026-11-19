/**
 * EOS SYSTEM — TERRAFORM IAC GOVERNOR CLI (Layer 0)
 * Governed by SPEC-276, CHANGE-138
 */

import path from "node:path";
import { EosTerraformIaCGovernor } from "../../src/core/eosTerraformIaCGovernor.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

export const HANDLERS = {};

async function cmd_toolchain_tf_validate(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const moduleArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/iac/glorian-enterprise-infra";
  const modulePath = path.isAbsolute(moduleArg) ? moduleArg : path.join(root, moduleArg);

  const report = EosTerraformIaCGovernor.validateIaC(modulePath);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    if (!report.clean) process.exitCode = 1;
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN TERRAFORM IAC VALIDATION GOVERNOR (SPEC-276)`);
  console.log(`===============================================================`);
  console.log(`  Module Target        : ${report.modulePath}`);
  console.log(`  Format & Syntax      : ${report.clean ? "✔ PASS (CANONICAL)" : "✖ VALIDATION_FAILED"}`);
  console.log(`  Latency              : ${report.latencyMs} ms`);
  if (report.rawOutput) console.log(`  Output Diagnostics   :\n${report.rawOutput}`);
  if (report.error) console.log(`  Error                : ${report.error}`);
  console.log(`  Receipt SHA-256      : sha256:${report.sha256Receipt}`);
  console.log(`===============================================================\n`);
  if (!report.clean) process.exitCode = 1;
}

async function cmd_toolchain_tf_audit(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const allowDestroy = args.includes("--allow-destroy");
  const planArg = args.slice(1).find((a) => !a.startsWith("-"));
  const receiptPath = resolveEvidencePath("TERRAFORM_RECEIPT.json", root);

  if (!planArg) {
    console.error("Error: Please provide a plan JSON file path to audit.");
    process.exitCode = 1;
    return;
  }

  const planPath = path.isAbsolute(planArg) ? planArg : path.join(root, planArg);
  const report = EosTerraformIaCGovernor.auditPlan(planPath, {
    allowDestroy,
    receiptPath,
  });

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    if (!report.allowed) process.exitCode = 1;
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN TERRAFORM PLAN OPA SECURITY GOVERNOR (SPEC-276)`);
  console.log(`===============================================================`);
  console.log(`  Audit Status         : ${report.allowed ? "✔ PASS" : "✖ " + report.status}`);
  console.log(`  Execution Engine     : ${report.executionEngine}`);
  console.log(`  Evaluated Resources  : ${report.evaluatedResources}`);
  console.log(`  Total Violations     : ${report.totalViolations}`);
  console.log(`  Latency              : ${report.latencyMs} ms`);
  for (const v of report.violations) {
    console.log(`    [✖ VIOLATION] [${v.rule.padEnd(24)}] ${v.resource} — ${v.message}`);
  }
  if (report.error) console.log(`  Error Diagnostics    : ${report.error}`);
  console.log(`  Receipt SHA-256      : sha256:${report.sha256Receipt}`);
  console.log(`===============================================================\n`);
  if (!report.allowed) process.exitCode = 1;
}

async function cmd_toolchain_tf_plan(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const moduleArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/iac/glorian-enterprise-infra";
  const modulePath = path.isAbsolute(moduleArg) ? moduleArg : path.join(root, moduleArg);

  // Validate formatting first
  const valReport = EosTerraformIaCGovernor.validateIaC(modulePath);

  if (isJson) {
    console.log(
      JSON.stringify({ modulePath, valid: valReport.clean, sha256Receipt: valReport.sha256Receipt }, null, 2),
    );
    if (!valReport.clean) process.exitCode = 1;
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN TERRAFORM PLAN & PRE-FLIGHT GOVERNOR (SPEC-276)`);
  console.log(`===============================================================`);
  console.log(`  Module Target        : ${valReport.modulePath}`);
  console.log(`  Pre-Flight Syntax    : ${valReport.clean ? "✔ PASS" : "✖ FAILED"}`);
  console.log(`  Receipt SHA-256      : sha256:${valReport.sha256Receipt}`);
  console.log(`===============================================================\n`);
  if (!valReport.clean) process.exitCode = 1;
}

HANDLERS["toolchain:tf:validate"] = cmd_toolchain_tf_validate;
HANDLERS["toolchain:tf:audit"] = cmd_toolchain_tf_audit;
HANDLERS["toolchain:tf:plan"] = cmd_toolchain_tf_plan;

export async function handleTerraformCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
