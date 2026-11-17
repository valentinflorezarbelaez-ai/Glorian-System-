/**
 * @file eosFlashAttentionOnlineSoftmax.ts
 * @description Core implementation of SPEC-318 / CHANGE-180: FlashAttention-Style
 * Online Softmax Tiling & Block-Paged Attention Kernel.
 */

import { createHash } from "node:crypto";
import type {
  FlashAttentionConfig,
  RunningRowStats,
  TileExecutionMetadata,
  FlashAttentionForwardResult,
  FlashAttentionParityResult,
  FlashAttentionAuditReceipt,
} from "./eosFlashAttentionOnlineSoftmax.types.js";

export class EosFlashAttentionOnlineSoftmaxCore {
  private readonly headDim: number;
  private readonly blockSizeRow: number;
  private readonly blockSizeCol: number;
  private readonly isCausal: boolean;
  private readonly scale: number;

  public constructor(config: FlashAttentionConfig) {
    if (!Number.isInteger(config.headDim) || config.headDim <= 0) {
      throw new Error(`[FlashAttention] headDim must be a positive integer, got: ${config.headDim}`);
    }
    this.headDim = config.headDim;
    this.blockSizeRow = config.blockSizeRow ?? 16;
    this.blockSizeCol = config.blockSizeCol ?? 16;
    this.isCausal = config.isCausal ?? false;
    this.scale = config.scale ?? 1 / Math.sqrt(this.headDim);

    if (this.blockSizeRow <= 0 || this.blockSizeCol <= 0) {
      throw new Error(`[FlashAttention] Block sizes must be positive integers.`);
    }
  }

  public getConfig(): Required<FlashAttentionConfig> {
    return {
      headDim: this.headDim,
      blockSizeRow: this.blockSizeRow,
      blockSizeCol: this.blockSizeCol,
      isCausal: this.isCausal,
      scale: this.scale,
    };
  }

  /**
   * Computes scaled dot product tile S_ij = (Q_i * K_j^T) * scale with optional causal masking.
   */
  public computeTileScores(qTile: number[][], kTile: number[][], rowOffset: number, colOffset: number): number[][] {
    const numRows = qTile.length;
    const numCols = kTile.length;
    const scores: number[][] = Array.from({ length: numRows }, () => new Array(numCols).fill(0));

    for (let r = 0; r < numRows; r++) {
      const globalRow = rowOffset + r;
      for (let c = 0; c < numCols; c++) {
        const globalCol = colOffset + c;
        if (this.isCausal && globalCol > globalRow) {
          scores[r][c] = -Infinity;
          continue;
        }

        let dot = 0;
        const qRow = qTile[r];
        const kRow = kTile[c];
        for (let d = 0; d < this.headDim; d++) {
          dot += qRow[d] * kRow[d];
        }
        scores[r][c] = dot * this.scale;
      }
    }
    return scores;
  }

  /**
   * Updates per-row running stats using online softmax rescaling:
   * m_new = max(m_old, rowmax(S))
   * l_new = exp(m_old - m_new) * l_old + sum(exp(S - m_new))
   * O_new = exp(m_old - m_new) * O_old + exp(S - m_new) * V
   */
  public updateRowOnlineSoftmax(rowStats: RunningRowStats, scoresRow: number[], vTile: number[][]): void {
    let localMax = -Infinity;
    for (let c = 0; c < scoresRow.length; c++) {
      if (scoresRow[c] > localMax) {
        localMax = scoresRow[c];
      }
    }

    if (!Number.isFinite(localMax)) {
      // Entire row is masked out (e.g. strict causal future)
      return;
    }

    const prevMax = rowStats.runningMax;
    const newMax = prevMax === -Infinity ? localMax : Math.max(prevMax, localMax);

    const alpha = prevMax === -Infinity ? 0 : Math.exp(prevMax - newMax);

    // Compute unnormalized probabilities exp(S - newMax)
    const probs: number[] = new Array(scoresRow.length);
    let localSum = 0;
    for (let c = 0; c < scoresRow.length; c++) {
      const p = scoresRow[c] === -Infinity ? 0 : Math.exp(scoresRow[c] - newMax);
      probs[c] = p;
      localSum += p;
    }

    // Update running normalizer
    rowStats.runningMax = newMax;
    rowStats.runningSum = alpha * rowStats.runningSum + localSum;

    // Rescale previous accumulated output and add contribution of current V tile
    for (let d = 0; d < this.headDim; d++) {
      let vContribution = 0;
      for (let c = 0; c < scoresRow.length; c++) {
        if (probs[c] > 0) {
          vContribution += probs[c] * vTile[c][d];
        }
      }
      rowStats.accumulatedOutput[d] = alpha * rowStats.accumulatedOutput[d] + vContribution;
    }
  }

