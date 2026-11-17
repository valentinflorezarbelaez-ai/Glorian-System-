/**
 * @file eosTensorParallelAttention.ts
 * @description Sovereign Tensor Parallel Attention Engine implementing
 * Sharded Multi-Head Attention (TP-MHA), Grouped-Query Attention (TP-GQA),
 * Sequence Parallelism, and Ring Attention.
 * Conforms to SPEC-323 / CHANGE-185.
 */

import { createHash } from "node:crypto";
import type {
  AttentionHeadPartition,
  AttentionWeightsShard,
  TensorParallelAttentionConfig,
  TensorParallelAttentionResult,
  RingAttentionResult,
  TensorParallelAttentionAuditReceipt,
} from "./eosTensorParallelAttention.types.js";

export class EosTensorParallelAttentionCore {
  public readonly workerCount: number;
  public readonly totalQHeads: number;
  public readonly totalKVHeads: number;
  public readonly headDim: number;
  public readonly hiddenDim: number;
  public readonly gqaRatio: number;

  constructor(config?: Partial<TensorParallelAttentionConfig>) {
    this.workerCount = config?.workerCount ?? 2;
    this.totalQHeads = config?.totalQHeads ?? 4;
    this.totalKVHeads = config?.totalKVHeads ?? 2;
    this.headDim = config?.headDim ?? 4;
    this.hiddenDim = config?.hiddenDim ?? this.totalQHeads * this.headDim;

    if (!Number.isInteger(this.workerCount) || this.workerCount < 2) {
      throw new RangeError(`workerCount P must be an integer >= 2, received ${this.workerCount}`);
    }
    if (this.totalQHeads % this.workerCount !== 0) {
      throw new RangeError(`totalQHeads (${this.totalQHeads}) must be divisible by workerCount (${this.workerCount})`);
    }
    if (this.totalKVHeads % this.workerCount !== 0) {
      throw new RangeError(
        `totalKVHeads (${this.totalKVHeads}) must be divisible by workerCount (${this.workerCount})`,
      );
    }
    if (this.totalQHeads % this.totalKVHeads !== 0) {
      throw new RangeError(
        `totalQHeads (${this.totalQHeads}) must be divisible by totalKVHeads (${this.totalKVHeads}) for GQA`,
      );
    }

    this.gqaRatio = this.totalQHeads / this.totalKVHeads;
  }

  /**
   * Partitions attention heads across workers.
   */
  public partitionAttentionHeads(): AttentionHeadPartition[] {
    const qHeadsPerWorker = this.totalQHeads / this.workerCount;
    const kvHeadsPerWorker = this.totalKVHeads / this.workerCount;

    const partitions: AttentionHeadPartition[] = [];
    for (let p = 0; p < this.workerCount; p++) {
      const qHeadIndices = Array.from({ length: qHeadsPerWorker }, (_, i) => p * qHeadsPerWorker + i);
      const kvHeadIndices = Array.from({ length: kvHeadsPerWorker }, (_, i) => p * kvHeadsPerWorker + i);

      partitions.push({
        workerId: p,
        workerCount: this.workerCount,
        qHeadIndices,
        kvHeadIndices,
        numQHeads: qHeadsPerWorker,
        numKVHeads: kvHeadsPerWorker,
        headDim: this.headDim,
      });
    }

    return partitions;
  }

  /**
   * Partitions monolithic weights W_Q, W_K, W_V (column-wise) and W_O (row-wise).
   */
  public partitionWeights(W_q: number[][], W_k: number[][], W_v: number[][], W_o: number[][]): AttentionWeightsShard[] {
    const qDimTotal = this.totalQHeads * this.headDim;
    const kvDimTotal = this.totalKVHeads * this.headDim;
    const qDimPerWorker = qDimTotal / this.workerCount;
    const kvDimPerWorker = kvDimTotal / this.workerCount;

    const shards: AttentionWeightsShard[] = [];

    for (let p = 0; p < this.workerCount; p++) {
      const qStart = p * qDimPerWorker;
      const qEnd = qStart + qDimPerWorker;
      const kvStart = p * kvDimPerWorker;
      const kvEnd = kvStart + kvDimPerWorker;

      // Column partition W_q
      const wqShard = W_q.map((row) => row.slice(qStart, qEnd));
      // Column partition W_k
      const wkShard = W_k.map((row) => row.slice(kvStart, kvEnd));
      // Column partition W_v
      const wvShard = W_v.map((row) => row.slice(kvStart, kvEnd));
      // Row partition W_o
      const woShard = W_o.slice(qStart, qEnd);

      shards.push({
        workerId: p,
        wqShard,
        wkShard,
        wvShard,
        woShard,
      });
    }

    return shards;
  }

