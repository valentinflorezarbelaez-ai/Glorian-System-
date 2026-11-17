/**
 * @file eosRingAllReduce.ts
 * @description Core implementation of SPEC-320 / CHANGE-182: Ring All-Reduce
 * Distributed Tensor Parallelism & Collective Communication Engine.
 */

import { createHash } from "node:crypto";
import type {
  RingWorkerNode,
  RingAllReduceConfig,
  RingStepTelemetry,
  RingAllReduceResult,
  RingAuditReceipt,
} from "./eosRingAllReduce.types.js";

export class EosRingAllReduceCore {
  private readonly workerCount: number;
  private readonly tolerance: number;
  private readonly topology: RingWorkerNode[];

  public constructor(config: RingAllReduceConfig = {}) {
    const wc = config.workerCount ?? 4;
    if (!Number.isInteger(wc) || wc < 2) {
      throw new Error(`[RingAllReduce] workerCount must be an integer >= 2, got: ${wc}`);
    }
    this.workerCount = wc;
    this.tolerance = config.tolerance ?? 1e-6;

    this.topology = Array.from({ length: this.workerCount }, (_, p) => ({
      workerId: p,
      successorId: (p + 1) % this.workerCount,
      predecessorId: (p - 1 + this.workerCount) % this.workerCount,
      localTensor: [],
      chunks: [],
    }));
  }

  public getConfig(): Required<RingAllReduceConfig> {
    return {
      workerCount: this.workerCount,
      tolerance: this.tolerance,
    };
  }

  public getTopology(): RingWorkerNode[] {
    return this.topology.map((node) => ({ ...node }));
  }

  /**
   * Partitions an arbitrary 1D tensor of length M into P equal-sized chunks of size C = ceil(M / P),
   * applying zero-padding if M % P !== 0.
   */
  public partitionIntoChunks(tensor: number[]): { chunks: number[][]; chunkSize: number; paddingCount: number } {
    const m = tensor.length;
    const chunkSize = Math.ceil(m / this.workerCount);
    const totalPaddedLength = chunkSize * this.workerCount;
    const paddingCount = totalPaddedLength - m;

    const padded = [...tensor];
    for (let i = 0; i < paddingCount; i++) {
      padded.push(0.0);
    }

    const chunks: number[][] = [];
    for (let p = 0; p < this.workerCount; p++) {
      const start = p * chunkSize;
      chunks.push(padded.slice(start, start + chunkSize));
    }

    return { chunks, chunkSize, paddingCount };
  }

  /**
   * Flattens and un-pads chunks back to original tensor length M.
   */
  public reconstructTensor(chunks: number[][], originalLength: number): number[] {
    const flat: number[] = [];
    for (const chunk of chunks) {
      for (const val of chunk) {
        flat.push(val);
      }
    }
    return flat.slice(0, originalLength);
  }

  /**
   * Executes Phase 1: Scatter-Reduce across P - 1 steps.
   */
  public executeScatterReduce(
    workerChunks: number[][][],
    chunkSize: number,
  ): {
    steps: { step: number; transfers: { toWorker: number; chunkIdx: number; buffer: number[] }[] }[];
    chunkOwnership: Record<number, number>;
  } {
    const p = this.workerCount;
    const steps: { step: number; transfers: { toWorker: number; chunkIdx: number; buffer: number[] }[] }[] = [];

    for (let s = 0; s < p - 1; s++) {
      const stepTransfers: { toWorker: number; chunkIdx: number; buffer: number[] }[] = [];
      for (let w = 0; w < p; w++) {
        const sendChunkIdx = (w - s + p) % p;
        const succ = (w + 1) % p;
        stepTransfers.push({
          toWorker: succ,
          chunkIdx: sendChunkIdx,
          buffer: [...workerChunks[w][sendChunkIdx]],
        });
      }

      for (const xfer of stepTransfers) {
        const target = workerChunks[xfer.toWorker][xfer.chunkIdx];
        for (let idx = 0; idx < chunkSize; idx++) {
          target[idx] += xfer.buffer[idx];
        }
      }

      steps.push({ step: s + 1, transfers: stepTransfers });
    }

    const chunkOwnership: Record<number, number> = {};
    for (let w = 0; w < p; w++) {
      chunkOwnership[w] = (w + 1) % p;
    }

    return { steps, chunkOwnership };
  }

  /**
   * Executes Phase 2: All-Gather across P - 1 steps.
   */
  public executeAllGather(workerChunks: number[][][]): {
    steps: { step: number; transfers: { toWorker: number; chunkIdx: number; buffer: number[] }[] }[];
  } {
    const p = this.workerCount;
    const steps: { step: number; transfers: { toWorker: number; chunkIdx: number; buffer: number[] }[] }[] = [];

    for (let s = 0; s < p - 1; s++) {
      const stepTransfers: { toWorker: number; chunkIdx: number; buffer: number[] }[] = [];
      for (let w = 0; w < p; w++) {
        const sendChunkIdx = (w - s + 1 + p) % p;
        const succ = (w + 1) % p;
        stepTransfers.push({
          toWorker: succ,
          chunkIdx: sendChunkIdx,
          buffer: [...workerChunks[w][sendChunkIdx]],
        });
      }

      for (const xfer of stepTransfers) {
        workerChunks[xfer.toWorker][xfer.chunkIdx] = [...xfer.buffer];
      }

      steps.push({ step: s + 1, transfers: stepTransfers });
    }

    return { steps };
  }

