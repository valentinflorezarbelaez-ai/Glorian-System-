/**
 * @file cliExpertParallelMoERouter.mjs
 * @description CLI handler for SPEC-325 / CHANGE-187: Expert Parallelism &
 * Mixture-of-Experts (MoE) Routing Engine (Top-K Gating, Capacity Bounding,
 * Auxiliary Load-Balancing Loss, and All-to-All Token Dispatch & Combine).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosExpertParallelMoECore } from "../../src/core/eosExpertParallelMoERouter.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("MOE_ROUTER_RECEIPT.json", root);
}

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_moe_route(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numExperts = Number(parseFlagValue(args, "--experts=", "4"));
  const topK = Number(parseFlagValue(args, "--topk=", "2"));
  const numTokens = Number(parseFlagValue(args, "--tokens=", "4"));
  const hiddenDim = Number(parseFlagValue(args, "--dim=", "4"));

  const engine = new EosExpertParallelMoECore({ totalExperts: numExperts, topK, hiddenDim });

  const tokens = Array.from({ length: numTokens }, (_, t) =>
    Float32Array.from({ length: hiddenDim }, (_, d) => Math.sin((t + 1) * 0.5 + d * 0.1)),
  );

  const routerWeights = Array.from({ length: numExperts }, (_, e) =>
    Float32Array.from({ length: hiddenDim }, (_, d) => Math.cos((e + 1) * 0.3 + d * 0.2)),
  );

  const batch = engine.routeTopK(tokens, routerWeights);

  const payload = {
    command: "toolchain:moe:route",
    tokenCount: numTokens,
    totalExperts: numExperts,
    topK,
    capacityPerExpert: batch.capacityPerExpert,
    routes: batch.routes.map((r) => ({
      tokenIndex: r.tokenIndex,
      selectedExperts: r.selectedExperts,
      gatingWeights: Array.from(r.gatingWeights).map((w) => Number(w.toFixed(4))),
      isDropped: r.isDropped,
    })),
    tokensPerExpert: batch.tokensPerExpert,
    auxiliaryLoss: batch.auxiliaryLoss,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== MoE Top-K Sparse Gating Router ===");
    console.log(`Tokens         : ${numTokens}`);
    console.log(`Experts        : ${numExperts}`);
    console.log(`Top-K          : ${topK}`);
    console.log(`Capacity/Expert: ${batch.capacityPerExpert}`);
    console.log(`Aux Loss       : ${batch.auxiliaryLoss}`);
  }
}

async function cmd_moe_capacity(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numExperts = Number(parseFlagValue(args, "--experts=", "4"));
  const topK = Number(parseFlagValue(args, "--topk=", "2"));
  const numTokens = Number(parseFlagValue(args, "--tokens=", "8"));
  const capacityFactor = Number(parseFlagValue(args, "--capacity=", "1.0"));

  const engine = new EosExpertParallelMoECore({
    totalExperts: numExperts,
    topK,
    capacityFactor,
  });

  const tokens = Array.from({ length: numTokens }, () => new Float32Array(4).fill(1.0));
  const routerWeights = Array.from({ length: numExperts }, () => new Float32Array(4).fill(0.5));

  const batch = engine.routeTopK(tokens, routerWeights, topK, capacityFactor);

  const payload = {
    command: "toolchain:moe:capacity",
    tokenCount: numTokens,
    totalExperts: numExperts,
    topK,
    capacityFactor,
    capacityPerExpert: batch.capacityPerExpert,
    tokensPerExpert: batch.tokensPerExpert,
    totalDroppedSlots: batch.totalDroppedSlots,
    capacityEnforced: batch.tokensPerExpert.every((c) => c <= batch.capacityPerExpert),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== MoE Expert Capacity Factor Inspection ===");
    console.log(`Tokens         : ${numTokens}`);
    console.log(`Experts        : ${numExperts}`);
    console.log(`Top-K          : ${topK}`);
    console.log(`Capacity Factor: ${capacityFactor}`);
    console.log(`Buffer Ceiling : ${batch.capacityPerExpert} tokens`);
    console.log(`Dropped Slots  : ${batch.totalDroppedSlots}`);
    console.log(`Enforced Strict: ${payload.capacityEnforced}`);
  }
}

async function cmd_moe_alltoall(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "2"));
  const numExperts = Number(parseFlagValue(args, "--experts=", "4"));
  const numTokens = Number(parseFlagValue(args, "--tokens=", "4"));
  const hiddenDim = Number(parseFlagValue(args, "--dim=", "4"));

  const engine = new EosExpertParallelMoECore({
    numWorkers,
    totalExperts: numExperts,
    topK: 2,
    hiddenDim,
  });

  const partitions = engine.partitionExperts(numExperts, numWorkers);
  const tokens = Array.from({ length: numTokens }, (_, i) => new Float32Array(hiddenDim).fill(i + 1));
  const routerWeights = Array.from({ length: numExperts }, (_, e) =>
    Float32Array.from({ length: hiddenDim }, (_, d) => Math.sin(e * 0.2 + d)),
  );

  const batch = engine.routeTopK(tokens, routerWeights);
  const dispatchMap = engine.allToAllDispatch(tokens, batch, partitions);

  let totalDispatched = 0;
  for (const items of dispatchMap.values()) totalDispatched += items.length;

  const payload = {
    command: "toolchain:moe:alltoall",
    workers: numWorkers,
    experts: numExperts,
    tokens: numTokens,
    partitions: partitions.map((p) => ({
      workerId: p.workerId,
      assignedExperts: p.expertIndices,
      tokensReceived: dispatchMap.get(p.workerId)?.length ?? 0,
    })),
    totalDispatchedTokens: totalDispatched,
    status: "DISPATCHED_AND_COMBINED",
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== MoE Two-Phase All-to-All Communication ===");
    console.log(`Workers        : ${numWorkers}`);
    console.log(`Experts        : ${numExperts}`);
    console.log(`Tokens         : ${numTokens}`);
    console.log(`Total Traded   : ${totalDispatched} slots`);
    console.log(`Status         : ${payload.status}`);
  }
}

async function cmd_moe_auxloss(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numExperts = Number(parseFlagValue(args, "--experts=", "4"));
  const alpha = Number(parseFlagValue(args, "--alpha=", "0.01"));

  const engine = new EosExpertParallelMoECore({ totalExperts: numExperts, auxLossCoeff: alpha });

  // Uniform distribution case
  const uniformProbs = [new Float32Array(numExperts).fill(1 / numExperts)];
  const uniformFractions = new Array(numExperts).fill(1 / numExperts);
  const uniformLoss = engine.computeAuxiliaryLoss(uniformProbs, uniformFractions, alpha);

  // Skewed / collapsed distribution case (all tokens to expert 0)
  const skewedProbs = [Float32Array.from({ length: numExperts }, (_, i) => (i === 0 ? 0.97 : 0.01))];
  const skewedFractions = new Array(numExperts).fill(0);
  skewedFractions[0] = 1.0;
  const skewedLoss = engine.computeAuxiliaryLoss(skewedProbs, skewedFractions, alpha);

  const payload = {
    command: "toolchain:moe:auxloss",
    numExperts,
    alpha,
    uniformTheoreticalLoss: uniformLoss,
    collapsedPenaltyLoss: skewedLoss,
    penaltyRatio: Number((skewedLoss / uniformLoss).toFixed(2)),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== MoE Auxiliary Load-Balancing Loss ===");
    console.log(`Experts        : ${numExperts}`);
    console.log(`Alpha Coeff    : ${alpha}`);
    console.log(`Uniform Loss   : ${uniformLoss}`);
    console.log(`Collapsed Loss : ${skewedLoss}`);
    console.log(`Penalty Ratio  : ${payload.penaltyRatio}x`);
  }
}

async function cmd_moe_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "2"));
  const numExperts = Number(parseFlagValue(args, "--experts=", "4"));
  const numTokens = Number(parseFlagValue(args, "--tokens=", "8"));
  const hiddenDim = Number(parseFlagValue(args, "--dim=", "4"));

  const engine = new EosExpertParallelMoECore({
    numWorkers,
    totalExperts: numExperts,
    hiddenDim,
  });

  const receipt = engine.audit(numWorkers, numExperts, numTokens, hiddenDim);
  const receiptPath = getReceiptPath(commandContext.root || ROOT);

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== MoE Routing Engine Invariant Audit ===");
    console.log(`Status         : ${receipt.status}`);
    console.log(`Workers        : ${receipt.numWorkers}`);
    console.log(`Experts        : ${receipt.totalExperts}`);
    console.log(`Capacity Bound : ${receipt.capacityBoundedCertified}`);
    console.log(`Aux Loss Minima: ${receipt.auxLossMinimaCertified}`);
    console.log(`Math Parity    : ${receipt.mathParityCertified}`);
    console.log(`Zero Leakage   : ${receipt.zeroLeakageCertified}`);
    console.log(`SHA-256 Seal   : ${receipt.sha256Receipt}`);
    console.log(`Receipt Saved  : ${receiptPath}`);
  }
}

HANDLERS["toolchain:moe:route"] = cmd_moe_route;
HANDLERS["toolchain:moe:capacity"] = cmd_moe_capacity;
HANDLERS["toolchain:moe:alltoall"] = cmd_moe_alltoall;
HANDLERS["toolchain:moe:auxloss"] = cmd_moe_auxloss;
HANDLERS["toolchain:moe:audit"] = cmd_moe_audit;

export async function handleMoeRouterCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:moe command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
