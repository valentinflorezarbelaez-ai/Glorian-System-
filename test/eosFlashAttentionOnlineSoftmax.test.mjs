/**
 * @file test/eosFlashAttentionOnlineSoftmax.test.mjs
 * @description BDD test suite for SPEC-318 / CHANGE-180: FlashAttention-Style
 * Online Softmax Tiling & Block-Paged Attention Kernel.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosFlashAttentionOnlineSoftmaxCore } from "../src/core/eosFlashAttentionOnlineSoftmax.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/FLASH_ATTENTION_ONLINE_SOFTMAX_RECEIPT.json");

describe("SPEC-318: FlashAttention Online Softmax Tiling & Block-Paged Attention Kernel", () => {
  test("BDD-1683: Tile Partitioning & Workspace Memory Bounds", () => {
    const headDim = 16;
    const blockSizeRow = 16;
    const blockSizeCol = 16;
    const core = new EosFlashAttentionOnlineSoftmaxCore({ headDim, blockSizeRow, blockSizeCol });

    const nq = 64;
    const nk = 64;
    const q = Array.from({ length: nq }, () => new Array(headDim).fill(0.2));
    const k = Array.from({ length: nk }, () => new Array(headDim).fill(0.3));
    const v = Array.from({ length: nk }, () => new Array(headDim).fill(0.5));

    const result = core.forward(q, k, v);

    assert.equal(result.totalRowBlocks, 4);
    assert.equal(result.totalColBlocks, 4);
    assert.equal(result.totalTiles, 16);
    assert.equal(result.evaluatedTiles, 16);
    assert.equal(result.prunedTiles, 0);

    // Working memory strictly O(Br * d + Bc * d + Br * Bc)
    // 4 * (16 * 16 + 16 * 16 * 2 + 16 * 16) = 4 * (256 + 512 + 256) = 4 * 1024 = 4096 bytes
    assert.equal(result.workingMemoryBytes, 4096);
    assert.ok(result.workingMemoryBytes < 64 * 1024); // well below 64KB L1 cache
  });

  test("BDD-1684: Scaled Dot-Product Tile Matrix Multiplication & Causal Masking", () => {
    const headDim = 16;
    const core = new EosFlashAttentionOnlineSoftmaxCore({ headDim, blockSizeRow: 4, blockSizeCol: 4, isCausal: true });

    // Q tile at row offset 0, K tile at col offset 0
    const qTile = Array.from({ length: 4 }, () => new Array(headDim).fill(1.0));
    const kTile = Array.from({ length: 4 }, () => new Array(headDim).fill(1.0));

    const scores = core.computeTileScores(qTile, kTile, 0, 0);

    // Diagonal elements: dot product = 16 * (1.0 * 1.0) = 16. Scale = 1/sqrt(16) = 0.25 => 16 * 0.25 = 4.0
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (c > r) {
          assert.equal(scores[r][c], -Infinity, `Position (${r}, ${c}) must be -Infinity under causal mask`);
        } else {
          assert.equal(scores[r][c], 4.0, `Position (${r}, ${c}) must equal 4.0`);
        }
      }
    }
  });

  test("BDD-1685: Online Softmax Running Maximum & Sum Rescaling", () => {
    const headDim = 8;
    const core = new EosFlashAttentionOnlineSoftmaxCore({ headDim, blockSizeRow: 4, blockSizeCol: 4 });

    const rowStats = {
      rowIndex: 0,
      runningMax: 2.0,
      runningSum: 4.0,
      accumulatedOutput: new Array(headDim).fill(2.0),
    };

    const scoresRow = [3.0, 1.0, 4.0, 2.0];
    const vTile = Array.from({ length: 4 }, () => new Array(headDim).fill(1.0));

    core.updateRowOnlineSoftmax(rowStats, scoresRow, vTile);

    // Local max of scoresRow is 4.0. Old max was 2.0. New max is max(2.0, 4.0) = 4.0
    assert.equal(rowStats.runningMax, 4.0);
    // alpha = exp(2.0 - 4.0) = exp(-2.0)
    const expectedAlpha = Math.exp(-2.0);
    // local unnormalized probs: exp(3-4)=exp(-1), exp(1-4)=exp(-3), exp(4-4)=1, exp(2-4)=exp(-2)
    const expectedLocalSum = Math.exp(-1) + Math.exp(-3) + 1.0 + Math.exp(-2);
    const expectedNewSum = expectedAlpha * 4.0 + expectedLocalSum;

    assert.ok(Math.abs(rowStats.runningSum - expectedNewSum) < 1e-6);
    assert.ok(rowStats.runningSum > 0, "Normalizer sum must remain strictly positive");
  });

  test("BDD-1686: Full Attention Forward Pass & Mathematical Equivalence", () => {
    const headDim = 16;
    const core = new EosFlashAttentionOnlineSoftmaxCore({
      headDim,
      blockSizeRow: 16,
      blockSizeCol: 16,
      isCausal: true,
    });

    const n = 48;
    const q = [];
    const k = [];
    const v = [];

    let seed = 12345;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return (seed / 4294967296) * 2 - 1;
    };

    for (let i = 0; i < n; i++) {
      const qR = [];
      const kR = [];
      const vR = [];
      for (let d = 0; d < headDim; d++) {
        qR.push(nextRand());
        kR.push(nextRand());
        vR.push(nextRand());
      }
      q.push(qR);
      k.push(kR);
      v.push(vR);
    }

    const parity = core.verifyParity(q, k, v, 1e-5);

    assert.ok(parity.isEquivalent, `Parity check failed with maxAbsoluteError: ${parity.maxAbsoluteError}`);
    assert.ok(parity.maxAbsoluteError < 1e-5, `Max error ${parity.maxAbsoluteError} must be < 1e-5`);
    assert.ok(parity.relativeError < 1e-5, `Relative error ${parity.relativeError} must be < 1e-5`);
  });

  test("BDD-1687: Causal Block Pruning Acceleration Fast-Path", () => {
    const headDim = 16;
    const blockSizeRow = 16;
    const blockSizeCol = 16;
    const core = new EosFlashAttentionOnlineSoftmaxCore({
      headDim,
      blockSizeRow,
      blockSizeCol,
      isCausal: true,
    });

    const n = 64; // 4 blocks x 4 blocks = 16 tiles total
    const q = Array.from({ length: n }, () => new Array(headDim).fill(0.1));
    const k = Array.from({ length: n }, () => new Array(headDim).fill(0.1));
    const v = Array.from({ length: n }, () => new Array(headDim).fill(0.5));

    const result = core.forward(q, k, v);

    // In a 4x4 causal matrix:
    // row 0: attends to col 0 (pruned: cols 1, 2, 3 -> 3 tiles)
    // row 1: attends to cols 0, 1 (pruned: cols 2, 3 -> 2 tiles)
    // row 2: attends to cols 0, 1, 2 (pruned: col 3 -> 1 tile)
    // row 3: attends to cols 0, 1, 2, 3 (pruned: 0 tiles)
    // Total pruned tiles = 3 + 2 + 1 = 6 tiles out of 16!
    assert.equal(result.totalTiles, 16);
    assert.equal(result.prunedTiles, 6);
    assert.equal(result.evaluatedTiles, 10);
    assert.equal(result.evaluatedTiles + result.prunedTiles, result.totalTiles);
  });

  test("BDD-1688: Structural Invariant Audit & Cryptographic SHA-256 Receipt", () => {
    const headDim = 16;
    const core = new EosFlashAttentionOnlineSoftmaxCore({
      headDim,
      blockSizeRow: 16,
      blockSizeCol: 16,
      isCausal: true,
    });

    const receipt = core.audit(64);

    assert.equal(receipt.schemaVersion, "1.0.0");
    assert.equal(receipt.specRef, "SPEC-318");
    assert.equal(receipt.changeRef, "CHANGE-180");
    assert.equal(receipt.auditStatus, "VERIFIED");
    assert.ok(receipt.numericalStabilityCertified);
    assert.ok(receipt.workingMemoryBounded);
    assert.ok(receipt.maxAbsoluteError < 1e-5);
    assert.equal(receipt.sha256Receipt.length, 64);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });
});