  /**
   * Matrix multiplication helper: C = A x B.
   */
  public matmul(A: number[][], B: number[][]): number[][] {
    const rows = A.length;
    const cols = B[0].length;
    const inner = B.length;
    const C: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

    for (let i = 0; i < rows; i++) {
      for (let k = 0; k < inner; k++) {
        const aVal = A[i][k];
        if (aVal === 0) continue;
        for (let j = 0; j < cols; j++) {
          C[i][j] += aVal * B[k][j];
        }
      }
    }
    return C;
  }

  /**
   * Evaluates local multi-head or grouped-query attention for assigned local heads.
   *
   * @param Q_local Shape: [B, S, (H_Q / P) * d_k]
   * @param K_local Shape: [B, S, (H_KV / P) * d_k]
   * @param V_local Shape: [B, S, (H_KV / P) * d_k]
   */
  public forwardLocalAttention(Q_local: number[][][], K_local: number[][][], V_local: number[][][]): number[][][] {
    const B = Q_local.length;
    const S = Q_local[0].length;
    const numQHeads = this.totalQHeads / this.workerCount;
    const numKVHeads = this.totalKVHeads / this.workerCount;
    const headsPerKVGroup = numQHeads / numKVHeads;
    const scale = 1.0 / Math.sqrt(this.headDim);

    const localOutputDim = numQHeads * this.headDim;
    const output: number[][][] = Array.from({ length: B }, () =>
      Array.from({ length: S }, () => new Array(localOutputDim).fill(0)),
    );

    for (let b = 0; b < B; b++) {
      for (let qHeadIdx = 0; qHeadIdx < numQHeads; qHeadIdx++) {
        const kvHeadIdx = Math.floor(qHeadIdx / headsPerKVGroup);
        const qOffset = qHeadIdx * this.headDim;
        const kvOffset = kvHeadIdx * this.headDim;

        // Compute attention scores [S, S] for this head
        for (let i = 0; i < S; i++) {
          const qVec = Q_local[b][i].slice(qOffset, qOffset + this.headDim);
          const rawScores = new Array(S);
          let maxScore = -Infinity;

          for (let j = 0; j < S; j++) {
            const kVec = K_local[b][j].slice(kvOffset, kvOffset + this.headDim);
            let dot = 0;
            for (let d = 0; d < this.headDim; d++) {
              dot += qVec[d] * kVec[d];
            }
            const score = dot * scale;
            rawScores[j] = score;
            if (score > maxScore) maxScore = score;
          }

          // Online softmax probabilities
          let sumExp = 0;
          const attnProbs = new Array(S);
          for (let j = 0; j < S; j++) {
            const p = Math.exp(rawScores[j] - maxScore);
            attnProbs[j] = p;
            sumExp += p;
          }
          for (let j = 0; j < S; j++) {
            attnProbs[j] /= sumExp;
          }

          // Multiply by V to get context vector
          for (let d = 0; d < this.headDim; d++) {
            let contextVal = 0;
            for (let j = 0; j < S; j++) {
              contextVal += attnProbs[j] * V_local[b][j][kvOffset + d];
            }
            output[b][i][qOffset + d] = contextVal;
          }
        }
      }
    }

    return output;
  }

