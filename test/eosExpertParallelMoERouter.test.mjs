/**
 * @file test/eosExpertParallelMoERouter.test.mjs
 * @description BDD test suite for SPEC-325 / CHANGE-187: Expert Parallelism &
 * Mixture-of-Experts (MoE) Routing Engine (Top-K Gating, Capacity Bounding,
 * Auxiliary Load-Balancing Loss, and All-to-All Token Dispatch & Combine).
 */

import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosExpertParallelMoECore } from "../src/core/eosExpertParallelMoERouter.ts";
import { handleMoeRouterCommand } from "../bin/commands/cliExpertParallelMoERouter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = resolveEvidencePath("MOE_ROUTER_RECEIPT.json", ROOT);

describe("SPEC-325: Expert Parallelism & Mixture-of-Experts (MoE) Routing Engine", () => {
  test("BDD-1725: Top-K Sparse Gating & Weight Normalization", () => {
    const numExperts = 4;
    const topK = 2;
    const hiddenDim = 4;
    const numTokens = 4;

    const engine = new EosExpertParallelMoECore({
      totalExperts: numExperts,
      topK,
      hiddenDim,
    });

    const tokens = Array.from({ length: numTokens }, (_, t) =>
      Float32Array.from({ length: hiddenDim }, (_, d) => Math.sin((t + 1) * 0.3 + d * 0.1)),
    );

    const routerWeights = Array.from({ length: numExperts }, (_, e) =>
      Float32Array.from({ length: hiddenDim }, (_, d) => Math.cos((e + 1) * 0.4 + d * 0.2)),
    );

    const batch = engine.routeTopK(tokens, routerWeights, topK, 2.0);
    assert.equal(batch.routes.length, numTokens);

    for (let t = 0; t < numTokens; t++) {
      const route = batch.routes[t];
      assert.equal(route.selectedExperts.length, topK);
      assert.equal(route.gatingWeights.length, topK);

      let sum = 0;
      for (let k = 0; k < topK; k++) {
        assert.ok(route.gatingWeights[k] > 0, "Gating weight must be positive");
        sum += route.gatingWeights[k];
      }
      assert.ok(Math.abs(sum - 1.0) <= 1e-6, `Expected gating weights sum to 1.0, got ${sum}`);
    }
  });

  test("BDD-1726: Expert Capacity Truncation & Token Buffer Bounds", () => {
    const numExperts = 4;
    const topK = 2;
    const numTokens = 8;
    const capacityFactor = 1.0;

    const engine = new EosExpertParallelMoECore({
      totalExperts: numExperts,
      topK,
      capacityFactor,
    });

    // Highly biased tokens causing all tokens to route toward expert 0 and 1
    const tokens = Array.from({ length: numTokens }, () => new Float32Array([10.0, 10.0, 10.0, 10.0]));
    const routerWeights = [
      new Float32Array([5.0, 5.0, 5.0, 5.0]), // Expert 0: massive logit
      new Float32Array([4.0, 4.0, 4.0, 4.0]), // Expert 1: second massive logit
      new Float32Array([-5.0, -5.0, -5.0, -5.0]),
      new Float32Array([-5.0, -5.0, -5.0, -5.0]),
    ];

    const batch = engine.routeTopK(tokens, routerWeights, topK, capacityFactor);

    // Capacity = ceil((K * T / E) * C) = ceil((2 * 8 / 4) * 1.0) = 4
    assert.equal(batch.capacityPerExpert, 4);

    // Neither expert 0 nor expert 1 may exceed capacity of 4
    for (let e = 0; e < numExperts; e++) {
      assert.ok(
        batch.tokensPerExpert[e] <= batch.capacityPerExpert,
        `Expert ${e} exceeded capacity: ${batch.tokensPerExpert[e]} > ${batch.capacityPerExpert}`,
      );
    }

    // Since 8 tokens each wanted expert 0 and expert 1 (8 slots each), but capacity is 4 each,
    // exactly 4 tokens were accepted per expert and 8 slots total were dropped
    assert.equal(batch.totalDroppedSlots, 8);
  });

  test("BDD-1727: Auxiliary Load-Balancing Loss Calculation & Minima", () => {
    const numExperts = 4;
    const alpha = 0.01;
    const engine = new EosExpertParallelMoECore({ totalExperts: numExperts, auxLossCoeff: alpha });

    // Perfectly balanced: f_i = 1/4, P_i = 1/4
    const uniformProbs = [new Float32Array([0.25, 0.25, 0.25, 0.25])];
    const uniformFractions = [0.25, 0.25, 0.25, 0.25];
    const uniformLoss = engine.computeAuxiliaryLoss(uniformProbs, uniformFractions, alpha);

    // Theoretical minimum: alpha * E * sum(f_i * P_i) = 0.01 * 4 * (4 * 1/16) = 0.01
    assert.ok(
      Math.abs(uniformLoss - alpha) <= 1e-6,
      `Expected uniform loss to equal alpha (${alpha}), got ${uniformLoss}`,
    );

    // Collapsed onto expert 0: f_0 = 1.0, P_0 = 1.0
    const collapsedProbs = [new Float32Array([1.0, 0.0, 0.0, 0.0])];
    const collapsedFractions = [1.0, 0.0, 0.0, 0.0];
    const collapsedLoss = engine.computeAuxiliaryLoss(collapsedProbs, collapsedFractions, alpha);

    // Collapsed loss: alpha * E * (1 * 1) = 0.01 * 4 * 1 = 0.04
    assert.ok(
      collapsedLoss > uniformLoss,
      `Collapsed loss (${collapsedLoss}) must strictly penalize vs uniform loss (${uniformLoss})`,
    );
    assert.equal(collapsedLoss, 0.04);
  });

  test("BDD-1728: Two-Phase All-to-All Token Dispatch & Combine", () => {
    const numWorkers = 2;
    const numExperts = 4;
    const numTokens = 4;
    const hiddenDim = 4;

    const engine = new EosExpertParallelMoECore({
      numWorkers,
      totalExperts: numExperts,
      topK: 2,
      hiddenDim,
    });

    const partitions = engine.partitionExperts(numExperts, numWorkers);
    assert.equal(partitions.length, 2);
    assert.deepEqual(partitions[0].expertIndices, [0, 1]);
    assert.deepEqual(partitions[1].expertIndices, [2, 3]);

    const tokens = Array.from({ length: numTokens }, (_, i) => new Float32Array(hiddenDim).fill(i + 1));
    const routerWeights = Array.from({ length: numExperts }, (_, e) =>
      Float32Array.from({ length: hiddenDim }, (_, d) => Math.sin(e * 0.2 + d)),
    );

    const batch = engine.routeTopK(tokens, routerWeights, 2, 2.0);
    const dispatchMap = engine.allToAllDispatch(tokens, batch, partitions);

    assert.ok(dispatchMap.has(0));
    assert.ok(dispatchMap.has(1));

    // Verify all dispatched tokens match original token data
    for (const [_wId, items] of dispatchMap.entries()) {
      for (const item of items) {
        assert.equal(item.data.length, hiddenDim);
        const originalToken = tokens[item.tokenIndex];
        assert.deepEqual(item.data, originalToken);
      }
    }
  });

  test("BDD-1729: Mathematical Parity Against Centralized MoE Reference", () => {
    const numWorkers = 2;
    const numExperts = 4;
    const numTokens = 4;
    const hiddenDim = 4;

    const engine = new EosExpertParallelMoECore({
      numWorkers,
      totalExperts: numExperts,
      topK: 2,
      hiddenDim,
      capacityFactor: 2.0, // High capacity factor to avoid token dropping
    });

    const tokens = Array.from({ length: numTokens }, (_, t) =>
      Float32Array.from({ length: hiddenDim }, (_, d) => Math.sin((t + 1) * 0.4 + d * 0.2)),
    );

    const routerWeights = Array.from({ length: numExperts }, (_, e) =>
      Float32Array.from({ length: hiddenDim }, (_, d) => Math.cos((e + 1) * 0.5 + d * 0.3)),
    );

    const expertWeights = new Map();
    const D_hidden = hiddenDim * 2;
    for (let e = 0; e < numExperts; e++) {
      const w1 = Array.from({ length: D_hidden }, (_, h) =>
        Float32Array.from({ length: hiddenDim }, (_, d) => Math.sin((e + 1) * 0.1 + h * 0.2 + d * 0.05)),
      );
      const w2 = Array.from({ length: hiddenDim }, (_, d) =>
        Float32Array.from({ length: D_hidden }, (_, h) => Math.cos((e + 1) * 0.1 + d * 0.2 + h * 0.05)),
      );
      expertWeights.set(e, { w1, w2 });
    }

    const result = engine.forward(tokens, routerWeights, expertWeights);
    assert.equal(result.mathParityPassed, true);
    assert.equal(result.droppedTokensCount, 0);
  });

  test("BDD-1730: CLI Toolchain Parity & Invariant Audit Receipt", async () => {
    const commands = [
      { command: "toolchain:moe:route", args: ["--experts=4", "--topk=2", "--tokens=4", "--json"] },
      {
        command: "toolchain:moe:capacity",
        args: ["--experts=4", "--topk=2", "--tokens=8", "--capacity=1.0", "--json"],
      },
      { command: "toolchain:moe:alltoall", args: ["--workers=2", "--experts=4", "--tokens=4", "--json"] },
      { command: "toolchain:moe:auxloss", args: ["--experts=4", "--alpha=0.01", "--json"] },
      { command: "toolchain:moe:audit", args: ["--workers=2", "--experts=4", "--tokens=8", "--json"] },
    ];

    for (const cmdCtx of commands) {
      const res = await handleMoeRouterCommand(cmdCtx);
      assert.equal(res, true, `CLI command ${cmdCtx.command} failed`);
    }

    assert.ok(fs.existsSync(RECEIPT_PATH), "MOE_ROUTER_RECEIPT.json missing");
    const receipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, "utf8"));
    assert.equal(receipt.status, "VERIFIED");
    assert.equal(receipt.capacityBoundedCertified, true);
    assert.equal(receipt.auxLossMinimaCertified, true);
    assert.equal(receipt.mathParityCertified, true);
    assert.equal(receipt.zeroLeakageCertified, true);
    assert.ok(receipt.sha256Receipt && receipt.sha256Receipt.length === 64);
  });
});
