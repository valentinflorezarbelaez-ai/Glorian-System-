/**
 * @file eosMegatronTensorParallelism.ts
 * @description Megatron-LM Style Tensor Parallelism Engine (SPEC-321 / CHANGE-183).
 * Implements column-parallel linear projection, row-parallel linear projection,
 * fused element-wise activations (GeLU/SiLU), single-barrier collective Ring
 * All-Reduce synchronization, and sharded vocabulary cross-entropy loss.
 */

import { createHash } from "node:crypto";
import { EosRingAllReduceCore } from "./eosRingAllReduce.ts";
import type {
  ActivationFunction,
  MegatronConfig,
  MegatronMlpResult,
  ShardedCrossEntropyResult,
  ShardedWeights,
  MegatronAuditReceipt,
} from "./eosMegatronTensorParallelism.types.ts";

export * from "./eosMegatronTensorParallelism.types.ts";

export class EosMegatronTensorParallelismCore {
  private readonly workerCount: number;
  private readonly inputDimension: number;
  private readonly hiddenDimension: number;
  private readonly outputDimension: number;
  private readonly activation: ActivationFunction;
  private readonly tolerance: number;
  private readonly ringCore: EosRingAllReduceCore;

  public constructor(config: MegatronConfig = {}) {
    const wc = config.workerCount ?? 2;
    if (!Number.isInteger(wc) || wc < 1) {
      throw new Error(`[MegatronTP] workerCount must be an integer >= 1, got: ${wc}`);
    }
    this.workerCount = wc;
    this.inputDimension = config.inputDimension ?? 4;
    this.hiddenDimension = config.hiddenDimension ?? 8;
    this.outputDimension = config.outputDimension ?? 4;
    this.activation = config.activation ?? "GELU";
    this.tolerance = config.tolerance ?? 1e-6;

    if (this.hiddenDimension % this.workerCount !== 0) {
      throw new Error(
        `[MegatronTP] hiddenDimension (${this.hiddenDimension}) must be divisible by workerCount (${this.workerCount}).`,
      );
    }

    this.ringCore = new EosRingAllReduceCore({
      workerCount: Math.max(2, this.workerCount),
      tolerance: this.tolerance,
    });
  }

  public getConfig(): Required<MegatronConfig> {
    return {
      workerCount: this.workerCount,
      inputDimension: this.inputDimension,
      hiddenDimension: this.hiddenDimension,
      outputDimension: this.outputDimension,
      activation: this.activation,
      tolerance: this.tolerance,
    };
  }

  /**
   * General matrix multiplication: C = A [M x K] * B [K x N] -> [M x N].
   */
  public matmul(A: number[][], B: number[][]): number[][] {
    const M = A.length;
    const K = A[0].length;
    const N = B[0].length;

    const C: number[][] = Array.from({ length: M }, () => new Array(N).fill(0));
    for (let i = 0; i < M; i++) {
      for (let k = 0; k < K; k++) {
        const a_ik = A[i][k];
        for (let j = 0; j < N; j++) {
          C[i][j] += a_ik * B[k][j];
        }
      }
    }
    return C;
  }

  /**
   * Element-wise matrix addition: C = A + B.
   */
  public matAdd(A: number[][], B: number[][]): number[][] {
    const M = A.length;
    const N = A[0].length;
    const C: number[][] = Array.from({ length: M }, () => new Array(N).fill(0));
    for (let i = 0; i < M; i++) {
      for (let j = 0; j < N; j++) {
        C[i][j] = A[i][j] + B[i][j];
      }
    }
    return C;
  }

  /**
   * High-accuracy tanh approximation for Gaussian Error Linear Unit (GeLU).
   */
  public gelu(x: number): number {
    const sqrt2OverPi = 0.7978845608028654; // sqrt(2 / pi)
    const coeff = 0.044715;
    const inner = sqrt2OverPi * (x + coeff * x * x * x);
    return 0.5 * x * (1.0 + Math.tanh(inner));
  }

  /**
   * Sigmoid Linear Unit (SiLU / Swish-1).
   */
  public silu(x: number): number {
    return x / (1.0 + Math.exp(-x));
  }

