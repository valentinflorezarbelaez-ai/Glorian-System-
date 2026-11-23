/**
 * @file cliGoalDrivenFactory.mjs
 * @description CLI handler for SPEC-378 / CHANGE-240: Goal-Driven Development Loop,
 * Immutable Verifier Guard, Parallel Worktree Software Factory & 3-Gate Pre-PR Engine.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosGoalDrivenFactoryCore } from "../../src/core/eosGoalDrivenFactoryCore.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function parseFlag(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  const idx = arg.indexOf("=");
  return idx >= 0 ? arg.slice(idx + 1) : defaultValue;
}

function buildGoalFromArgs(args) {
  return {
    goalId: parseFlag(args, "--goal-id=", "CLI-OUTPUT-GOAL"),
    kind: parseFlag(args, "--kind=", "OUTPUT") === "OUTCOME" ? "OUTCOME" : "OUTPUT",
    description: parseFlag(args, "--description=", "List endpoint responds under 200 ms with 10000 rows"),
    metricName: parseFlag(args, "--metric=", "p95LatencyMs"),
    operator: parseFlag(args, "--op=", "<"),
    threshold: Number(parseFlag(args, "--threshold=", "200")),
    unit: parseFlag(args, "--unit=", "ms"),
    verifyCommand: parseFlag(args, "--verify-cmd=", "node scripts/bench-list.mjs"),
    maxAttempts: Number(parseFlag(args, "--max-attempts=", "4")),
    maxDurationMs: Number(parseFlag(args, "--max-duration-ms=", "120000")),
    maxCostUsd: Number(parseFlag(args, "--max-cost=", "2.5")),
    ...(args.some((a) => a.startsWith("--review-days="))
      ? {
          outcomeFollowUp: {
            metricsSource: parseFlag(args, "--metrics-source=", "mixpanel"),
            reviewAfterDays: Number(parseFlag(args, "--review-days=", "15")),
            decisionOwner: "product",
          },
        }
      : {}),
  };
}

function emitResult(isJson, command, payload, humanLines) {
  if (isJson) {
    console.log(JSON.stringify({ command, ...payload }, null, 2));
    return;
  }
  for (const line of humanLines) console.log(line);
}

async function cmdGoal(commandContext) {
  const args = commandContext.args || [];
  const report = EosGoalDrivenFactoryCore.validateGoalContract(buildGoalFromArgs(args));
  emitResult(args.includes("--json"), "toolchain:gdd:goal", report, [
    "=== Output Goal Contract Validator (SPEC-378) ===",
    `Goal ID     : ${report.goalId} (${report.kind})`,
    `Verdict     : ${report.verdict} | Same-Day Closable: ${report.sameDayClosable}`,
    `Violations  : ${report.violations.length}`,
  ]);
}

async function cmdVerifier(commandContext) {
  const args = commandContext.args || [];
  const changedRaw = parseFlag(args, "--files=", "src/core/billing.ts");
  const protectedRaw = parseFlag(args, "--protected=", "");
  const report = EosGoalDrivenFactoryCore.verifyVerifierIntegrity({
    changedFiles: changedRaw.split(",").filter(Boolean),
    protectedPaths: protectedRaw ? protectedRaw.split(",").filter(Boolean) : undefined,
  });
  emitResult(args.includes("--json"), "toolchain:gdd:verifier", report, [
    "=== Immutable Verifier Integrity Guard (SPEC-378) ===",
    `Verdict     : ${report.verdict} (Intact: ${report.verifierIntact})`,
    `Checked     : ${report.checkedFiles} | Violations: ${report.violations.length}`,
  ]);
}

async function cmdLoop(commandContext) {
  const args = commandContext.args || [];
  const goal = buildGoalFromArgs(args);
  const report = EosGoalDrivenFactoryCore.runBoundedGoalLoop({
    goal,
    attempts: [
      {
        attemptNumber: 1,
        durationMs: 1200,
        costUsd: 0.4,
        observedValue: 260,
        commandExitCode: 1,
        summary: "Add index",
      },
      {
        attemptNumber: 2,
        durationMs: 1100,
        costUsd: 0.4,
        observedValue: 145,
        commandExitCode: 0,
        summary: "Target met",
      },
    ],
  });
  emitResult(args.includes("--json"), "toolchain:gdd:loop", report, [
    "=== Bounded Output-Driven Loop Evaluator (SPEC-378) ===",
    `Status      : ${report.status} (${report.stopReason})`,
    `Delivered   : ${report.deliveryClassification} | Outcome Verified: ${report.outcomeVerified}`,
    `Attempts    : ${report.attemptsExecuted} | Cost: $${report.totalCostUsd}`,
  ]);
}

async function cmdFactory(commandContext) {
  const args = commandContext.args || [];
  const concurrency = Number(parseFlag(args, "--concurrency=", "2"));
  const totalBudget = Number(parseFlag(args, "--total-budget=", "10"));
  const baseGoal = buildGoalFromArgs(args);
  const report = EosGoalDrivenFactoryCore.planSoftwareFactoryRun({
    batchId: parseFlag(args, "--batch=", "CLI-FACTORY-BATCH"),
    maxConcurrency: concurrency,
    totalMaxCostUsd: totalBudget,
    tasks: [
      {
        taskId: "TASK-1",
        worktreePath: ".worktrees/t1",
        branchName: "gdd/t1",
        editSurfacePaths: ["src/a.ts"],
        goal: baseGoal,
      },
      {
        taskId: "TASK-2",
        worktreePath: ".worktrees/t2",
        branchName: "gdd/t2",
        editSurfacePaths: ["src/b.ts"],
        goal: baseGoal,
      },
      {
        taskId: "TASK-3",
        worktreePath: ".worktrees/t3",
        branchName: "gdd/t3",
        editSurfacePaths: ["src/c.ts"],
        goal: baseGoal,
      },
    ],
  });
  emitResult(args.includes("--json"), "toolchain:gdd:factory", report, [
    "=== Parallel Worktree Software Factory Planner (SPEC-378) ===",
    `Verdict     : ${report.verdict} | Waves: ${report.waves.length}`,
    `Conflicts   : ${report.conflicts.length} | Reserved: $${report.totalReservedCostUsd}`,
  ]);
}

async function cmdGates(commandContext) {
  const args = commandContext.args || [];
  const unitPass = parseFlag(args, "--unit=", "true") === "true";
  const e2ePass = parseFlag(args, "--e2e=", "true") === "true";
  const criticalCount = Number(parseFlag(args, "--critical=", "0"));
  const warningsCount = Number(parseFlag(args, "--warnings=", "2"));
  const findings = [
    ...Array.from({ length: Math.max(0, criticalCount) }, (_, i) => ({
      id: `CRIT-${i + 1}`,
      severity: "critical",
      summary: "Critical defect detected",
    })),
    ...Array.from({ length: Math.max(0, warningsCount) }, (_, i) => ({
      id: `WARN-${i + 1}`,
      severity: "warning",
      summary: "Non-blocking style suggestion",
    })),
  ];
  const report = EosGoalDrivenFactoryCore.evaluatePrePrGates({
    prId: parseFlag(args, "--pr-id=", "CLI-PR-CHECK"),
    testsExecuted: true,
    unitTestsPassed: unitPass,
    e2eTestsPassed: e2ePass,
    implementerAgentId: "agent-impl",
    reviewerAgentId: parseFlag(args, "--reviewer=", "agent-reviewer"),
    findings,
    verifyCommandExecuted: true,
    verifierIntact: parseFlag(args, "--verifier-intact=", "true") === "true",
    incompleteTasks: Number(parseFlag(args, "--incomplete=", "0")),
  });
  emitResult(args.includes("--json"), "toolchain:gdd:gates", report, [
    "=== Three-Gate Pre-PR Readiness Evaluator (SPEC-378) ===",
    `Verdict     : ${report.verdict} | Ready: ${report.readyForPr}`,
    `NonBlocking : ${report.nonBlockingFindings.length} | Blocking Reasons: ${report.blockingReasons.length}`,
  ]);
}

async function cmdAudit(commandContext) {
  const args = commandContext.args || [];
  const receipt = EosGoalDrivenFactoryCore.audit(ROOT);
  emitResult(args.includes("--json"), "toolchain:gdd:audit", receipt, [
    "=== Formal Audit: Goal-Driven Development & Factory Engine (SPEC-378) ===",
    `Status      : ${receipt.status}`,
    `ReceiptHash : ${receipt.receiptHash.slice(0, 16)}...`,
  ]);
}

const HANDLERS = {
  "toolchain:gdd:goal": cmdGoal,
  "toolchain:gdd:verifier": cmdVerifier,
  "toolchain:gdd:loop": cmdLoop,
  "toolchain:gdd:factory": cmdFactory,
  "toolchain:gdd:gates": cmdGates,
  "toolchain:gdd:audit": cmdAudit,
};

export async function handleGoalDrivenFactoryCommand(commandContext) {
  const fn = HANDLERS[commandContext.command];
  if (!fn) return false;
  await fn(commandContext);
  return true;
}