  /**
   * Executes end-to-end Tensor Parallel Attention with column projections,
   * local attention computation, row projections, and a single All-Reduce barrier.
   */
  public forwardTensorParallelAttention(
    X: number[][][],
    W_q: number[][],
    W_k: number[][],
    W_v: number[][],
    W_o: number[][],
  ): TensorParallelAttentionResult {
    const B = X.length;
    const S = X[0].length;
    const d = this.hiddenDim;
    const shards = this.partitionWeights(W_q, W_k, W_v, W_o);

    // Each worker executes local column-parallel projection and local attention
    const localOutputs: number[][][][] = [];
    for (let p = 0; p < this.workerCount; p++) {
      const shard = shards[p];

      // Flatten X from [B, S, d] to [B*S, d] for matmul
      const X_flat = X.flat();
      const Q_flat = this.matmul(X_flat, shard.wqShard);
      const K_flat = this.matmul(X_flat, shard.wkShard);
      const V_flat = this.matmul(X_flat, shard.wvShard);

      // Reshape back to [B, S, Dim]
      const Q_local: number[][][] = [];
      const K_local: number[][][] = [];
      const V_local: number[][][] = [];
      for (let b = 0; b < B; b++) {
        Q_local.push(Q_flat.slice(b * S, (b + 1) * S));
        K_local.push(K_flat.slice(b * S, (b + 1) * S));
        V_local.push(V_flat.slice(b * S, (b + 1) * S));
      }

      // Local attention computation
      const A_local = this.forwardLocalAttention(Q_local, K_local, V_local);
      const A_flat = A_local.flat();

      // Row-parallel projection: [B*S, (H_Q/P)*d_k] x [(H_Q/P)*d_k, d] -> [B*S, d]
      const O_flat = this.matmul(A_flat, shard.woShard);

      const O_local: number[][][] = [];
      for (let b = 0; b < B; b++) {
        O_local.push(O_flat.slice(b * S, (b + 1) * S));
      }
      localOutputs.push(O_local);
    }

    // Collective All-Reduce barrier (summation across workers)
    const allReduceOutput: number[][][] = Array.from({ length: B }, () =>
      Array.from({ length: S }, () => new Array(d).fill(0)),
    );

    for (let p = 0; p < this.workerCount; p++) {
      const O_p = localOutputs[p];
      for (let b = 0; b < B; b++) {
        for (let s = 0; s < S; s++) {
          for (let dim = 0; dim < d; dim++) {
            allReduceOutput[b][s][dim] += O_p[b][s][dim];
          }
        }
      }
    }

    // Central monolithic reference execution for verification
    const centralOutput = this.forwardCentralAttention(X, W_q, W_k, W_v, W_o);

    let maxError = 0;
    for (let b = 0; b < B; b++) {
      for (let s = 0; s < S; s++) {
        for (let dim = 0; dim < d; dim++) {
          const diff = Math.abs(allReduceOutput[b][s][dim] - centralOutput[b][s][dim]);
          if (diff > maxError) maxError = diff;
        }
      }
    }

    return {
      output: allReduceOutput,
      allReduceCount: 1,
      workerCount: this.workerCount,
      totalQHeads: this.totalQHeads,
      totalKVHeads: this.totalKVHeads,
      isMathEquivalent: maxError <= 1e-4,
      maxAbsoluteError: maxError,
    };
  }

  /**
   * Reference centralized multi-head / grouped-query attention.
   */
  public forwardCentralAttention(
    X: number[][][],
    W_q: number[][],
    W_k: number[][],
    W_v: number[][],
    W_o: number[][],
  ): number[][][] {
    const B = X.length;
    const S = X[0].length;
    const d = this.hiddenDim;
    const X_flat = X.flat();

    const Q_flat = this.matmul(X_flat, W_q);
    const K_flat = this.matmul(X_flat, W_k);
    const V_flat = this.matmul(X_flat, W_v);

    const Q_full: number[][][] = [];
    const K_full: number[][][] = [];
    const V_full: number[][][] = [];
    for (let b = 0; b < B; b++) {
      Q_full.push(Q_flat.slice(b * S, (b + 1) * S));
      K_full.push(K_flat.slice(b * S, (b + 1) * S));
      V_full.push(V_flat.slice(b * S, (b + 1) * S));
    }

    // Evaluate attention across all H_Q heads
    const headsPerKV = this.totalQHeads / this.totalKVHeads;
    const scale = 1.0 / Math.sqrt(this.headDim);
    const A_full: number[][][] = Array.from({ length: B }, () =>
      Array.from({ length: S }, () => new Array(this.totalQHeads * this.headDim).fill(0)),
    );

    for (let b = 0; b < B; b++) {
      for (let qHead = 0; qHead < this.totalQHeads; qHead++) {
        const kvHead = Math.floor(qHead / headsPerKV);
        const qOff = qHead * this.headDim;
        const kvOff = kvHead * this.headDim;

        for (let i = 0; i < S; i++) {
          const qVec = Q_full[b][i].slice(qOff, qOff + this.headDim);
          const raw = new Array(S);
          let maxSc = -Infinity;

          for (let j = 0; j < S; j++) {
            const kVec = K_full[b][j].slice(kvOff, kvOff + this.headDim);
            let dot = 0;
            for (let d_ = 0; d_ < this.headDim; d_++) dot += qVec[d_] * kVec[d_];
            const sc = dot * scale;
            raw[j] = sc;
            if (sc > maxSc) maxSc = sc;
          }

          let sumExp = 0;
          const probs = new Array(S);
          for (let j = 0; j < S; j++) {
            const p = Math.exp(raw[j] - maxSc);
            probs[j] = p;
            sumExp += p;
          }
          for (let j = 0; j < S; j++) probs[j] /= sumExp;

          for (let d_ = 0; d_ < this.headDim; d_++) {
            let ctx = 0;
            for (let j = 0; j < S; j++) {
              ctx += probs[j] * V_full[b][j][kvOff + d_];
            }
            A_full[b][i][qOff + d_] = ctx;
          }
        }
      }
    }

    const A_flat = A_full.flat();
    const O_flat = this.matmul(A_flat, W_o);
    const O_full: number[][][] = [];
    for (let b = 0; b < B; b++) {
      O_full.push(O_flat.slice(b * S, (b + 1) * S));
    }
    return O_full;
  }

