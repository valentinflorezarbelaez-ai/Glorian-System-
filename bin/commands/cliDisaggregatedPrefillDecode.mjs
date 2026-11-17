/**
 * @file cliDisaggregatedPrefillDecode.mjs
 * @description CLI handler for SPEC-332 / CHANGE-194: Disaggregated Prefill & Decode
 * Serving Engine (PD Separation, Chunked Prefill & Zero-Copy KV Transfer).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosDisaggregatedPrefillDecodeCore } from "../../src/core/eosDisaggregatedPrefillDecode.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/DISAGGREGATED_PREFILL_DECODE_RECEIPT.json");

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_distpd_schedule(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const requestsCount = Number(parseFlagValue(args, "--requests=", "4"));
  const promptLen = Number(parseFlagValue(args, "--prompt=", "512"));

  const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, 256, 16, 32);
  const submitted = [];

  for (let i = 0; i < requestsCount; i++) {
    const tokens = [];
    for (let t = 0; t < promptLen; t++) tokens.push(100 + t);
    const req = engine.submitRequest(`req_${i}`, tokens, 16);
    submitted.push({
      requestId: req.requestId,
      promptTokens: req.promptTokens.length,
      maxOutputTokens: req.maxOutputTokens,
    });
  }

  const payload = {
    command: "toolchain:distpd:schedule",
    totalSubmitted: submitted.length,
    prefillWorkersAvailable: engine.getPrefillNodes().length,
    decodeWorkersAvailable: engine.getDecodeNodes().length,
    requests: submitted,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Disaggregated Prefill/Decode: Request Admission ===");
    console.log(`Submitted Requests: ${submitted.length}`);
    console.log(`Prefill Pool     : ${payload.prefillWorkersAvailable} workers`);
    console.log(`Decode Pool      : ${payload.decodeWorkersAvailable} workers`);
    console.log(`Prompt Length    : ${promptLen} tokens`);
  }
}

async function cmd_distpd_chunk(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const promptLen = Number(parseFlagValue(args, "--prompt=", "1024"));
  const chunkBudget = Number(parseFlagValue(args, "--chunk=", "256"));

  const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, chunkBudget, 16, 32);
  const tokens = [];
  for (let t = 0; t < promptLen; t++) tokens.push(200 + t);
  engine.submitRequest("demo_req", tokens, 16);

  const chunkHistory = [];
  let migration = null;

  while (chunkHistory.length * chunkBudget < promptLen) {
    const res = engine.stepChunkedPrefill("p_worker_0");
    if (res.chunks.length > 0) {
      chunkHistory.push(res.chunks[0]);
    }
    if (res.migration) {
      migration = res.migration;
      break;
    }
  }

  const payload = {
    command: "toolchain:distpd:chunk",
    requestId: "demo_req",
    totalPromptTokens: promptLen,
    configuredChunkBudget: chunkBudget,
    totalChunksProcessed: chunkHistory.length,
    chunks: chunkHistory.map((c) => ({
      chunkIndex: c.chunkIndex,
      startToken: c.startToken,
      tokenCount: c.tokenCount,
      completed: c.completed,
    })),
    migrationGenerated: Boolean(migration),
    migrationPages: migration?.totalPages ?? 0,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Disaggregated Prefill: Chunked Execution ===");
    console.log(`Total Tokens : ${promptLen}`);
    console.log(`Chunk Budget : ${chunkBudget} tokens/chunk`);
    console.log(`Chunks Run   : ${chunkHistory.length}`);
    console.log(`Migration Gen: ${payload.migrationGenerated ? "READY" : "PENDING"}`);
    console.log(`Pages Created: ${payload.migrationPages}`);
  }
}

async function cmd_distpd_migrate(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const promptLen = Number(parseFlagValue(args, "--prompt=", "512"));

  const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, 256, 16, 32);
  const tokens = [];
  for (let t = 0; t < promptLen; t++) tokens.push(300 + t);
  engine.submitRequest("mig_req", tokens, 16);

  let migration = null;
  while (!migration) {
    const res = engine.stepChunkedPrefill("p_worker_0");
    if (res.migration) migration = res.migration;
  }

  const migResult = engine.migrateKvCache(migration);

  const payload = {
    command: "toolchain:distpd:migrate",
    migrationId: migration.migrationId,
    requestId: migration.requestId,
    sourceNode: migration.sourceNodeId,
    targetNode: migration.targetNodeId,
    totalPages: migration.totalPages,
    migrationChecksumSha256: migration.migrationChecksumSha256,
    migrationSuccess: migResult.success,
    status: migResult.status,
    mountedPages: migResult.mountedPages,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Zero-Copy Paged KV Cache Migration ===");
    console.log(`Migration ID  : ${migration.migrationId}`);
    console.log(`Route         : ${migration.sourceNodeId} -> ${migration.targetNodeId}`);
    console.log(`Pages Migrated: ${migResult.mountedPages}`);
    console.log(`SHA-256 Hash  : ${migration.migrationChecksumSha256}`);
    console.log(`Status        : ${migResult.status}`);
  }
}

async function cmd_distpd_cluster(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const pNodes = Number(parseFlagValue(args, "--prefill-nodes=", "2"));
  const dNodes = Number(parseFlagValue(args, "--decode-nodes=", "4"));

  const engine = new EosDisaggregatedPrefillDecodeCore(pNodes, dNodes, 256, 16, 32);

  // Submit and process a small workload to populate metrics
  for (let i = 0; i < 3; i++) {
    const tokens = [];
    for (let t = 0; t < 256; t++) tokens.push(400 + t);
    engine.submitRequest(`cluster_req_${i}`, tokens, 8);
  }

  while (engine.getClusterMetrics().pendingPrefillQueueDepth > 0) {
    const pWorkers = engine.getPrefillNodes().map((n) => n.nodeId);
    for (const pw of pWorkers) {
      const res = engine.stepChunkedPrefill(pw);
      if (res.migration) {
        engine.migrateKvCache(res.migration);
      }
    }
  }

  const metrics = engine.getClusterMetrics();

  const payload = {
    command: "toolchain:distpd:cluster",
    prefillWorkersCount: metrics.prefillWorkersCount,
    decodeWorkersCount: metrics.decodeWorkersCount,
    pendingPrefillQueueDepth: metrics.pendingPrefillQueueDepth,
    activeDecodeStreamsCount: metrics.activeDecodeStreamsCount,
    totalMigratedKvPages: metrics.totalMigratedKvPages,
    avgTtftMs: metrics.avgTtftMs,
    avgTpotMs: metrics.avgTpotMs,
    headOfLineBlockingDetected: metrics.headOfLineBlockingDetected,
    slaIsolationPreserved: !metrics.headOfLineBlockingDetected,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Disaggregated PD Cluster Topology & Telemetry ===");
    console.log(`Prefill Workers : ${metrics.prefillWorkersCount}`);
    console.log(`Decode Workers  : ${metrics.decodeWorkersCount}`);
    console.log(`Active Decodes  : ${metrics.activeDecodeStreamsCount}`);
    console.log(`Total Pages Mig : ${metrics.totalMigratedKvPages}`);
    console.log(`HoL Blocking    : ${metrics.headOfLineBlockingDetected ? "DETECTED (BREACH)" : "NONE (ZERO HO-L)"}`);
    console.log(`SLA Isolation   : ${payload.slaIsolationPreserved ? "CONSERVED" : "COMPROMISED"}`);
  }
}

async function cmd_distpd_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const reqs = Number(parseFlagValue(args, "--requests=", "10"));
  const prompt = Number(parseFlagValue(args, "--prompt=", "512"));
  const output = Number(parseFlagValue(args, "--output=", "8"));

  const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, 128, 16, 32);
  const receipt = engine.audit(reqs, prompt, output);

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Disaggregated Prefill & Decode Audit Receipt ===");
    console.log(`Status        : ${receipt.status}`);
    console.log(`Requests      : ${receipt.requestsServed}`);
    console.log(`Prefill Nodes : ${receipt.prefillNodes}`);
    console.log(`Decode Nodes  : ${receipt.decodeNodes}`);
    console.log(`Zero HoL Block: ${receipt.noHeadOfLineBlocking}`);
    console.log(`KV Integrity  : ${receipt.kvIntegrityVerified}`);
    console.log(`SLA Isolation : ${receipt.slaIsolationVerified}`);
    console.log(`SHA-256 Seal  : ${receipt.sha256Signature}`);
    console.log(`Receipt Saved : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:distpd:schedule"] = cmd_distpd_schedule;
HANDLERS["toolchain:distpd:chunk"] = cmd_distpd_chunk;
HANDLERS["toolchain:distpd:migrate"] = cmd_distpd_migrate;
HANDLERS["toolchain:distpd:cluster"] = cmd_distpd_cluster;
HANDLERS["toolchain:distpd:audit"] = cmd_distpd_audit;

export async function handleDisaggregatedPrefillDecodeCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:distpd command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