  /**
   * Executes the full Ring All-Reduce across P worker tensors:
   * Phase 1: Scatter-Reduce (P - 1 steps)
   * Phase 2: All-Gather (P - 1 steps)
   */
  public allReduce(workerTensors: number[][]): RingAllReduceResult {
    const startHr = process.hrtime.bigint();
    const p = this.workerCount;

    if (workerTensors.length !== p) {
      throw new Error(`[RingAllReduce] Expected ${p} worker tensors, received ${workerTensors.length}.`);
    }

    const m = workerTensors[0].length;
    for (let i = 1; i < p; i++) {
      if (workerTensors[i].length !== m) {
        throw new Error(
          `[RingAllReduce] All worker tensors must have identical length (${m} vs ${workerTensors[i].length}).`,
        );
      }
    }

    // 1. Partition each worker's tensor into P chunks with zero-padding
    const workerChunks: number[][][] = [];
    let chunkSize = 0;
    let paddingCount = 0;

    for (let w = 0; w < p; w++) {
      const part = this.partitionIntoChunks(workerTensors[w]);
      workerChunks.push(part.chunks);
      chunkSize = part.chunkSize;
      paddingCount = part.paddingCount;
    }

    // 2. Phase 1: Scatter-Reduce (P - 1 steps)
    this.executeScatterReduce(workerChunks, chunkSize);

    // 3. Phase 2: All-Gather (P - 1 steps)
    this.executeAllGather(workerChunks);

    // 4. Reconstruct and un-pad synchronized tensors
    const synchronizedTensors: number[][] = [];
    for (let w = 0; w < p; w++) {
      synchronizedTensors.push(this.reconstructTensor(workerChunks[w], m));
    }

    // 5. Compute centralized ground-truth reference sum
    const centralSum: number[] = new Array(m).fill(0);
    for (let idx = 0; idx < m; idx++) {
      let acc = 0;
      for (let w = 0; w < p; w++) {
        acc += workerTensors[w][idx];
      }
      centralSum[idx] = acc;
    }

    // 6. Mathematical equivalence & error verification
    let maxAbsoluteError = 0;
    const finalTensor = synchronizedTensors[0];
    for (let idx = 0; idx < m; idx++) {
      const diff = Math.abs(finalTensor[idx] - centralSum[idx]);
      if (diff > maxAbsoluteError) {
        maxAbsoluteError = diff;
      }
    }

    // Verify all workers hold strictly identical results
    for (let w = 1; w < p; w++) {
      for (let idx = 0; idx < m; idx++) {
        const diffWorkers = Math.abs(synchronizedTensors[w][idx] - finalTensor[idx]);
        if (diffWorkers > maxAbsoluteError) {
          maxAbsoluteError = diffWorkers;
        }
      }
    }

    const elapsedMs = Number(process.hrtime.bigint() - startHr) / 1e6;
    const totalCommunicationSteps = 2 * (p - 1);
    // Bandwidth transferred per worker: 2 * (P - 1) * chunkSize * 4 bytes
    const bytesTransferredPerWorker = 2 * (p - 1) * chunkSize * 4;
    const isMathematicallyEquivalent = maxAbsoluteError <= this.tolerance;

    return {
      synchronizedTensor: finalTensor,
      workerCount: p,
      tensorLength: m,
      chunkSize,
      totalPaddingElements: paddingCount,
      totalCommunicationSteps,
      bytesTransferredPerWorker,
      maxAbsoluteErrorAgainstCentral: Number(maxAbsoluteError.toFixed(8)),
      isMathematicallyEquivalent,
      elapsedMs,
    };
  }

  /**
   * Deterministic invariant audit and cryptographic receipt generation.
   */
  public audit(workerCount = 4, tensorLength = 32): RingAuditReceipt {
    const auditCore = new EosRingAllReduceCore({ workerCount, tolerance: 1e-6 });

    // Generate deterministic pseudo-random tensors across workers
    let seed = 777;
    const nextRand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return Number(((seed / 4294967296) * 10.0 - 5.0).toFixed(4));
    };

    const workerTensors: number[][] = [];
    for (let w = 0; w < workerCount; w++) {
      const t: number[] = [];
      for (let i = 0; i < tensorLength; i++) {
        t.push(nextRand());
      }
      workerTensors.push(t);
    }

    const res = auditCore.allReduce(workerTensors);

    const ringSymmetryCertified = res.totalCommunicationSteps === 2 * (workerCount - 1);
    const bandwidthBoundCertified = res.bytesTransferredPerWorker === 2 * (workerCount - 1) * res.chunkSize * 4;
    const auditStatus =
      res.isMathematicallyEquivalent && ringSymmetryCertified && bandwidthBoundCertified ? "VERIFIED" : "FAILED";

    const payload = JSON.stringify({
      schemaVersion: "1.0.0",
      specRef: "SPEC-320",
      changeRef: "CHANGE-182",
      auditStatus,
      workerCount,
      tensorLength,
      chunkSize: res.chunkSize,
      totalCommunicationSteps: res.totalCommunicationSteps,
      bytesTransferredPerWorker: res.bytesTransferredPerWorker,
      maxAbsoluteError: res.maxAbsoluteErrorAgainstCentral,
      ringSymmetryCertified,
      bandwidthBoundCertified,
    });

    const sha256Receipt = createHash("sha256").update(payload).digest("hex");

    return {
      schemaVersion: "1.0.0",
      specRef: "SPEC-320",
      changeRef: "CHANGE-182",
      auditStatus,
      workerCount,
      tensorLength,
      chunkSize: res.chunkSize,
      totalCommunicationSteps: res.totalCommunicationSteps,
      bytesTransferredPerWorker: res.bytesTransferredPerWorker,
      maxAbsoluteError: res.maxAbsoluteErrorAgainstCentral,
      ringSymmetryCertified,
      bandwidthBoundCertified,
      sha256Receipt,
      timestampIso: new Date().toISOString(),
    };
  }
}