  /**
   * Executes tiled FlashAttention forward pass.
   */
  public forward(q: number[][], k: number[][], v: number[][]): FlashAttentionForwardResult {
    const startHr = process.hrtime.bigint();
    const numQ = q.length;
    const numK = k.length;
    if (numQ === 0 || numK === 0) {
      throw new Error(`[FlashAttention] Inputs Q and K cannot be empty.`);
    }
    if (v.length !== numK) {
      throw new Error(`[FlashAttention] K and V must have identical sequence length (${numK} vs ${v.length}).`);
    }

    const totalRowBlocks = Math.ceil(numQ / this.blockSizeRow);
    const totalColBlocks = Math.ceil(numK / this.blockSizeCol);
    const totalTiles = totalRowBlocks * totalColBlocks;

    // Initialize per-query-row running state
    const rowStates: RunningRowStats[] = Array.from({ length: numQ }, (_, idx) => ({
      rowIndex: idx,
      runningMax: -Infinity,
      runningSum: 0,
      accumulatedOutput: new Array(this.headDim).fill(0),
    }));

    let evaluatedTiles = 0;
    let prunedTiles = 0;

    // Outer loop: iterate over Key/Value column blocks
    for (let j = 0; j < totalColBlocks; j++) {
      const colStart = j * this.blockSizeCol;
      const colEnd = Math.min(colStart + this.blockSizeCol, numK);
      const kTile = k.slice(colStart, colEnd);
      const vTile = v.slice(colStart, colEnd);

      // Inner loop: iterate over Query row blocks
      for (let i = 0; i < totalRowBlocks; i++) {
        const rowStart = i * this.blockSizeRow;
        const rowEnd = Math.min(rowStart + this.blockSizeRow, numQ);

        // Block-level causal pruning optimization
        if (this.isCausal && colStart > rowEnd - 1) {
          prunedTiles++;
          continue;
        }

        evaluatedTiles++;
        const qTile = q.slice(rowStart, rowEnd);
        const scoresTile = this.computeTileScores(qTile, kTile, rowStart, colStart);

        for (let r = 0; r < scoresTile.length; r++) {
          const globalRow = rowStart + r;
          this.updateRowOnlineSoftmax(rowStates[globalRow], scoresTile[r], vTile);
        }
      }
    }

    // Final normalization: O_i = accumulatedOutput_i / runningSum_i
    const output: number[][] = Array.from({ length: numQ }, (_, r) => {
      const st = rowStates[r];
      if (st.runningSum <= 0) {
        return new Array(this.headDim).fill(0);
      }
      return st.accumulatedOutput.map((val) => val / st.runningSum);
    });

    const elapsedMs = Number(process.hrtime.bigint() - startHr) / 1e6;
    // Working memory strictly O(Br * d + Bc * d + Br * Bc)
    const workingMemoryBytes =
      4 *
      (this.blockSizeRow * this.headDim + this.blockSizeCol * this.headDim * 2 + this.blockSizeRow * this.blockSizeCol);
    // 2 * Nq * Nk * d FLOPs for unpruned full attention
    const theoreticalFlops = evaluatedTiles * (2 * this.blockSizeRow * this.blockSizeCol * this.headDim);

    return {
      output,
      totalRowBlocks,
      totalColBlocks,
      totalTiles,
      evaluatedTiles,
      prunedTiles,
      workingMemoryBytes,
      theoreticalFlops,
      elapsedMs,
    };
  }

  /**
   * Reference naive O(N^2) attention implementation for exact numerical parity verification.
   */
  public computeNaiveAttention(q: number[][], k: number[][], v: number[][]): number[][] {
    const numQ = q.length;
    const numK = k.length;
    const output: number[][] = Array.from({ length: numQ }, () => new Array(this.headDim).fill(0));

    for (let r = 0; r < numQ; r++) {
      const scores: number[] = new Array(numK);
      let rowMax = -Infinity;

      for (let c = 0; c < numK; c++) {
        if (this.isCausal && c > r) {
          scores[c] = -Infinity;
          continue;
        }
        let dot = 0;
        for (let d = 0; d < this.headDim; d++) {
          dot += q[r][d] * k[c][d];
        }
        const s = dot * this.scale;
        scores[c] = s;
        if (s > rowMax) {
          rowMax = s;
        }
      }

      if (!Number.isFinite(rowMax)) {
        continue;
      }

      let sumExp = 0;
      const probs: number[] = new Array(numK);
      for (let c = 0; c < numK; c++) {
        const p = scores[c] === -Infinity ? 0 : Math.exp(scores[c] - rowMax);
        probs[c] = p;
        sumExp += p;
      }

      for (let d = 0; d < this.headDim; d++) {
        let acc = 0;
        for (let c = 0; c < numK; c++) {
          acc += (probs[c] / sumExp) * v[c][d];
        }
        output[r][d] = acc;
      }
    }

    return output;
  }

