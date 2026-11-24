#!/usr/bin/env node

/**
 * EOS System — Empirical 3-Repository External Fleet Lifecycle Pilot (SPEC-124)
 *
 * Clones external fleet repositories exclusively inside `os.tmpdir()` (zero writes
 * to sibling checkouts per Law IV), executes the full approval-gated EOS lifecycle:
 * inspect -> plan -> guard -> start -> commit -> validate -> review ->
 * tamper-hash rejection -> apply -> revert -> close, and emits an empirical receipt.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { scanArchitecture } from "../src/core/eosArchitectureGuard.ts";
import { EosContainerSandbox } from "../src/core/eosContainerSandbox.ts";
import { EosEngineeringWorkflow } from "../src/core/eosEngineeringWorkflow.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

export const DEFAULT_PILOT_RECEIPT_PATH = path.join(ROOT, "docs", "evidence", "EXTERNAL_FLEET_PILOT_RECEIPT.json");

function roundMs(value) {
  return Number(value.toFixed(2));
}

function runGit(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

export function getDefaultFleetTargets(workspaceParent = path.resolve(ROOT, "..")) {
  const localTfo = path.join(workspaceParent, "TRADING-FAMILY-OFFICE-");
  const hasLocalTfo = fs.existsSync(path.join(localTfo, ".git"));
  return [
    {
      id: "trading-family-office",
      name: "Trading Family Office",
      cloneSource: hasLocalTfo ? localTfo : "https://github.com/valentinflorezarbelaez-ai/TRADING-FAMILY-OFFICE-.git",
      sourceType: hasLocalTfo ? "local_no_local_clone" : "github_https_clone",
    },
    {
      id: "aberamentho",
      name: "Aberamentho Pleroma Music",
      cloneSource: "https://github.com/valentinflorezarbelaez-ai/Aberamentho-s-Pleroma-music.git",
      sourceType: "github_https_clone",
    },
    {
      id: "atp-strength",
      name: "ATP Strength",
      cloneSource: "https://github.com/valentinflorezarbelaez-ai/ATP-STRENGTH.git",
      sourceType: "github_https_clone",
    },
  ];
}

function createWorkflowRunner(doctorReport) {
  if (doctorReport.ready) {
    return { validationBackend: "DOCKER_ENGINE", flow: new EosEngineeringWorkflow() };
  }
  const flow = new EosEngineeringWorkflow(() => ({
    async run(options) {
      const timeoutMs = options.timeoutMs ?? 30_000;
      const res = spawnSync(options.command, [...(options.commandArgs || [])], {
        cwd: options.worktreePath,
        encoding: "utf8",
        timeout: timeoutMs,
        windowsHide: true,
      });
      const exitCode = typeof res.status === "number" ? res.status : null;
      return {
        success: res.status === 0,
        status: res.status === 0 ? "COMPLETED" : "COMMAND_FAILED",
        exitCode,
        timeoutMs,
        appliedChanges: false,
        changedFiles: [],
        conflicts: [],
        excludedPaths: [],
        receiptPath: null,
        ...(res.status === 0 ? {} : { error: (res.stderr || res.stdout || "Validation command failed").trim() }),
      };
    },
  }));
  return { validationBackend: "HOST_SUBPROCESS_DOCKER_OFFLINE", flow };
}

function assertTamperRejected(flow, cloneDir, workflowId) {
  try {
    flow.apply(cloneDir, workflowId, "0".repeat(64));
    throw new Error("Expected tampered diff hash to be rejected by flow.apply().");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Approval hash does not match/i.test(message)) {
      throw error;
    }
    return true;
  }
}

async function exerciseRepositoryLifecycle(target, pilotRoot, flow) {
  const cloneDir = path.join(pilotRoot, target.id);
  const timingsMs = {};
  const totalStart = performance.now();

  const cloneStart = performance.now();
  const cloneArgs = ["clone", "--depth", "1"];
  if (!/^https?:\/\//i.test(target.cloneSource)) {
    cloneArgs.push("--no-local");
  }
  cloneArgs.push(target.cloneSource, cloneDir);
  runGit(pilotRoot, cloneArgs);
  if (!runGit(cloneDir, ["branch", "--show-current"])) {
    runGit(cloneDir, ["checkout", "-B", "main"]);
  }
  runGit(cloneDir, ["config", "user.name", "Glorian Pilot"]);
  runGit(cloneDir, ["config", "user.email", "pilot@glorian.local"]);
  timingsMs.clone = roundMs(performance.now() - cloneStart);

  const tInspect = performance.now();
  const inspected = flow.inspect(cloneDir);
  timingsMs.inspect = roundMs(performance.now() - tInspect);

  const tPlan = performance.now();
  const planned = flow.plan(cloneDir, "Add deterministic EOS pilot smoke probe");
  timingsMs.plan = roundMs(performance.now() - tPlan);

  const tGuard = performance.now();
  const guardReport = scanArchitecture(cloneDir, cloneDir);
  timingsMs.guard = roundMs(performance.now() - tGuard);

  const tStart = performance.now();
  const started = flow.start(cloneDir, "Add deterministic EOS pilot smoke probe");
  timingsMs.start = roundMs(performance.now() - tStart);

  const probePath = path.join(started.worktreePath, ".eos-pilot-probe.json");
  fs.writeFileSync(
    probePath,
    JSON.stringify({ pilot: "EOS_EXTERNAL_FLEET_PILOT", repoId: target.id, baseCommit: started.baseCommit }, null, 2) +
      "\n",
    "utf8",
  );
  runGit(started.worktreePath, ["add", ".eos-pilot-probe.json"]);
  runGit(started.worktreePath, ["commit", "-m", "chore(pilot): isolated EOS workflow probe"]);

  const tValidate = performance.now();
  const validation = await flow.validate(cloneDir, started.workflowId, process.execPath, [
    "-e",
    "const fs=require('node:fs'); JSON.parse(fs.readFileSync('.eos-pilot-probe.json','utf8'));",
  ]);
  timingsMs.validate = roundMs(performance.now() - tValidate);
  if (!validation.success || validation.status !== "COMPLETED") {
    throw new Error(`Pilot validation failed for ${target.id}: ${validation.error || validation.status}`);
  }

  const tReview = performance.now();
  const reviewed = flow.review(cloneDir, started.workflowId);
  timingsMs.review = roundMs(performance.now() - tReview);

  const tamperRejected = assertTamperRejected(flow, cloneDir, started.workflowId);

  const tApply = performance.now();
  const appliedHead = flow.apply(cloneDir, started.workflowId, reviewed.diffSha256);
  timingsMs.apply = roundMs(performance.now() - tApply);
  if (appliedHead !== reviewed.headCommit) {
    throw new Error(`Applied HEAD mismatch for ${target.id}: ${appliedHead} !== ${reviewed.headCommit}`);
  }

  const tRevert = performance.now();
  runGit(cloneDir, ["reset", "--hard", started.baseCommit]);
  const restoredHead = runGit(cloneDir, ["rev-parse", "HEAD"]);
  const dirtyAfterReset = runGit(cloneDir, ["status", "--porcelain"]);
  const reversibilityVerified = restoredHead === started.baseCommit && dirtyAfterReset === "";
  timingsMs.revert = roundMs(performance.now() - tRevert);

  const tClose = performance.now();
  const closeMessage = flow.close(cloneDir, started.workflowId);
  const worktreeRemoved = !fs.existsSync(started.worktreePath);
  timingsMs.close = roundMs(performance.now() - tClose);
  timingsMs.total = roundMs(performance.now() - totalStart);

  const passed = tamperRejected && reversibilityVerified && worktreeRemoved;
  return {
    id: target.id,
    name: target.name,
    sourceType: target.sourceType || "git_clone",
    detectedStack: planned.detectedStack,
    candidateValidationCommands: planned.candidateValidationCommands,
    baseBranch: started.baseBranch,
    baseCommit: started.baseCommit,
    dirtyOnEntry: inspected.dirtyFiles.length,
    guardMetrics: {
      scannedFilesCount: guardReport.scannedFilesCount,
      architecturePurityScore: guardReport.architecturePurityScore,
      totalViolations: guardReport.totalViolations,
      circularDependencies: guardReport.circularDependencies.length,
    },
    validationStatus: validation.status,
    reviewedDiffSha256: reviewed.diffSha256,
    tamperRejected,
    appliedFastForwardVerified: appliedHead === reviewed.headCommit,
    reversibilityVerified,
    worktreeRemoved,
    closeMessage,
    timingsMs,
    passed,
  };
}

export async function runExternalFleetPilot(options = {}) {
  const targets = options.targets || getDefaultFleetTargets();
  const pilotRoot = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), "glorian-external-pilot-"));
  const doctorReport = options.doctorOverride || new EosContainerSandbox(pilotRoot).doctor();
  const { validationBackend, flow } = createWorkflowRunner(doctorReport);
  const results = [];

  try {
    for (const target of targets) {
      results.push(await exerciseRepositoryLifecycle(target, pilotRoot, flow));
    }
  } finally {
    fs.rmSync(pilotRoot, { recursive: true, force: true, maxRetries: 4, retryDelay: 75 });
  }

  const receipt = {
    schemaVersion: "1.0.0",
    spec: "SPEC-124 / EXTERNAL-FLEET-PILOT",
    executedAtIso: new Date().toISOString(),
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      validationBackend,
      dockerReady: doctorReport.ready,
      dockerDoctorMessage: doctorReport.message,
      isolatedCloneRoot: "os.tmpdir() (removed in finally)",
    },
    summary: {
      repositoriesTested: results.length,
      lifecyclePassCount: results.filter((r) => r.passed).length,
      tamperRejectionsVerified: results.filter((r) => r.tamperRejected).length,
      reversibilityPassCount: results.filter((r) => r.reversibilityVerified).length,
      worktreeCleanupCount: results.filter((r) => r.worktreeRemoved).length,
    },
    repositories: results,
  };

  if (options.writeReceipt) {
    const outPath = options.receiptPath || DEFAULT_PILOT_RECEIPT_PATH;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  }
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const writeReceipt = process.argv.includes("--write-receipt");
  const liveFleet = process.argv.includes("--live-fleet");
  if (!liveFleet && !process.argv.includes("--dry-run")) {
    console.log("Usage: node scripts/run-external-fleet-pilot.mjs --live-fleet [--write-receipt]");
    process.exit(0);
  }
  const receipt = await runExternalFleetPilot({ writeReceipt });
  console.log("=== GLORIAN EXTERNAL FLEET LIFECYCLE PILOT ===");
  console.log(`Backend : ${receipt.environment.validationBackend}`);
  console.log(
    `Summary : ${receipt.summary.lifecyclePassCount}/${receipt.summary.repositoriesTested} PASS | tamper=${receipt.summary.tamperRejectionsVerified} | revert=${receipt.summary.reversibilityPassCount}`,
  );
  for (const repo of receipt.repositories) {
    console.log(
      ` - ${repo.id}: passed=${repo.passed} stack="${repo.detectedStack}" guardFiles=${repo.guardMetrics.scannedFilesCount} totalMs=${repo.timingsMs.total}`,
    );
  }
  if (receipt.summary.lifecyclePassCount !== receipt.summary.repositoriesTested) {
    process.exit(1);
  }
}