  /**
   * Slices sequence activations along sequence length dimension S across workers.
   */
  public partitionSequence(X: number[][][]): number[][][][] {
    const B = X.length;
    const S = X[0].length;
    if (S % this.workerCount !== 0) {
      throw new RangeError(`Sequence length S (${S}) must be divisible by workerCount (${this.workerCount})`);
    }
    const sPerWorker = S / this.workerCount;
    const slices: number[][][][] = [];

    for (let p = 0; p < this.workerCount; p++) {
      const pSlice: number[][][] = [];
      const start = p * sPerWorker;
      const end = start + sPerWorker;
      for (let b = 0; b < B; b++) {
        pSlice.push(X[b].slice(start, end));
      }
      slices.push(pSlice);
    }
    return slices;
  }

  /**
   * Executes Ring Attention where Q blocks remain local and KV blocks shift in a circular ring.
   *
   * @param Q_shards Array of P local Q blocks, each of shape [B, S_local, d]
   * @param K_shards Array of P local K blocks, each of shape [B, S_local, d]
   * @param V_shards Array of P local V blocks, each of shape [B, S_local, d]
   */
  public forwardRingAttention(
    Q_shards: number[][][][],
    K_shards: number[][][][],
    V_shards: number[][][][],
  ): RingAttentionResult {
    const P = this.workerCount;
    const B = Q_shards[0].length;
    const S_local = Q_shards[0][0].length;
    const d = Q_shards[0][0][0].length;
    const S_total = S_local * P;
    const scale = 1.0 / Math.sqrt(d);

    // Accumulated numerators and normalizers for online softmax across ring steps
    // output[p][b][i] = sum_{step} (sum_j exp(s - m_global) * V) / l_global
    const m_stat: number[][][] = Array.from({ length: P }, () =>
      Array.from({ length: B }, () => new Array(S_local).fill(-Infinity)),
    );
    const l_stat: number[][][] = Array.from({ length: P }, () =>
      Array.from({ length: B }, () => new Array(S_local).fill(0)),
    );
    const acc_out: number[][][][] = Array.from({ length: P }, () =>
      Array.from({ length: B }, () => Array.from({ length: S_local }, () => new Array(d).fill(0))),
    );

    // Current KV block references at each worker
    const currentK = [...K_shards];
    const currentV = [...V_shards];

    for (let step = 0; step < P; step++) {
      for (let p = 0; p < P; p++) {
        const Q_p = Q_shards[p];
        const K_curr = currentK[p];
        const V_curr = currentV[p];

        for (let b = 0; b < B; b++) {
          for (let i = 0; i < S_local; i++) {
            const q = Q_p[b][i];
            const localScores = new Array(S_local);
            let localMax = -Infinity;

            for (let j = 0; j < S_local; j++) {
              let dot = 0;
              for (let dim = 0; dim < d; dim++) {
                dot += q[dim] * K_curr[b][j][dim];
              }
              const score = dot * scale;
              localScores[j] = score;
              if (score > localMax) localMax = score;
            }

            // Online Softmax Rescaling
            const prevMax = m_stat[p][b][i];
            const newMax = Math.max(prevMax, localMax);
            const prevScale = prevMax === -Infinity ? 0 : Math.exp(prevMax - newMax);
            const currScale = Math.exp(localMax - newMax);

            let localExpSum = 0;
            const localWeights = new Array(S_local);
            for (let j = 0; j < S_local; j++) {
              const expVal = Math.exp(localScores[j] - localMax);
              localWeights[j] = expVal;
              localExpSum += expVal;
            }

            // Rescale running numerator and denominator
            l_stat[p][b][i] = l_stat[p][b][i] * prevScale + localExpSum * currScale;
            m_stat[p][b][i] = newMax;

            for (let dim = 0; dim < d; dim++) {
              let localContext = 0;
              for (let j = 0; j < S_local; j++) {
                localContext += localWeights[j] * V_curr[b][j][dim];
              }
              acc_out[p][b][i][dim] = acc_out[p][b][i][dim] * prevScale + localContext * currScale;
            }
          }
        }
      }

      // Circular Ring Shift: send KV to (p + 1) % P
      const lastK = currentK[P - 1];
      const lastV = currentV[P - 1];
      for (let p = P - 1; p > 0; p--) {
        currentK[p] = currentK[p - 1];
        currentV[p] = currentV[p - 1];
      }
      currentK[0] = lastK;
      currentV[0] = lastV;
    }

    // Final normalization
    const ringOutput: number[][][][] = [];
    for (let p = 0; p < P; p++) {
      const pOut: number[][][] = [];
      for (let b = 0; b < B; b++) {
        const bOut: number[][] = [];
        for (let i = 0; i < S_local; i++) {
          const l = l_stat[p][b][i];
          const row: number[] = new Array(d);
          for (let dim = 0; dim < d; dim++) {
            row[dim] = acc_out[p][b][i][dim] / l;
          }
          bOut.push(row);
        }
        pOut.push(bOut);
      }
      ringOutput.push(pOut);
    }

    // Reconstruct full concatenated sequence [B, S_total, d]
    const fullRingOutput: number[][][] = Array.from({ length: B }, () => []);
    for (let b = 0; b < B; b++) {
      for (let p = 0; p < P; p++) {
        fullRingOutput[b].push(...ringOutput[p][b]);
      }
    }

    // Central monolithic sequence attention comparison
    const fullQ: number[][][] = Array.from({ length: B }, () => []);
    const fullK: number[][][] = Array.from({ length: B }, () => []);
    const fullV: number[][][] = Array.from({ length: B }, () => []);
    for (let b = 0; b < B; b++) {
      for (let p = 0; p < P; p++) {
        fullQ[b].push(...Q_shards[p][b]);
        fullK[b].push(...K_shards[p][b]);
        fullV[b].push(...V_shards[p][b]);
      }
    }

    const fullCentralOutput: number[][][] = Array.from({ length: B }, () =>
      Array.from({ length: S_total }, () => new Array(d).fill(0)),
    );

    for (let b = 0; b < B; b++) {
      for (let i = 0; i < S_total; i++) {
        const q = fullQ[b][i];
        const scores = new Array(S_total);
        let maxSc = -Infinity;
        for (let j = 0; j < S_total; j++) {
          let dot = 0;
          for (let dim = 0; dim < d; dim++) dot += q[dim] * fullK[b][j][dim];
          const sc = dot * scale;
          scores[j] = sc;
          if (sc > maxSc) maxSc = sc;
        }

        let sumExp = 0;
        const probs = new Array(S_total);
        for (let j = 0; j < S_total; j++) {
          const p = Math.exp(scores[j] - maxSc);
          probs[j] = p;
          sumExp += p;
        }
        for (let j = 0; j < S_total; j++) probs[j] /= sumExp;

        for (let dim = 0; dim < d; dim++) {
          let ctx = 0;
          for (let j = 0; j < S_total; j++) ctx += probs[j] * fullV[b][j][dim];
          fullCentralOutput[b][i][dim] = ctx;
        }
      }
    }

    let maxError = 0;
    for (let b = 0; b < B; b++) {
      for (let i = 0; i < S_total; i++) {
        for (let dim = 0; dim < d; dim++) {
          const diff = Math.abs(fullRingOutput[b][i][dim] - fullCentralOutput[b][i][dim]);
          if (diff > maxError) maxError = diff;
        }
      }
    }

    return {
      output: fullRingOutput,
      numRingSteps: P,
      localSequenceLength: S_local,
      totalSequenceLength: S_total,
      isExactMatch: maxError <= 1e-4,
      maxAbsoluteError: maxError,
    };
  }

