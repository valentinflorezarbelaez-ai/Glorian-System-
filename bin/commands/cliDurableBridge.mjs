/**
 * CLI Cloudflare Durable Objects & Actor Mesh Handlers
 *
 * Implements toolchain:edge:* subcommands for stateful actor lifecycle,
 * transactional edge storage, semantic vector caching, and audit receipts.
 *
 * Conforms to SPEC-297 / CHANGE-159.
 */

import {
  DurableActorLifecycleManager,
  SemanticPromptVectorCache,
  auditDurableObjectsPipeline,
} from "../../src/core/eosCloudflareDurableBridge.ts";

const HANDLERS = {};
const globalActorManager = new DurableActorLifecycleManager();
const globalCache = new SemanticPromptVectorCache();

// Seed initial knowledge in cache
globalCache.put("Optimize Vercel serverless function budget and Hobby limits", {
  recommendation: "Consolidate internal handlers under /api/kernel.js dispatch to stay at 12/12 functions.",
});

async function cmd_edge_actor(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const actorId =
    args.find((a) => !a.startsWith("-") && a !== commandContext.command && !a.startsWith("toolchain:")) ||
    "actor-main-01";

  const snap = globalActorManager.spawnActor(actorId);

  if (isJson) {
    console.log(JSON.stringify(snap, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🌐  EOS CLOUDFLARE DURABLE OBJECT ACTOR (SPEC-297)            ");
  console.log("===============================================================");
  console.log(`  Actor Identifier    : ${snap.actorId}`);
  console.log(`  Lifecycle Status    : ${snap.status}`);
  console.log(`  Storage Keys Count  : ${snap.storageKeyCount}`);
  console.log(`  Active WebSockets   : ${snap.activeWebSockets}`);
  console.log(`  Processed Messages  : ${snap.messageCount}`);
  console.log(`  Last Active TS      : ${new Date(snap.lastActiveTimestamp).toISOString()}`);
  console.log("===============================================================\n");
}

async function cmd_edge_state(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const actorId =
    args.find((a) => !a.startsWith("-") && a !== commandContext.command && !a.startsWith("toolchain:")) ||
    "actor-main-01";
  const keyArg = args.find((a) => a.startsWith("--key="))?.split("=")[1] || "default_key";
  const valArg = args.find((a) => a.startsWith("--val="))?.split("=")[1];

  globalActorManager.spawnActor(actorId);
  const storage = globalActorManager.getActorStorage(actorId);

  if (valArg !== undefined) {
    storage.put(keyArg, valArg);
  }
  const currentVal = storage.get(keyArg);

  const report = {
    actorId,
    key: keyArg,
    value: currentVal,
    totalKeys: storage.size(),
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 💾  EOS EDGE ACTOR TRANSACTIONAL STORAGE (SPEC-297)           ");
  console.log("===============================================================");
  console.log(`  Actor Target        : ${report.actorId}`);
  console.log(`  Storage Key         : ${report.key}`);
  console.log(`  Storage Value       : ${JSON.stringify(report.value)}`);
  console.log(`  Total Active Keys   : ${report.totalKeys}`);
  console.log("===============================================================\n");
}

async function cmd_edge_cache(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const query =
    args.find((a) => !a.startsWith("-") && a !== commandContext.command && !a.startsWith("toolchain:")) ||
    "Optimize Vercel serverless function budget and Hobby limits";

  const match = globalCache.match(query, 0.85);

  if (isJson) {
    console.log(JSON.stringify(match, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" ⚡  EOS SEMANTIC PROMPT VECTOR CACHE (SPEC-297)               ");
  console.log("===============================================================");
  console.log(`  Query Evaluated     : "${query}"`);
  console.log(`  Cache Result        : ${match.hit ? "HIT (Bypassed LLM Call)" : "MISS"}`);
  console.log(`  Cosine Similarity   : ${(match.similarity * 100).toFixed(2)}%`);
  console.log(`  Retrieval Latency   : ${match.latencyMs} ms (< 5 ms SLA)`);
  if (match.hit) {
    console.log(`  Matched Prompt      : "${match.cachedPrompt}"`);
    console.log(`  Cached Payload      : ${JSON.stringify(match.response)}`);
  }
  console.log("===============================================================\n");
}

async function cmd_edge_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = await auditDurableObjectsPipeline(process.cwd());

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔒  EOS DURABLE OBJECTS & ACTOR MESH RECEIPT (SPEC-297)       ");
  console.log("===============================================================");
  console.log(`  Specification       : ${receipt.specId}`);
  console.log(`  Actors Spawned      : ${receipt.actorsSpawned}`);
  console.log(`  Transactions Audited: ${receipt.transactionsAudited}`);
  console.log(`  Cache Hit Rate      : ${(receipt.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`  Edge Bridge Verified: ${receipt.edgeBridgeVerified}`);
  console.log(`  SHA-256 Receipt Seal: ${receipt.sha256Signature}`);
  console.log("===============================================================\n");
}

HANDLERS["toolchain:edge:actor"] = cmd_edge_actor;
HANDLERS["toolchain:edge:state"] = cmd_edge_state;
HANDLERS["toolchain:edge:cache"] = cmd_edge_cache;
HANDLERS["toolchain:edge:audit"] = cmd_edge_audit;

export async function handleEdgeCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}