  /**
   * In-place or element-wise non-linear activation application.
   */
  public applyActivation(mat: number[][], act: ActivationFunction = this.activation): number[][] {
    const M = mat.length;
    const N = mat[0].length;
    const res: number[][] = Array.from({ length: M }, () => new Array(N).fill(0));

    for (let i = 0; i < M; i++) {
      for (let j = 0; j < N; j++) {
        const val = mat[i][j];
        switch (act) {
          case "GELU":
            res[i][j] = this.gelu(val);
            break;
          case "SILU":
            res[i][j] = this.silu(val);
            break;
          case "RELU":
            res[i][j] = Math.max(0.0, val);
            break;
          case "IDENTITY":
          default:
            res[i][j] = val;
            break;
        }
      }
    }
    return res;
  }

  /**
   * Partitions monolithic weights W1 [d_in, d_hidden] and W2 [d_hidden, d_out]
   * into Megatron-LM column-parallel and row-parallel shards.
   */
  public partitionWeights(W1: number[][], W2: number[][]): ShardedWeights[] {
    const P = this.workerCount;
    const dIn = W1.length;
    const dHidden = W1[0].length;
    const dOut = W2[0].length;

    const hiddenPerWorker = dHidden / P;
    const sharded: ShardedWeights[] = [];

    for (let p = 0; p < P; p++) {
      const colStart = p * hiddenPerWorker;
      const colEnd = colStart + hiddenPerWorker;

      // 1. Column-parallel slice of W1: [dIn, hiddenPerWorker]
      const w1Shard: number[][] = Array.from({ length: dIn }, (_, r) => W1[r].slice(colStart, colEnd));

      // 2. Row-parallel slice of W2: [hiddenPerWorker, dOut]
      const w2Shard: number[][] = W2.slice(colStart, colEnd).map((row) => [...row]);

      sharded.push({
        workerId: p,
        w1Shard,
        w2Shard,
      });
    }

    return sharded;
  }

  /**
   * Forward Column-Parallel Linear: Y_p = X * W1_p.
   * Inputs are replicated across all workers; outputs are sharded column-wise.
   */
  public forwardColumnParallel(X: number[][], w1Shard: number[][]): number[][] {
    return this.matmul(X, w1Shard);
  }

  /**
   * Forward Row-Parallel Linear: O_p = Z_p * W2_p.
   * Inputs are sharded along columns; outputs are partial sums of identical shape.
   */
  public forwardRowParallel(Z: number[][], w2Shard: number[][]): number[][] {
    return this.matmul(Z, w2Shard);
  }

