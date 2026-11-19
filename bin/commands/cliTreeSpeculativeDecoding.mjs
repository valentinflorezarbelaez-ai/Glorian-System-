/**
 * @file cliTreeSpeculativeDecoding.mjs
 * @description CLI handler for SPEC-330 / CHANGE-192: Tree-Structured Speculative
 * Decoding, Multi-Candidate Rejection Sampling & Dynamic Draft Verification Engine.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosTreeSpeculativeDecodingCore } from "../../src/core/eosTreeSpeculativeDecoding.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = resolveEvidencePath("TREE_SPECULATIVE_DECODING_RECEIPT.json", ROOT);

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_specdec_draft(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const root = Number(parseFlagValue(args, "--root=", "100"));
  const depth = Number(parseFlagValue(args, "--depth=", "3"));
  const branching = Number(parseFlagValue(args, "--branching=", "2"));

  const engine = new EosTreeSpeculativeDecodingCore(32000, 0.1);
  const tree = engine.buildDraftTree(root, depth, branching);

  const payload = {
    command: "toolchain:specdec:draft",
    rootTokenId: tree.rootNodeId,
    maxDepth: tree.maxDepth,
    branchingFactor: branching,
    totalCandidateNodes: tree.totalNodes,
    flattenedTokens: tree.flattenedTokenIds,
    positionIds: tree.positionIds,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Tree Speculative Decoding: Draft Topology ===");
    console.log(`Root Token    : ${tree.rootNodeId}`);
    console.log(`Max Depth     : ${tree.maxDepth}`);
    console.log(`Branching     : ${branching}`);
    console.log(`Total Nodes   : ${tree.totalNodes}`);
    console.log(`Flattened Seq : [${tree.flattenedTokenIds.slice(0, 8).join(", ")}...]`);
  }
}

async function cmd_specdec_mask(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const root = Number(parseFlagValue(args, "--root=", "100"));
  const depth = Number(parseFlagValue(args, "--depth=", "3"));
  const branching = Number(parseFlagValue(args, "--branching=", "2"));

  const engine = new EosTreeSpeculativeDecodingCore(32000, 0.1);
  const tree = engine.buildDraftTree(root, depth, branching);
  const mask = engine.synthesizeTreeAttentionMask(tree);

  let nonZeroCount = 0;
  for (let i = 0; i < mask.maskData.length; i++) {
    if (mask.maskData[i] === 1) nonZeroCount++;
  }

  const payload = {
    command: "toolchain:specdec:mask",
    dimension: mask.dimension,
    totalEntries: mask.dimension * mask.dimension,
    permittedCausalEntries: nonZeroCount,
    sparsityPercent: Number(((1 - nonZeroCount / (mask.dimension * mask.dimension)) * 100).toFixed(2)),
    rowAncestorsSample: mask.rowMajorIndices.slice(0, 5),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== 2D Tree Causal Attention Mask ===");
    console.log(`Dimension     : ${mask.dimension} x ${mask.dimension}`);
    console.log(`Permitted (1s): ${nonZeroCount}`);
    console.log(`Sparsity      : ${payload.sparsityPercent}%`);
    console.log(`Row 0 Lineage : [${mask.rowMajorIndices[0].join(", ")}]`);
  }
}

async function cmd_specdec_verify(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const root = Number(parseFlagValue(args, "--root=", "100"));
  const depth = Number(parseFlagValue(args, "--depth=", "3"));
  const branching = Number(parseFlagValue(args, "--branching=", "2"));

  const engine = new EosTreeSpeculativeDecodingCore(32000, 0.1);
  const tree = engine.buildDraftTree(root, depth, branching);

  // Synthetic distribution
  const distributions = tree.nodes.map((node) => {
    const targetDist = new Float32Array(32000);
    const draftDist = new Float32Array(32000);
    targetDist[node.tokenId] = 0.8;
    targetDist[node.tokenId + 1] = 0.2;
    draftDist[node.tokenId] = 0.7;
    draftDist[node.tokenId + 1] = 0.3;
    return {
      nodeId: node.nodeId,
      targetDistribution: targetDist,
      draftDistribution: draftDist,
    };
  });

  const result = engine.verifyTreeWithRejectionSampling(tree, distributions, [0.1, 0.15, 0.2, 0.95]);

  const payload = {
    command: "toolchain:specdec:verify",
    totalCandidates: tree.totalNodes,
    acceptedNodesCount: result.acceptedNodeIds.length,
    rejectedNodesCount: result.rejectedNodeIds.length,
    longestAcceptedPathTokens: result.longestAcceptedPathTokenIds,
    recoveryTokenId: result.recoveryTokenId,
    finalEmittedTokens: result.finalEmittedTokens,
    acceptanceRateAlpha: result.acceptanceRateAlpha,
    speedupEstimate: result.speedupEstimate,
    zeroKLDivergenceVerified: result.zeroKLDivergenceVerified,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Modified Rejection Sampling Verification ===");
    console.log(`Candidates    : ${tree.totalNodes}`);
    console.log(`Accepted Nodes: ${result.acceptedNodeIds.length}`);
    console.log(`Emitted Tokens: ${result.finalEmittedTokens.length} tokens`);
    console.log(`AcceptanceRate: ${(result.acceptanceRateAlpha * 100).toFixed(1)}%`);
    console.log(`Speedup Ratio : ${result.speedupEstimate}x`);
  }
}

async function cmd_specdec_speedup(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const alpha = Number(parseFlagValue(args, "--alpha=", "0.75"));
  const depth = Number(parseFlagValue(args, "--depth=", "3"));
  const branching = Number(parseFlagValue(args, "--branching=", "2"));

  const engine = new EosTreeSpeculativeDecodingCore(32000, 0.1);
  const modulation = engine.modulateTopology(alpha, depth, branching);

  const payload = {
    command: "toolchain:specdec:speedup",
    historicalAlpha: alpha,
    currentDepth: depth,
    currentBranching: branching,
    recommendedDepth: modulation.recommendedDepth,
    recommendedBranchingFactor: modulation.recommendedBranchingFactor,
    projectedSpeedup: modulation.projectedSpeedup,
    mode: modulation.mode,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Speculative Topology & Speedup Modulation ===");
    console.log(`Historical Alpha: ${(alpha * 100).toFixed(1)}%`);
    console.log(`Action Mode     : ${modulation.mode}`);
    console.log(`Next Depth      : ${modulation.recommendedDepth}`);
    console.log(`Next Branching  : ${modulation.recommendedBranchingFactor}`);
    console.log(`Projected Speedup: ${modulation.projectedSpeedup}x`);
  }
}

async function cmd_specdec_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const vocab = Number(parseFlagValue(args, "--vocab=", "1000"));
  const depth = Number(parseFlagValue(args, "--depth=", "3"));
  const branching = Number(parseFlagValue(args, "--branching=", "2"));

  const engine = new EosTreeSpeculativeDecodingCore(vocab, 0.1);
  const receipt = engine.audit(vocab, depth, branching);

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Tree Speculative Decoding Audit Receipt ===");
    console.log(`Status        : ${receipt.status}`);
    console.log(`Candidates    : ${receipt.totalCandidateNodes}`);
    console.log(`Mask Ancestry : ${receipt.treeMaskAncestryVerified}`);
    console.log(`Guaranteed Prog: ${receipt.guaranteedProgressVerified}`);
    console.log(`Zero KL Diverg: ${receipt.zeroKLDivergenceVerified}`);
    console.log(`Speedup Ratio : ${receipt.speedupRatio}x`);
    console.log(`SHA-256 Seal  : ${receipt.sha256Signature}`);
    console.log(`Receipt Saved : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:specdec:draft"] = cmd_specdec_draft;
HANDLERS["toolchain:specdec:mask"] = cmd_specdec_mask;
HANDLERS["toolchain:specdec:verify"] = cmd_specdec_verify;
HANDLERS["toolchain:specdec:speedup"] = cmd_specdec_speedup;
HANDLERS["toolchain:specdec:audit"] = cmd_specdec_audit;

export async function handleTreeSpeculativeDecodingCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:specdec command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
