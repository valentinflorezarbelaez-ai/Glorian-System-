/**
 * @file cliStreamingLlmAttentionSinks.mjs
 * @description CLI handler for SPEC-331 / CHANGE-193: StreamingLLM, Attention Sinks
 * & Infinite-Context Window Memory Compression Engine.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosStreamingLlmCore } from "../../src/core/eosStreamingLlmAttentionSinks.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = resolveEvidencePath("STREAMING_LLM_ATTENTION_SINKS_RECEIPT.json", ROOT);

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_streamllm_sink(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const sinkCap = Number(parseFlagValue(args, "--sink=", "4"));
  const windowCap = Number(parseFlagValue(args, "--window=", "16"));
  const numTokens = Number(parseFlagValue(args, "--tokens=", "20"));

  const engine = new EosStreamingLlmCore(sinkCap, windowCap, 32);
  for (let t = 0; t < numTokens; t++) {
    engine.ingestToken(100 + t);
  }

  const active = engine.getActiveBlocks();
  const sinkBlocks = active.filter((b) => b.isSink);
  const topology = engine.getCacheTopology();

  const payload = {
    command: "toolchain:streamllm:sink",
    sinkCapacity: topology.sinkCapacity,
    sinksRetained: sinkBlocks.length,
    sinkTokenIds: sinkBlocks.map((b) => b.tokenId),
    sinkGlobalPositions: sinkBlocks.map((b) => b.globalPosition),
    sinkImmunityInvariant: sinkBlocks.length === topology.sinkCapacity,
    totalStreamedTokens: topology.totalStreamedTokens,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== StreamingLLM: Attention Sinks Topology ===");
    console.log(`Sink Capacity : ${topology.sinkCapacity}`);
    console.log(`Sinks Retained: ${sinkBlocks.length} tokens`);
    console.log(`Sink Token IDs: [${sinkBlocks.map((b) => b.tokenId).join(", ")}]`);
    console.log(`Sink Positions: [${sinkBlocks.map((b) => b.globalPosition).join(", ")}]`);
    console.log(`Immunity Check: ${payload.sinkImmunityInvariant ? "PASSED" : "FAILED"}`);
  }
}

async function cmd_streamllm_window(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const sinkCap = Number(parseFlagValue(args, "--sink=", "4"));
  const windowCap = Number(parseFlagValue(args, "--window=", "16"));
  const numTokens = Number(parseFlagValue(args, "--tokens=", "25"));

  const engine = new EosStreamingLlmCore(sinkCap, windowCap, 32);
  for (let t = 0; t < numTokens; t++) {
    engine.ingestToken(100 + t);
  }

  const active = engine.getActiveBlocks();
  const windowBlocks = active.filter((b) => !b.isSink);
  const topology = engine.getCacheTopology();

  const payload = {
    command: "toolchain:streamllm:window",
    windowCapacity: topology.windowCapacity,
    activeWindowBlocks: windowBlocks.length,
    windowTokenIds: windowBlocks.map((b) => b.tokenId),
    windowGlobalPositions: windowBlocks.map((b) => b.globalPosition),
    currentHeadSpan:
      windowBlocks.length > 0 ? [windowBlocks[0].tokenId, windowBlocks[windowBlocks.length - 1].tokenId] : [],
    totalCapacityCeiling: topology.totalCapacity,
    isCeilingPreserved: active.length <= topology.totalCapacity,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== StreamingLLM: Rolling Window Ring Buffer ===");
    console.log(`Window Cap    : ${topology.windowCapacity}`);
    console.log(`Active Window : ${windowBlocks.length} tokens`);
    console.log(
      `Token Span    : ${windowBlocks[0]?.tokenId || "N/A"} -> ${windowBlocks[windowBlocks.length - 1]?.tokenId || "N/A"}`,
    );
    console.log(`Total Active  : ${active.length} / ${topology.totalCapacity}`);
    console.log(`Ceiling State : ${payload.isCeilingPreserved ? "CONSERVED" : "BREACHED"}`);
  }
}

async function cmd_streamllm_rope(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const sinkCap = Number(parseFlagValue(args, "--sink=", "4"));
  const windowCap = Number(parseFlagValue(args, "--window=", "16"));
  const numTokens = Number(parseFlagValue(args, "--tokens=", "30"));

  const engine = new EosStreamingLlmCore(sinkCap, windowCap, 32);
  for (let t = 0; t < numTokens; t++) {
    engine.ingestToken(100 + t);
  }

  const ropeMapping = engine.computeDynamicRopePositions();

  const payload = {
    command: "toolchain:streamllm:rope",
    sinkPositions: ropeMapping.sinkPositions,
    windowPositions: ropeMapping.windowPositions,
    combinedPositions: ropeMapping.combinedPositions,
    isContiguousInWindow: ropeMapping.isContiguousInWindow,
    maxPositionAssigned: ropeMapping.maxPositionAssigned,
    theoreticalMaxUncompressed: numTokens - 1,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Dynamic Contiguous RoPE Re-indexing ===");
    console.log(`Sink Positions   : [${ropeMapping.sinkPositions.join(", ")}]`);
    console.log(
      `Window Positions : [${ropeMapping.windowPositions.slice(0, 8).join(", ")}... (len ${ropeMapping.windowPositions.length})]`,
    );
    console.log(`Window Contiguous: ${ropeMapping.isContiguousInWindow ? "YES (NO HOLES)" : "NO"}`);
    console.log(`Max RoPE Position: ${ropeMapping.maxPositionAssigned} (vs stream length ${numTokens})`);
  }
}

async function cmd_streamllm_evict(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const sinkCap = Number(parseFlagValue(args, "--sink=", "4"));
  const windowCap = Number(parseFlagValue(args, "--window=", "16"));
  const streamLen = Number(parseFlagValue(args, "--stream=", "50"));

  const engine = new EosStreamingLlmCore(sinkCap, windowCap, 32);
  const evictionHistory = [];

  for (let t = 0; t < streamLen; t++) {
    const res = engine.ingestToken(100 + t);
    if (res.eviction) {
      evictionHistory.push(res.eviction);
    }
  }

  const topology = engine.getCacheTopology();

  const payload = {
    command: "toolchain:streamllm:evict",
    streamTokens: streamLen,
    totalEvicted: topology.totalEvictedTokens,
    evictionsLogged: evictionHistory.length,
    firstEvictedGlobalPos: evictionHistory[0]?.evictedGlobalPosition ?? null,
    lastEvictedGlobalPos: evictionHistory[evictionHistory.length - 1]?.evictedGlobalPosition ?? null,
    sinkImmunityPreserved: evictionHistory.every((e) => e.wasSinkProtected),
    activeRetained: topology.currentActiveBlocks,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== StreamingLLM: O(1) Ring-Buffer Eviction Simulation ===");
    console.log(`Streamed Tokens : ${streamLen}`);
    console.log(`Total Evicted   : ${topology.totalEvictedTokens}`);
    console.log(`Eviction Span   : pos ${payload.firstEvictedGlobalPos} -> pos ${payload.lastEvictedGlobalPos}`);
    console.log(`Sink Protection : ${payload.sinkImmunityPreserved ? "100% IMMUNE" : "COMPROMISED"}`);
    console.log(`Final Active    : ${topology.currentActiveBlocks}`);
  }
}

async function cmd_streamllm_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const streamLen = Number(parseFlagValue(args, "--stream=", "1000"));
  const sinkCap = Number(parseFlagValue(args, "--sink=", "4"));
  const windowCap = Number(parseFlagValue(args, "--window=", "16"));

  const engine = new EosStreamingLlmCore(sinkCap, windowCap, 32);
  const receipt = engine.audit(streamLen, sinkCap, windowCap);

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== StreamingLLM Attention Sinks Audit Receipt ===");
    console.log(`Status        : ${receipt.status}`);
    console.log(`Stream Length : ${receipt.streamLength}`);
    console.log(`Sink Immunity : ${receipt.sinkImmunityVerified}`);
    console.log(`Memory Ceiling: ${receipt.memoryCeilingVerified}`);
    console.log(`RoPE Contig   : ${receipt.ropeContiguityVerified}`);
    console.log(`Perplexity Stb: ${receipt.perplexityStabilityVerified}`);
    console.log(`SHA-256 Seal  : ${receipt.sha256Signature}`);
    console.log(`Receipt Saved : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:streamllm:sink"] = cmd_streamllm_sink;
HANDLERS["toolchain:streamllm:window"] = cmd_streamllm_window;
HANDLERS["toolchain:streamllm:rope"] = cmd_streamllm_rope;
HANDLERS["toolchain:streamllm:evict"] = cmd_streamllm_evict;
HANDLERS["toolchain:streamllm:audit"] = cmd_streamllm_audit;

export async function handleStreamingLlmCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:streamllm command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
