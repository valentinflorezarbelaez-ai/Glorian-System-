/**
 * @file cliGlorianLiveStudio.mjs
 * @description CLI handler for SPEC-361 / CHANGE-223: Glorian Live Studio & Interactive Visual HUD.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosGlorianLiveStudio } from "../../src/core/eosGlorianLiveStudio.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("GLORIAN_LIVE_STUDIO_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_studio_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const studio = new EosGlorianLiveStudio({ port: 0 });
  const receipt = await studio.audit();
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
    console.log("=== Glorian Live Studio & Interactive Visual HUD (SPEC-361) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Server State            : ${receipt.serverState}`);
    console.log(`Bound Address           : ${receipt.boundAddress}`);
    console.log(`Active SSE Clients      : ${receipt.activeSseClients}`);
    console.log(`Events Broadcast        : ${receipt.totalEventsBroadcast}`);
    console.log(`Checks Summary          :`);
    console.log(`  - HTTP Health Route   : ${receipt.checks.httpHealthRoute}`);
    console.log(`  - HUD HTML Delivery   : ${receipt.checks.hudHtmlDelivery}`);
    console.log(`  - SSE Monotonicity    : ${receipt.checks.sseStreamMonotonicity}`);
    console.log(`  - Bitemporal Query    : ${receipt.checks.bitemporalProjection}`);
    console.log(`  - Blast Radius Calc   : ${receipt.checks.blastRadiusComputation}`);
    console.log(`  - Zero Dependency     : ${receipt.checks.zeroDependencyPurity}`);
    console.log(`Integrity Hash          : ${receipt.integrityHash}`);
    console.log(`Evidence Receipt        : ${receiptPath}`);
  }
}

async function cmd_studio_snapshot(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json") || true;
  const studio = new EosGlorianLiveStudio({ port: 0 });
  const snapshot = studio.getSnapshot();

  if (isJson) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log("=== Glorian Live Studio Telemetry Snapshot ===");
    console.log(`Snapshot ID      : ${snapshot.snapshotId}`);
    console.log(`Specs Count      : ${snapshot.system.specsCount}`);
    console.log(`Formal Models    : ${snapshot.system.modelsCount}`);
    console.log(`Swarm Leader     : ${snapshot.swarm.leaderId}`);
    console.log(`Scheduler Ops/s  : ${snapshot.scheduler.throughputOpsSec}`);
    console.log(`Integrity Hash   : ${snapshot.integrityHash}`);
  }
}

async function cmd_studio_start(commandContext) {
  const args = commandContext.args || [];
  const portArg = args.find((a) => a.startsWith("--port="));
  const port = portArg ? parseInt(portArg.split("=")[1], 10) : 3333;

  const studio = new EosGlorianLiveStudio({ port });
  const result = await studio.start();

  console.log("=== Glorian Live Studio & Interactive Visual HUD ===");
  console.log(`Status       : ONLINE (RUNNING)`);
  console.log(`Local URL    : ${result.url}`);
  console.log(`SSE Endpoint : ${result.url}/api/stream`);
  console.log(`Health Check : ${result.url}/api/health`);
  console.log(`Press Ctrl+C to stop the studio server.`);

  // If running in headless/test mode, close after 1s
  if (args.includes("--headless") || args.includes("--once")) {
    await new Promise((r) => setTimeout(r, 500));
    await studio.stop();
    console.log("Studio server closed cleanly.");
  }
}

HANDLERS["toolchain:studio:audit"] = cmd_studio_audit;
HANDLERS["toolchain:studio:snapshot"] = cmd_studio_snapshot;
HANDLERS["toolchain:studio:start"] = cmd_studio_start;

export async function handleGlorianLiveStudioCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:studio command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
