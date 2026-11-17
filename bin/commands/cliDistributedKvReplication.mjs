/**
 * @file cliDistributedKvReplication.mjs
 * @description CLI handler for SPEC-329 / CHANGE-191: Distributed Key-Value Cache
 * Replication, Prefix Caching & Speculative KV Prefetching Engine.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosDistributedKvReplicationCore } from "../../src/core/eosDistributedKvReplication.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/DISTRIBUTED_KV_CACHE_REPLICATION_RECEIPT.json");

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_kvcache_prefix(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const isPinned = args.includes("--pinned");
  const tokenLength = Number(parseFlagValue(args, "--tokens=", "32"));
  const queryMatch = args.includes("--match");

  const engine = new EosDistributedKvReplicationCore(16, 256, 32);
  const promptTokens = Array.from({ length: tokenLength }, (_, i) => 1000 + i);

  // Insert base prefix
  const insertResult = engine.insertPrefix(promptTokens, isPinned);

  let matchResult = null;
  if (queryMatch) {
    // Query with matching prefix + 4 new tokens
    const queryTokens = [...promptTokens.slice(0, 16), 9991, 9992, 9993, 9994];
    matchResult = engine.matchPrefix(queryTokens);
  }

  const payload = {
    command: "toolchain:kvcache:prefix",
    tokenLength,
    isPinned,
    allocatedBlocksCount: insertResult.allocatedCount,
    assignedBlockIds: insertResult.blockIds,
    radixTreeDepth: insertResult.treeDepth,
    matchResult: matchResult
      ? {
          matchedTokens: matchResult.matchedTokenCount,
          totalTokens: matchResult.totalTokenCount,
          hitRatioPercent: Number(matchResult.hitRatioPercent.toFixed(2)),
          reusedBlockIds: matchResult.reusedBlockIds,
          ttftEstimatedSpeedupPercent: Number(matchResult.ttftEstimatedSpeedupPercent.toFixed(2)),
        }
      : null,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Hierarchical Prefix Radix Tree Cache ===");
    console.log(`Tokens Inserted : ${tokenLength}`);
    console.log(`Is Pinned       : ${isPinned}`);
    console.log(`Blocks Allocated: ${insertResult.allocatedCount}`);
    console.log(`Tree Depth      : ${insertResult.treeDepth}`);
    if (matchResult) {
      console.log(`Matched Tokens  : ${matchResult.matchedTokenCount}/${matchResult.totalTokenCount}`);
      console.log(`Hit Ratio       : ${payload.matchResult.hitRatioPercent}%`);
      console.log(`TTFT Speedup    : ${payload.matchResult.ttftEstimatedSpeedupPercent}%`);
    }
  }
}

async function cmd_kvcache_replicate(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const source = parseFlagValue(args, "--source=", "worker-node-1");
  const target = parseFlagValue(args, "--target=", "worker-node-2");

  const engine = new EosDistributedKvReplicationCore(16, 128, 32);
  const tokens = Array.from({ length: 16 }, (_, i) => 2000 + i);
  const ins = engine.insertPrefix(tokens, false);
  const blockId = ins.blockIds[0];

  const repResult = engine.replicateBlock(blockId, source, target);

  const payload = {
    command: "toolchain:kvcache:replicate",
    blockId: repResult.blockId,
    sourceWorkerId: repResult.sourceWorkerId,
    targetWorkerId: repResult.targetWorkerId,
    sha256Hash: repResult.sha256Hash,
    verifiedMatch: repResult.verifiedMatch,
    replicatedAtIso: repResult.replicatedAtIso,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== P2P Distributed KV Block Replication ===");
    console.log(`Block ID        : ${repResult.blockId}`);
    console.log(`Source Worker   : ${repResult.sourceWorkerId}`);
    console.log(`Target Worker   : ${repResult.targetWorkerId}`);
    console.log(`Verified Match  : ${repResult.verifiedMatch}`);
    console.log(`SHA-256 Hash    : ${repResult.sha256Hash}`);
  }
}

async function cmd_kvcache_prefetch(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const beams = Number(parseFlagValue(args, "--beams=", "3"));
  const limit = Number(parseFlagValue(args, "--limit=", "8"));

  const engine = new EosDistributedKvReplicationCore(16, 256, 32);
  const baseTokens = Array.from({ length: 32 }, (_, i) => 3000 + i);
  engine.insertPrefix(baseTokens, true);

  const candidateBeams = [];
  for (let b = 0; b < beams; b++) {
    candidateBeams.push([...baseTokens, 4000 + b * 10, 4001 + b * 10]);
  }

  const prefetchResult = engine.speculativePrefetch(candidateBeams, limit);

  const payload = {
    command: "toolchain:kvcache:prefetch",
    candidateBeamsCount: prefetchResult.candidateBeamsCount,
    prefetchedBlockIds: prefetchResult.prefetchedBlockIds,
    transferredBytes: prefetchResult.transferredBytes,
    cacheHitProbability: Number(prefetchResult.cacheHitProbability.toFixed(2)),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Speculative KV Draft Prefetching ===");
    console.log(`Candidate Beams : ${prefetchResult.candidateBeamsCount}`);
    console.log(`Prefetched Blocks: ${prefetchResult.prefetchedBlockIds.length}`);
    console.log(`Bytes Warmed    : ${prefetchResult.transferredBytes} bytes`);
    console.log(`Hit Probability : ${payload.cacheHitProbability}`);
  }
}

async function cmd_kvcache_evict(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const evictCount = Number(parseFlagValue(args, "--count=", "4"));

  const engine = new EosDistributedKvReplicationCore(16, 16, 32);

  // Pin system prompt
  const pinRes = engine.insertPrefix([100, 101, 102, 103], true);
  // Add unpinned conversational blocks
  for (let i = 0; i < 10; i++) {
    engine.insertPrefix([200 + i * 10, 201 + i * 10], false);
  }

  const evictionResult = engine.evictBlocks(evictCount);

  const payload = {
    command: "toolchain:kvcache:evict",
    requestedBlocks: evictionResult.requestedBlocks,
    evictedBlockIds: evictionResult.evictedBlockIds,
    freedMemoryBytes: evictionResult.freedMemoryBytes,
    pinnedSkippedCount: evictionResult.pinnedSkippedCount,
    remainingCapacityBlocks: evictionResult.remainingCapacityBlocks,
    pinnedBlockIdProtected: !evictionResult.evictedBlockIds.includes(pinRes.blockIds[0]),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== LRU/LFU Weighted Cache Eviction ===");
    console.log(`Requested Blocks: ${evictionResult.requestedBlocks}`);
    console.log(`Evicted Blocks  : ${evictionResult.evictedBlockIds.length}`);
    console.log(`Freed Memory    : ${evictionResult.freedMemoryBytes} bytes`);
    console.log(`Pinned Skipped  : ${evictionResult.pinnedSkippedCount}`);
    console.log(`Remaining Cap   : ${evictionResult.remainingCapacityBlocks}`);
  }
}

async function cmd_kvcache_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const workers = Number(parseFlagValue(args, "--workers=", "3"));
  const sessions = Number(parseFlagValue(args, "--sessions=", "4"));
  const capacity = Number(parseFlagValue(args, "--capacity=", "64"));

  const engine = new EosDistributedKvReplicationCore();
  const receipt = engine.audit(workers, sessions, capacity);

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Distributed KV Cache Replication Audit ===");
    console.log(`Status        : ${receipt.status}`);
    console.log(`Workers       : ${receipt.numWorkers}`);
    console.log(`Blocks Active : ${receipt.totalPhysicalBlocks}`);
    console.log(`Pinned Blocks : ${receipt.pinnedBlocksCount}`);
    console.log(`Prefix Match  : ${receipt.prefixMatchVerified}`);
    console.log(`P2P Replicat  : ${receipt.peerReplicationVerified}`);
    console.log(`Spec Prefetch : ${receipt.speculativePrefetchVerified}`);
    console.log(`Pinned Immune : ${receipt.evictionPinnedImmunityVerified}`);
    console.log(`Attention Id  : ${receipt.exactAttentionIdentityVerified}`);
    console.log(`SHA-256 Seal  : ${receipt.sha256Signature}`);
    console.log(`Receipt Saved : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:kvcache:prefix"] = cmd_kvcache_prefix;
HANDLERS["toolchain:kvcache:replicate"] = cmd_kvcache_replicate;
HANDLERS["toolchain:kvcache:prefetch"] = cmd_kvcache_prefetch;
HANDLERS["toolchain:kvcache:evict"] = cmd_kvcache_evict;
HANDLERS["toolchain:kvcache:audit"] = cmd_kvcache_audit;

export async function handleDistributedKvReplicationCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:kvcache command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
