/**
 * EOS System — Sharded Vector Indexing & SIMD-Style Quantization Governor
 * SPEC-283 (CHANGE-145) — Vector Embeddings Compression & k-NN Retrieval
 * Pure Layer-0 TypeScript (dependencies: {})
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export interface QuantizedVector {
  id: string;
  partition: string;
  quantizedValues: number[];
  scale: number;
  offset: number;
  dimension: number;
  metadata?: Record<string, unknown>;
}

export interface VectorIndexSnapshot {
  indexId: string;
  dimension: number;
  totalVectors: number;
  shards: Record<string, QuantizedVector[]>;
  createdAt: string;
}

export interface VectorSearchResult {
  id: string;
  partition: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorIndexReceipt {
  indexId: string;
  totalVectors: number;
  dimension: number;
  shardsCount: number;
  compressionRatio: string;
  sha256Signature: string;
}

export class EosVectorQuantizationGovernor {
  /**
   * Compresses continuous FP32 floats into 8-bit unsigned integers [0..255].
   */
  public static quantizeSQ8(values: number[]): {
    quantized: number[];
    scale: number;
    offset: number;
  } {
    if (!values || values.length === 0) {
      throw new Error("Cannot quantize empty vector.");
    }

    let min = values[0];
    let max = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] < min) min = values[i];
      if (values[i] > max) max = values[i];
    }

    const range = max - min;
    const scale = range === 0 ? 1.0 : range / 255.0;
    const offset = min;

    const quantized = new Array<number>(values.length);
    for (let i = 0; i < values.length; i++) {
      const q = Math.round((values[i] - offset) / scale);
      quantized[i] = Math.max(0, Math.min(255, q));
    }

    return { quantized, scale, offset };
  }

  /**
   * Dequantizes 8-bit integer values back to FP32 approximation.
   */
  public static dequantizeSQ8(quantized: number[], scale: number, offset: number): number[] {
    const values = new Array<number>(quantized.length);
    for (let i = 0; i < quantized.length; i++) {
      values[i] = quantized[i] * scale + offset;
    }
    return values;
  }

  /**
   * Computes unrolled inner product (step of 4) for high throughput.
   */
  public static dotProduct(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    let i = 0;
    const limit = len - 3;

    while (i < limit) {
      dot += a[i] * b[i] + a[i + 1] * b[i + 1] + a[i + 2] * b[i + 2] + a[i + 3] * b[i + 3];
      i += 4;
    }
    while (i < len) {
      dot += a[i] * b[i];
      i++;
    }

    return dot;
  }

  /**
   * Computes normalized cosine similarity in range [-1.0, 1.0].
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    const dot = this.dotProduct(a, b);
    const normA = Math.sqrt(this.dotProduct(a, a));
    const normB = Math.sqrt(this.dotProduct(b, b));

    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  }

  /**
   * Evaluates similarity directly between FP32 query and SQ8 target vector.
   */
  public static cosineSimilarityQuantized(queryFp32: number[], target: QuantizedVector): number {
    const dequantized = this.dequantizeSQ8(target.quantizedValues, target.scale, target.offset);
    return this.cosineSimilarity(queryFp32, dequantized);
  }

  /**
   * Builds a sharded vector index with SQ8 quantization.
   */
  public static buildIndex(
    vectors: Array<{
      id: string;
      partition?: string;
      values: number[];
      metadata?: Record<string, unknown>;
    }>,
    indexId = `vec-idx-${Date.now()}`,
  ): VectorIndexSnapshot {
    if (!Array.isArray(vectors) || vectors.length === 0) {
      throw new Error("Cannot build vector index from empty array.");
    }

    const dimension = vectors[0].values.length;
    const shards: Record<string, QuantizedVector[]> = {};

    for (const item of vectors) {
      if (item.values.length !== dimension) {
        throw new Error(
          `Inconsistent vector dimension: expected ${dimension}, got ${item.values.length} on id ${item.id}`,
        );
      }

      const partition = item.partition || "default";
      if (!shards[partition]) {
        shards[partition] = [];
      }

      const { quantized, scale, offset } = this.quantizeSQ8(item.values);
      shards[partition].push({
        id: item.id,
        partition,
        quantizedValues: quantized,
        scale,
        offset,
        dimension,
        metadata: item.metadata,
      });
    }

    return {
      indexId,
      dimension,
      totalVectors: vectors.length,
      shards,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Executes Top-K nearest neighbor search with optional partition routing.
   */
  public static searchKnn(
    index: VectorIndexSnapshot,
    queryValues: number[],
    topK = 5,
    partitionFilter?: string,
  ): VectorSearchResult[] {
    const candidates: VectorSearchResult[] = [];

    const targetPartitions =
      partitionFilter && index.shards[partitionFilter] ? [partitionFilter] : Object.keys(index.shards);

    for (const part of targetPartitions) {
      const shardVectors = index.shards[part] || [];
      for (const vec of shardVectors) {
        const score = this.cosineSimilarityQuantized(queryValues, vec);
        candidates.push({
          id: vec.id,
          partition: vec.partition,
          score: Math.round(score * 10000) / 10000,
          metadata: vec.metadata,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, topK);
  }

  /**
   * Emits verifiable cryptographic evidence receipt.
   */
  public static generateReceipt(index: VectorIndexSnapshot, outputPath?: string): VectorIndexReceipt {
    const shardsCount = Object.keys(index.shards).length;
    const receiptData = {
      indexId: index.indexId,
      totalVectors: index.totalVectors,
      dimension: index.dimension,
      shardsCount,
      compressionRatio: "4.0x (32-bit FP32 -> 8-bit SQ8)",
      createdAt: index.createdAt,
    };

    const signature = crypto.createHash("sha256").update(JSON.stringify(receiptData)).digest("hex");

    const receipt: VectorIndexReceipt = {
      indexId: index.indexId,
      totalVectors: index.totalVectors,
      dimension: index.dimension,
      shardsCount,
      compressionRatio: "4.0x (32-bit FP32 -> 8-bit SQ8)",
      sha256Signature: signature,
    };

    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, JSON.stringify(receipt, null, 2), "utf8");
    }

    return receipt;
  }
}
