/**
 * EOS SYSTEM — DATABASE MIGRATION GOVERNOR CLI (Layer 0)
 * Governed by SPEC-277, CHANGE-139
 */

import path from "node:path";
import { EosDatabaseMigrationGovernor } from "../../src/core/eosDatabaseMigrationGovernor.ts";

export const HANDLERS = {};

async function cmd_toolchain_db_lint(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const allowDrop = args.includes("--allow-drop");
  const fileArg = args.slice(1).find((a) => !a.startsWith("-"));

  if (!fileArg) {
    console.error("Error: Please provide a SQL migration file path to lint.");
    process.exitCode = 1;
    return;
  }

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  const report = EosDatabaseMigrationGovernor.lintMigration(filePath, { allowDrop });

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    if (!report.clean) process.exitCode = 1;
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN DATABASE MIGRATION LINT GOVERNOR (SPEC-277)`);
  console.log(`===============================================================`);
  console.log(`  Target Script        : ${report.targetName}`);
  console.log(`  Verdict              : ${report.clean ? "✔ PASS (ZERO LOCK HAZARDS)" : "✖ HAZARD_DETECTED"}`);
  console.log(`  Hazardous Locks      : ${report.totalHazardousLocks}`);
  console.log(`  Statements Analyzed  : ${report.statementsCount}`);
  console.log(`  Latency              : ${report.latencyMs} ms`);
  console.log(`  Receipt SHA-256      : sha256:${report.sha256Receipt}`);

  if (report.violations.length > 0) {
    console.log(`---------------------------------------------------------------`);
    console.log(`  Violations Detected:`);
    for (const v of report.violations) {
      console.log(`  - [${v.severity}] ${v.rule}: ${v.message}`);
    }
  }
  console.log(`===============================================================\n`);
  if (!report.clean) process.exitCode = 1;
}

async function cmd_toolchain_db_audit(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const allowDrop = args.includes("--allow-drop");
  const dirArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/db/glorian-enterprise-migrations";
  const dirPath = path.isAbsolute(dirArg) ? dirArg : path.join(root, dirArg);

  const report = EosDatabaseMigrationGovernor.auditMigrations(dirPath, { allowDrop });

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    if (!report.clean) process.exitCode = 1;
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN DATABASE MIGRATION AUDIT GOVERNOR (SPEC-277)`);
  console.log(`===============================================================`);
  console.log(`  Migration Directory  : ${report.directoryPath}`);
  console.log(`  Verdict              : ${report.clean ? "✔ PASS" : "✖ HAZARD_DETECTED"}`);
  console.log(`  Files Audited        : ${report.filesAudited}`);
  console.log(`  Total Violations     : ${report.totalViolations}`);
  console.log(`  Expand/Contract Safe : ${report.expandContractPhaseConformity ? "YES" : "NO"}`);
  console.log(`  Latency              : ${report.latencyMs} ms`);
  console.log(`  Receipt SHA-256      : sha256:${report.sha256Receipt}`);
  console.log(`===============================================================\n`);
  if (!report.clean) process.exitCode = 1;
}

async function cmd_toolchain_db_plan(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const dirArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/db/glorian-enterprise-migrations";
  const dirPath = path.isAbsolute(dirArg) ? dirArg : path.join(root, dirArg);

  const report = EosDatabaseMigrationGovernor.planMigrations(dirPath);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    if (!report.clean) process.exitCode = 1;
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN DATABASE MIGRATION PLAN & ROLLBACK (SPEC-277)`);
  console.log(`===============================================================`);
  console.log(`  Verdict              : ${report.clean ? "✔ PASS" : "✖ HAZARD_DETECTED"}`);
  console.log(`  Total Steps          : ${report.totalSteps}`);
  console.log(`  Execution Order      : ${report.executionOrder.join(" -> ")}`);
  console.log(`  Rollbacks Generated  : ${Object.keys(report.downMigrations).length}`);
  console.log(
    `  Reversibility Proof  : ${report.allReversible ? "✔ 100% LIFO INVERSE PROVEN" : "✖ IRREVERSIBLE_STEP"}`,
  );
  console.log(`  Receipt SHA-256      : sha256:${report.sha256Receipt}`);
  console.log(`===============================================================\n`);
  if (!report.clean) process.exitCode = 1;
}

HANDLERS["toolchain:db:lint"] = cmd_toolchain_db_lint;
HANDLERS["toolchain:db:audit"] = cmd_toolchain_db_audit;
HANDLERS["toolchain:db:plan"] = cmd_toolchain_db_plan;

export async function handleDatabaseCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