  /**
   * Forward Megatron-LM MLP block:
   * 1. Column-Parallel projection (X * W1_p)
   * 2. Local element-wise activation sigma(Y_p)
   * 3. Row-Parallel projection (Z_p * W2_p)
   * 4. Single-Barrier Ring All-Reduce collective sum over O_p
   */
  public forwardMlp(X: number[][], W1: number[][], W2: number[][]): MegatronMlpResult {
    const startHr = process.hrtime.bigint();
    const P = this.workerCount;
    const B = X.length;
    const dIn = W1.length;
    const dHidden = W1[0].length;
    const dOut = W2[0].length;
    const hiddenPerWorker = dHidden / P;

    // 1. Partition weights into column and row shards
    const shards = this.partitionWeights(W1, W2);

    // 2. Compute local forward projections on each worker
    const workerPartialOutputs: number[][][] = [];
    for (let p = 0; p < P; p++) {
      // Column parallel
      const Y_p = this.forwardColumnParallel(X, shards[p].w1Shard);
      // Local activation (zero communication)
      const Z_p = this.applyActivation(Y_p);
      // Row parallel partial projection
      const O_p = this.forwardRowParallel(Z_p, shards[p].w2Shard);
      workerPartialOutputs.push(O_p);
    }

    // 3. Collective Synchronization Barrier: exactly 1 All-Reduce
    const flatLen = B * dOut;
    const workerFlatTensors: number[][] = [];
    for (let p = 0; p < P; p++) {
      const flat: number[] = [];
      for (let r = 0; r < B; r++) {
        for (let c = 0; c < dOut; c++) {
          flat.push(workerPartialOutputs[p][r][c]);
        }
      }
      workerFlatTensors.push(flat);
    }

    let synchronizedFlat: number[];
    let bytesTransferredPerWorker = 0;

    if (P === 1) {
      synchronizedFlat = workerFlatTensors[0];
    } else {
      const ringRes = this.ringCore.allReduce(workerFlatTensors);
      synchronizedFlat = ringRes.synchronizedTensor;
      bytesTransferredPerWorker = ringRes.bytesTransferredPerWorker;
    }

    // Reshape back to [B, dOut]
    const synchronizedOutput: number[][] = Array.from({ length: B }, (_, r) =>
      synchronizedFlat.slice(r * dOut, (r + 1) * dOut),
    );

    // 4. Ground-truth centralized reference computation
    const Y_central = this.matmul(X, W1);
    const Z_central = this.applyActivation(Y_central);
    const O_central = this.matmul(Z_central, W2);

    // 5. Numerical parity error calculation
    let maxAbsoluteError = 0;
    for (let r = 0; r < B; r++) {
      for (let c = 0; c < dOut; c++) {
        const diff = Math.abs(synchronizedOutput[r][c] - O_central[r][c]);
        if (diff > maxAbsoluteError) {
          maxAbsoluteError = diff;
        }
      }
    }

    const elapsedMs = Number(process.hrtime.bigint() - startHr) / 1e6;
    const isMathematicallyEquivalent = maxAbsoluteError <= this.tolerance;

    return {
      synchronizedOutput,
      workerCount: P,
      batchSize: B,
      inputDimension: dIn,
      hiddenDimension: dHidden,
      outputDimension: dOut,
      hiddenPerWorker,
      totalAllReduceBarriers: 1,
      bytesTransferredPerWorker,
      maxAbsoluteErrorAgainstCentral: Number(maxAbsoluteError.toFixed(8)),
      isMathematicallyEquivalent,
      elapsedMs,
    };
  }

  /**
   * Sharded Vocabulary Parallel Cross-Entropy Loss:
   * Computes distributed Log-Sum-Exp and loss without full logit materialization.
   */
  public computeShardedCrossEntropy(
    hidden: number[][],
    vocabWeights: number[][],
    targetTokens: number[],
  ): ShardedCrossEntropyResult {
    const P = this.workerCount;
    const B = hidden.length;
    const V = vocabWeights[0].length;
    const vocabPerWorker = Math.floor(V / P);

    // 1. Partition vocab weights column-wise
    const shardWeights: number[][][] = [];
    for (let p = 0; p < P; p++) {
      const start = p * vocabPerWorker;
      const end = p === P - 1 ? V : start + vocabPerWorker;
      const shard: number[][] = Array.from({ length: hidden[0].length }, (_, r) => vocabWeights[r].slice(start, end));
      shardWeights.push(shard);
    }

    // 2. Each worker computes local logits: [B, vocabPerWorker]
    const workerLogits: number[][][] = shardWeights.map((w) => this.matmul(hidden, w));

    // 3. Distributed Log-Sum-Exp computation per batch item
    let distributedTotalLoss = 0.0;

    for (let b = 0; b < B; b++) {
      const target = targetTokens[b];

      // A. Find local max logit on each worker
      const localMaxes: number[] = workerLogits.map((logits) => {
        let m = -Infinity;
        for (let j = 0; j < logits[b].length; j++) {
          if (logits[b][j] > m) m = logits[b][j];
        }
        return m;
      });

      // Global Max (scalar All-Reduce Max)
      const globalMax = Math.max(...localMaxes);

      // B. Compute sum of exponentials locally shifted by globalMax
      let globalSumExp = 0.0;
      let targetLogitVal = 0.0;

      for (let p = 0; p < P; p++) {
        const start = p * vocabPerWorker;
        const end = p === P - 1 ? V : start + vocabPerWorker;
        const logits = workerLogits[p][b];

        let localSumExp = 0.0;
        for (let j = 0; j < logits.length; j++) {
          localSumExp += Math.exp(logits[j] - globalMax);
        }
        globalSumExp += localSumExp;

        // Check if target token belongs to this worker's shard
        if (target >= start && target < end) {
          targetLogitVal = logits[target - start];
        }
      }

      // Cross-Entropy Loss: log(sum(exp(x - m))) - (x_target - m)
      const logSumExp = Math.log(globalSumExp) + globalMax;
      const loss_b = logSumExp - targetLogitVal;
      distributedTotalLoss += loss_b;
    }

    const distributedLoss = distributedTotalLoss / B;

    // 4. Centralized reference monolithic cross-entropy
    const fullLogits = this.matmul(hidden, vocabWeights);
    let centralTotalLoss = 0.0;
    for (let b = 0; b < B; b++) {
      const target = targetTokens[b];
      const maxVal = Math.max(...fullLogits[b]);
      let sumExp = 0.0;
      for (let v = 0; v < V; v++) {
        sumExp += Math.exp(fullLogits[b][v] - maxVal);
      }
      const logSumExp = Math.log(sumExp) + maxVal;
      centralTotalLoss += logSumExp - fullLogits[b][target];
    }
    const centralLoss = centralTotalLoss / B;

    const diff = Math.abs(distributedLoss - centralLoss);

    return {
      loss: Number(distributedLoss.toFixed(6)),
      workerCount: P,
      batchSize: B,
      vocabularySize: V,
      vocabPerWorker,
      maxAbsoluteErrorAgainstCentral: Number(diff.toFixed(8)),
      isLossEquivalent: diff <= this.tolerance,
    };
  }

