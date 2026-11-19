/**
 * @file cliAutonomousSentinelDaemon.mjs
 * @description CLI handler for SPEC-362 / CHANGE-224: Autonomous Continuous Sentinel Daemon 24/7.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosAutonomousSentinelDaemon } from "../../src/core/eosAutonomousSentinelDaemon.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("AUTONOMOUS_SENTINEL_DAEMON_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_sentinel_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const daemon = new EosAutonomousSentinelDaemon({
    heartbeatIntervalMs: 50,
    projectRoot: ROOT,
  });
  const receipt = await daemon.audit();
  const receiptPath = getReceiptPath(ROOT);

  try {
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  } catch (err) {
    console.error(`Warning: Could not persist evidence receipt: ${err.message}`);
  }

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Autonomous Continuous Sentinel Daemon 24/7 (SPEC-362) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Daemon State            : ${receipt.daemonState}`);
    console.log(`Heartbeat Ticks Executed: ${receipt.heartbeatTicksExecuted}`);
    console.log(`Total Probes Run        : ${receipt.totalProbesRun}`);
    console.log(`Anomalies Remediated    : ${receipt.anomaliesRemediatedCount}`);
    console.log(`Checks Summary          :`);
    console.log(`  - Heartbeat Non-Block : ${receipt.checks.heartbeatLoopNonBlocking}`);
    console.log(`  - Multi-Dim Probes    : ${receipt.checks.multiDimensionalProbes}`);
    console.log(`  - Spec AST Drift      : ${receipt.checks.specAstDriftDetection}`);
    console.log(`  - Raft Swarm Lease    : ${receipt.checks.raftSwarmRemediationLease}`);
    console.log(`  - CEGIS Verified PR   : ${receipt.checks.cegisVerifiedPrSynthesis}`);
    console.log(`  - Zero Dependency     : ${receipt.checks.zeroDependencyPurity}`);
    console.log(`Integrity Hash          : ${receipt.integrityHash}`);
    console.log(`Evidence Receipt        : ${receiptPath}`);
  }
}

async function cmd_sentinel_status(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json") || true;
  const daemon = new EosAutonomousSentinelDaemon({
    heartbeatIntervalMs: 60000,
    projectRoot: ROOT,
  });
  const report = daemon.getHealthReport();

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== Autonomous Sentinel Daemon Status ===");
    console.log(`Report ID     : ${report.reportId}`);
    console.log(`Overall Status: ${report.overallStatus}`);
    console.log(`Daemon State  : ${report.daemonState}`);
    console.log(`Active Leases : ${report.activeLeases.length}`);
    console.log(`Staged PRs    : ${report.stagedPrs.length}`);
    console.log(`Integrity     : ${report.integrityHash}`);
  }
}

async function cmd_sentinel_probe(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const daemon = new EosAutonomousSentinelDaemon({ projectRoot: ROOT });
  const probes = await daemon.runHealthProbes();

  if (isJson) {
    console.log(JSON.stringify(probes, null, 2));
  } else {
    console.log("=== Autonomous Sentinel Multi-Dimensional Health Probes ===");
    for (const p of probes) {
      console.log(`[${p.status}] ${p.pillar.padEnd(16)}: ${p.name} (${p.latencyMs}ms)`);
    }
  }
}

async function cmd_sentinel_start(commandContext) {
  const args = commandContext.args || [];
  const intervalArg = args.find((a) => a.startsWith("--interval="));
  const interval = intervalArg ? parseInt(intervalArg.split("=")[1], 10) : 60000;

  const daemon = new EosAutonomousSentinelDaemon({
    heartbeatIntervalMs: interval,
    projectRoot: ROOT,
  });
  await daemon.start();

  console.log("=== Autonomous Continuous Sentinel Daemon 24/7 ===");
  console.log(`Status       : ACTIVE (RUNNING)`);
  console.log(`Heartbeat    : ${interval} ms`);
  console.log(`Level        : LEVEL 4/5 FULL AUTONOMY`);
  console.log(`Press Ctrl+C to stop the sentinel daemon.`);

  if (args.includes("--once") || args.includes("--headless")) {
    await daemon.stop();
    console.log("Sentinel daemon stopped cleanly.");
  }
}

HANDLERS["toolchain:sentinel:audit"] = cmd_sentinel_audit;
HANDLERS["toolchain:sentinel:status"] = cmd_sentinel_status;
HANDLERS["toolchain:sentinel:probe"] = cmd_sentinel_probe;
HANDLERS["toolchain:sentinel:start"] = cmd_sentinel_start;

export async function handleAutonomousSentinelDaemonCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:sentinel command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