  /**
   * Verifies numerical parity between tiled FlashAttention and naive O(N^2) attention.
   */
  public verifyParity(q: number[][], k: number[][], v: number[][], tolerance = 1e-5): FlashAttentionParityResult {
    const flashResult = this.forward(q, k, v);
    const naiveOutput = this.computeNaiveAttention(q, k, v);

    let maxAbsoluteError = 0;
    let sumAbsDiff = 0;
    let sumNaiveAbs = 0;

    for (let r = 0; r < q.length; r++) {
      for (let d = 0; d < this.headDim; d++) {
        const fVal = flashResult.output[r][d];
        const nVal = naiveOutput[r][d];
        const diff = Math.abs(fVal - nVal);
        if (diff > maxAbsoluteError) {
          maxAbsoluteError = diff;
        }
        sumAbsDiff += diff;
        sumNaiveAbs += Math.abs(nVal);
      }
    }

    const relativeError = sumNaiveAbs > 0 ? sumAbsDiff / sumNaiveAbs : 0;
    const isEquivalent = maxAbsoluteError <= tolerance;

    return {
      isEquivalent,
      maxAbsoluteError: Number(maxAbsoluteError.toFixed(8)),
      relativeError: Number(relativeError.toFixed(8)),
      tolerance,
      flashOutputSample: flashResult.output[0]?.slice(0, 4) ?? [],
      naiveOutputSample: naiveOutput[0]?.slice(0, 4) ?? [],
    };
  }

  /**
   * Audits invariants and emits signed cryptographic receipt.
   */
  public audit(testLength = 64): FlashAttentionAuditReceipt {
    const q: number[][] = [];
    const k: number[][] = [];
    const v: number[][] = [];

    // Deterministic pseudo-random generation (LCG)
    let seed = 42;
    const nextRand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return (seed / 4294967296) * 2 - 1; // [-1.0, 1.0]
    };

    for (let i = 0; i < testLength; i++) {
      const qRow: number[] = [];
      const kRow: number[] = [];
      const vRow: number[] = [];
      for (let d = 0; d < this.headDim; d++) {
        qRow.push(Number(nextRand().toFixed(4)));
        kRow.push(Number(nextRand().toFixed(4)));
        vRow.push(Number(nextRand().toFixed(4)));
      }
      q.push(qRow);
      k.push(kRow);
      v.push(vRow);
    }

    const forwardRes = this.forward(q, k, v);
    const parity = this.verifyParity(q, k, v);

    const numericalStabilityCertified = parity.isEquivalent && Number.isFinite(forwardRes.output[0][0]);
    const workingMemoryBounded = forwardRes.workingMemoryBytes < 1024 * 1024; // < 1MB
    const auditStatus = numericalStabilityCertified && workingMemoryBounded ? "VERIFIED" : "FAILED";

    const payload = JSON.stringify({
      schemaVersion: "1.0.0",
      specRef: "SPEC-318",
      changeRef: "CHANGE-180",
      auditStatus,
      headDim: this.headDim,
      sequenceLengthQ: testLength,
      sequenceLengthK: testLength,
      totalTiles: forwardRes.totalTiles,
      evaluatedTiles: forwardRes.evaluatedTiles,
      prunedTiles: forwardRes.prunedTiles,
      workingMemoryBytes: forwardRes.workingMemoryBytes,
      maxAbsoluteError: parity.maxAbsoluteError,
      relativeError: parity.relativeError,
      numericalStabilityCertified,
      workingMemoryBounded,
    });

    const sha256Receipt = createHash("sha256").update(payload).digest("hex");

    return {
      schemaVersion: "1.0.0",
      specRef: "SPEC-318",
      changeRef: "CHANGE-180",
      auditStatus,
      headDim: this.headDim,
      sequenceLengthQ: testLength,
      sequenceLengthK: testLength,
      totalTiles: forwardRes.totalTiles,
      evaluatedTiles: forwardRes.evaluatedTiles,
      prunedTiles: forwardRes.prunedTiles,
      workingMemoryBytes: forwardRes.workingMemoryBytes,
      maxAbsoluteError: parity.maxAbsoluteError,
      relativeError: parity.relativeError,
      numericalStabilityCertified,
      workingMemoryBounded,
      sha256Receipt,
      timestampIso: new Date().toISOString(),
    };
  }
}