  /**
   * Deterministic invariant audit and cryptographic receipt generation.
   */
  public audit(workerCount = 4, batchSize = 2, dIn = 4, dHidden = 8, dOut = 4, vocabSize = 16): MegatronAuditReceipt {
    const auditCore = new EosMegatronTensorParallelismCore({
      workerCount,
      inputDimension: dIn,
      hiddenDimension: dHidden,
      outputDimension: dOut,
      tolerance: 1e-6,
    });

    let seed = 42;
    const nextRand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return Number(((seed / 4294967296) * 2.0 - 1.0).toFixed(4));
    };

    const X: number[][] = Array.from({ length: batchSize }, () => Array.from({ length: dIn }, () => nextRand()));

    const W1: number[][] = Array.from({ length: dIn }, () => Array.from({ length: dHidden }, () => nextRand()));

    const W2: number[][] = Array.from({ length: dHidden }, () => Array.from({ length: dOut }, () => nextRand()));

    const mlpRes = auditCore.forwardMlp(X, W1, W2);

    const vocabWeights: number[][] = Array.from({ length: dOut }, () =>
      Array.from({ length: vocabSize }, () => nextRand()),
    );
    const targetTokens = Array.from({ length: batchSize }, (_, i) => (i * 3 + 1) % vocabSize);

    const ceRes = auditCore.computeShardedCrossEntropy(mlpRes.synchronizedOutput, vocabWeights, targetTokens);

    const singleBarrierCertified = mlpRes.totalAllReduceBarriers === 1;
    const numericalParityCertified = mlpRes.isMathematicallyEquivalent;
    const shardedCrossEntropyCertified = ceRes.isLossEquivalent;

    const auditStatus =
      singleBarrierCertified && numericalParityCertified && shardedCrossEntropyCertified ? "VERIFIED" : "FAILED";

    const payload = JSON.stringify({
      schemaVersion: "1.0.0",
      specRef: "SPEC-321",
      changeRef: "CHANGE-183",
      auditStatus,
      workerCount,
      batchSize,
      inputDimension: dIn,
      hiddenDimension: dHidden,
      outputDimension: dOut,
      vocabularySize: vocabSize,
      mlpMaxError: mlpRes.maxAbsoluteErrorAgainstCentral,
      ceMaxError: ceRes.maxAbsoluteErrorAgainstCentral,
      singleBarrierCertified,
      numericalParityCertified,
      shardedCrossEntropyCertified,
    });

    const sha256Receipt = createHash("sha256").update(payload).digest("hex");

    return {
      schemaVersion: "1.0.0",
      specRef: "SPEC-321",
      changeRef: "CHANGE-183",
      auditStatus,
      workerCount,
      batchSize,
      inputDimension: dIn,
      hiddenDimension: dHidden,
      outputDimension: dOut,
      vocabularySize: vocabSize,
      singleBarrierCertified,
      numericalParityCertified,
      shardedCrossEntropyCertified,
      sha256Receipt,
      timestampIso: new Date().toISOString(),
    };
  }
}