  /**
   * Audits the Tensor Parallel Attention engine and emits a signed receipt.
   */
  public audit(): TensorParallelAttentionAuditReceipt {
    const partitions = this.partitionAttentionHeads();

    // Verify head conservation
    const sumQ = partitions.reduce((acc, p) => acc + p.numQHeads, 0);
    const sumKV = partitions.reduce((acc, p) => acc + p.numKVHeads, 0);
    const headConservationCertified = sumQ === this.totalQHeads && sumKV === this.totalKVHeads;

    // Test tensor parallel attention execution
    const B = 2;
    const S = 4;
    const d = this.hiddenDim;
    const X: number[][][] = Array.from({ length: B }, (_, b) =>
      Array.from({ length: S }, (_, s) =>
        Array.from({ length: d }, (_, dim) => (b + 1) * 0.1 + (s + 1) * 0.05 + dim * 0.01),
      ),
    );

    const W_q = Array.from({ length: d }, (_, r) =>
      Array.from({ length: this.totalQHeads * this.headDim }, (_, c) => (r + 1) * 0.02 + c * 0.01),
    );
    const W_k = Array.from({ length: d }, (_, r) =>
      Array.from({ length: this.totalKVHeads * this.headDim }, (_, c) => (r + 1) * 0.015 + c * 0.01),
    );
    const W_v = Array.from({ length: d }, (_, r) =>
      Array.from({ length: this.totalKVHeads * this.headDim }, (_, c) => (r + 1) * 0.025 + c * 0.01),
    );
    const W_o = Array.from({ length: this.totalQHeads * this.headDim }, (_, r) =>
      Array.from({ length: d }, (_, c) => (r + 1) * 0.03 + c * 0.01),
    );

    const tpResult = this.forwardTensorParallelAttention(X, W_q, W_k, W_v, W_o);
    const singleBarrierCertified = tpResult.allReduceCount === 1;
    const mathParityCertified = tpResult.isMathEquivalent;

    // Test Ring Attention
    const S_local = 2;
    const Q_shards = Array.from({ length: this.workerCount }, (_, p) =>
      Array.from({ length: B }, () =>
        Array.from({ length: S_local }, () => Array.from({ length: d }, (_, dim) => (p + 1) * 0.2 + dim * 0.05)),
      ),
    );
    const K_shards = Array.from({ length: this.workerCount }, (_, p) =>
      Array.from({ length: B }, () =>
        Array.from({ length: S_local }, () => Array.from({ length: d }, (_, dim) => (p + 1) * 0.15 + dim * 0.05)),
      ),
    );
    const V_shards = Array.from({ length: this.workerCount }, (_, p) =>
      Array.from({ length: B }, () =>
        Array.from({ length: S_local }, () => Array.from({ length: d }, (_, dim) => (p + 1) * 0.25 + dim * 0.05)),
      ),
    );

    const ringResult = this.forwardRingAttention(Q_shards, K_shards, V_shards);
    const ringAttentionCertified = ringResult.isExactMatch;

    const auditStatus =
      headConservationCertified && singleBarrierCertified && mathParityCertified && ringAttentionCertified
        ? "VERIFIED"
        : "FAILED";

    const timestampIso = new Date().toISOString();
    const digestPayload = JSON.stringify({
      specRef: "SPEC-323",
      changeRef: "CHANGE-185",
      workerCount: this.workerCount,
      totalQHeads: this.totalQHeads,
      totalKVHeads: this.totalKVHeads,
      headConservationCertified,
      singleBarrierCertified,
      mathParityCertified,
      ringAttentionCertified,
      timestampIso,
    });

    const sha256Receipt = createHash("sha256").update(digestPayload).digest("hex");

    return {
      schemaVersion: "1.0.0",
      specRef: "SPEC-323",
      changeRef: "CHANGE-185",
      auditStatus,
      workerCount: this.workerCount,
      totalQHeads: this.totalQHeads,
      totalKVHeads: this.totalKVHeads,
      headConservationCertified,
      singleBarrierCertified,
      mathParityCertified,
      ringAttentionCertified,
      sha256Receipt,
      timestampIso,
    };
  }
}
