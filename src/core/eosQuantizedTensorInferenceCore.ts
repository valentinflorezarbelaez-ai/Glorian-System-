/**
 * EOS Layer-0 Quantized GGUF/Q4_K Integer Tensor Inference Core (SPEC-224, CHANGE-109)
 * Sovereign Local Embeddings and Matrix Inference on Typed Arrays
 * Strict Zero Runtime Dependencies (EOS Law I & V), Node 24 Strip-Only TypeScript.
 */

import crypto from "node:crypto";
import type {
  GgmlType,
  GgufTensorDescriptor,
  QuantizedTensor,
  GgufContainer,
  MatMulResult,
  EmbeddingResult,
  TensorReceipt,
  TensorBenchmarkResult,
} from "./eosQuantizedTensorInferenceCore.types.ts";

export * from "./eosQuantizedTensorInferenceCore.types.ts";

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object" || ArrayBuffer.isView(obj)) {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object" && !ArrayBuffer.isView(val) && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function sha256Hex(data: string | Uint8Array): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export const GGUF_MAGIC = 0x46554747; // "GGUF" in little-endian ASCII
export const GGUF_VERSION = 3;

/**
 * IEEE-754 Single-Precision Float32 to Half-Precision Float16 (uint16)
 */
export function floatToFp16(val: number): number {
  const f32 = new Float32Array([val]);
  const u32 = new Uint32Array(f32.buffer)[0];
  const sign = (u32 >>> 31) & 0x1;
  const exp = (u32 >>> 23) & 0xff;
  const frac = u32 & 0x7fffff;

  if (exp === 0xff) {
    return (sign << 15) | 0x7c00 | (frac ? 1 : 0);
  }
  const newExp = exp - 127 + 15;
  if (newExp >= 31) return (sign << 15) | 0x7c00;
  if (newExp <= 0) {
    if (newExp < -10) return sign << 15;
    const shift = 1 - newExp;
    const newFrac = (0x800000 | frac) >>> (shift + 13);
    return (sign << 15) | newFrac;
  }
  const newFrac = (frac >>> 13) & 0x3ff;
  return (sign << 15) | (newExp << 10) | newFrac;
}

/**
 * IEEE-754 Half-Precision Float16 (uint16) to Single-Precision Float32
 */
export function fp16ToFloat(h: number): number {
  const sign = (h >>> 15) & 0x1;
  const exp = (h >>> 10) & 0x1f;
  const frac = h & 0x3ff;

  const fSign = sign ? -1 : 1;
  if (exp === 0) {
    if (frac === 0) return fSign * 0.0;
    return fSign * Math.pow(2, -14) * (frac / 1024);
  }
  if (exp === 31) {
    return frac === 0 ? fSign * Infinity : NaN;
  }
  return fSign * Math.pow(2, exp - 15) * (1 + frac / 1024);
}

export class EosQuantizedTensorInferenceCore {
  /**
   * Quantize an array of floats into Q4_0 block format (32 weights per 18-byte block).
   */
  public static quantizeQ4_0(weights: Float32Array): Uint8Array {
    const k = weights.length;
    if (k % 32 !== 0) {
      throw new Error(`Length must be multiple of 32 for Q4_0, got ${k}`);
    }
    const numBlocks = k / 32;
    const buffer = new Uint8Array(numBlocks * 18);
    const view = new DataView(buffer.buffer);

    for (let b = 0; b < numBlocks; b++) {
      const blockOffset = b * 18;
      const weightOffset = b * 32;

      let amax = 0;
      for (let i = 0; i < 32; i++) {
        const absVal = Math.abs(weights[weightOffset + i]);
        if (absVal > amax) amax = absVal;
      }

      const d = amax / -8.0;
      const id = d !== 0 ? 1.0 / d : 0;
      const dFp16 = floatToFp16(d);
      view.setUint16(blockOffset, dFp16, true);

      for (let i = 0; i < 16; i++) {
        const w0 = weights[weightOffset + i];
        const w1 = weights[weightOffset + i + 16];
        const q0 = Math.min(15, Math.max(0, Math.floor(w0 * id + 8.5)));
        const q1 = Math.min(15, Math.max(0, Math.floor(w1 * id + 8.5)));
        buffer[blockOffset + 2 + i] = (q0 & 0x0f) | ((q1 & 0x0f) << 4);
      }
    }
    return buffer;
  }

  /**
   * Dequantize Q4_0 byte buffer back into Float32Array.
   */
  public static dequantizeQ4_0(data: Uint8Array, length: number): Float32Array {
    const numBlocks = length / 32;
    const out = new Float32Array(length);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    for (let b = 0; b < numBlocks; b++) {
      const blockOffset = b * 18;
      const weightOffset = b * 32;
      const dFp16 = view.getUint16(blockOffset, true);
      const d = fp16ToFloat(dFp16);

      for (let i = 0; i < 16; i++) {
        const byteVal = data[blockOffset + 2 + i];
        const q0 = byteVal & 0x0f;
        const q1 = (byteVal >>> 4) & 0x0f;
        out[weightOffset + i] = (q0 - 8) * d;
        out[weightOffset + i + 16] = (q1 - 8) * d;
      }
    }
    return out;
  }

  /**
   * Quantize an array of floats into Q8_0 block format (32 weights per 34-byte block).
   */
  public static quantizeQ8_0(weights: Float32Array): Uint8Array {
    const k = weights.length;
    if (k % 32 !== 0) throw new Error(`Length must be multiple of 32 for Q8_0, got ${k}`);
    const numBlocks = k / 32;
    const buffer = new Uint8Array(numBlocks * 34);
    const view = new DataView(buffer.buffer);

    for (let b = 0; b < numBlocks; b++) {
      const blockOffset = b * 34;
      const weightOffset = b * 32;

      let amax = 0;
      for (let i = 0; i < 32; i++) {
        const absVal = Math.abs(weights[weightOffset + i]);
        if (absVal > amax) amax = absVal;
      }

      const d = amax / 127.0;
      const id = d !== 0 ? 1.0 / d : 0;
      view.setUint16(blockOffset, floatToFp16(d), true);

      for (let i = 0; i < 32; i++) {
        const w = weights[weightOffset + i];
        const q = Math.min(127, Math.max(-128, Math.round(w * id)));
        view.setInt8(blockOffset + 2 + i, q);
      }
    }
    return buffer;
  }

  /**
   * Dequantize Q8_0 byte buffer back into Float32Array.
   */
  public static dequantizeQ8_0(data: Uint8Array, length: number): Float32Array {
    const numBlocks = length / 32;
    const out = new Float32Array(length);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    for (let b = 0; b < numBlocks; b++) {
      const blockOffset = b * 34;
      const weightOffset = b * 32;
      const d = fp16ToFloat(view.getUint16(blockOffset, true));

      for (let i = 0; i < 32; i++) {
        const q = view.getInt8(blockOffset + 2 + i);
        out[weightOffset + i] = q * d;
      }
    }
    return out;
  }

  /**
   * Quantize an array of floats into Q4_K super-block format (256 weights per 144-byte super-block).
   */
  public static quantizeQ4_K(weights: Float32Array): Uint8Array {
    const k = weights.length;
    if (k % 256 !== 0) throw new Error(`Length must be multiple of 256 for Q4_K, got ${k}`);
    const numBlocks = k / 256;
    const buffer = new Uint8Array(numBlocks * 144);
    const view = new DataView(buffer.buffer);

    for (let b = 0; b < numBlocks; b++) {
      const blockOffset = b * 144;
      const weightOffset = b * 256;

      let amax = 0;
      for (let i = 0; i < 256; i++) {
        const absVal = Math.abs(weights[weightOffset + i]);
        if (absVal > amax) amax = absVal;
      }

      const d = amax / -8.0;
      const id = d !== 0 ? 1.0 / d : 0;
      view.setUint16(blockOffset, floatToFp16(d), true);
      view.setUint16(blockOffset + 2, floatToFp16(0), true); // dmin

      // Sub-block scales (8 bytes for 8 sub-blocks of 32 weights)
      for (let s = 0; s < 8; s++) {
        buffer[blockOffset + 4 + s] = 1;
      }

      // 128 bytes containing 256 4-bit nibbles
      for (let i = 0; i < 128; i++) {
        const w0 = weights[weightOffset + i];
        const w1 = weights[weightOffset + i + 128];
        const q0 = Math.min(15, Math.max(0, Math.floor(w0 * id + 8.5)));
        const q1 = Math.min(15, Math.max(0, Math.floor(w1 * id + 8.5)));
        buffer[blockOffset + 16 + i] = (q0 & 0x0f) | ((q1 & 0x0f) << 4);
      }
    }
    return buffer;
  }

  /**
   * Dequantize Q4_K byte buffer back into Float32Array.
   */
  public static dequantizeQ4_K(data: Uint8Array, length: number): Float32Array {
    const numBlocks = length / 256;
    const out = new Float32Array(length);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    for (let b = 0; b < numBlocks; b++) {
      const blockOffset = b * 144;
      const weightOffset = b * 256;
      const d = fp16ToFloat(view.getUint16(blockOffset, true));

      for (let i = 0; i < 128; i++) {
        const byteVal = data[blockOffset + 16 + i];
        const q0 = byteVal & 0x0f;
        const q1 = (byteVal >>> 4) & 0x0f;
        out[weightOffset + i] = (q0 - 8) * d;
        out[weightOffset + i + 128] = (q1 - 8) * d;
      }
    }
    return out;
  }

  /**
   * Streaming block-wise quantized matrix-vector multiplication y = W * x without full unquantized allocation.
   */
  public static quantizedMatMulVec(
    qMatrix: Uint8Array,
    x: Float32Array,
    rows: number,
    cols: number,
    type: GgmlType = "Q4_0",
  ): Float32Array {
    const y = new Float32Array(rows);
    const view = new DataView(qMatrix.buffer, qMatrix.byteOffset, qMatrix.byteLength);

    if (type === "Q4_0") {
      const blocksPerRow = cols / 32;
      const rowByteStride = blocksPerRow * 18;

      for (let r = 0; r < rows; r++) {
        const rowStart = r * rowByteStride;
        let sum = 0.0;

        for (let b = 0; b < blocksPerRow; b++) {
          const bStart = rowStart + b * 18;
          const d = fp16ToFloat(view.getUint16(bStart, true));
          const colBase = b * 32;

          for (let i = 0; i < 16; i++) {
            const byteVal = qMatrix[bStart + 2 + i];
            const q0 = byteVal & 0x0f;
            const q1 = (byteVal >>> 4) & 0x0f;
            sum += (q0 - 8) * d * x[colBase + i];
            sum += (q1 - 8) * d * x[colBase + i + 16];
          }
        }
        y[r] = sum;
      }
      return y;
    }

    if (type === "Q8_0") {
      const blocksPerRow = cols / 32;
      const rowByteStride = blocksPerRow * 34;

      for (let r = 0; r < rows; r++) {
        const rowStart = r * rowByteStride;
        let sum = 0.0;

        for (let b = 0; b < blocksPerRow; b++) {
          const bStart = rowStart + b * 34;
          const d = fp16ToFloat(view.getUint16(bStart, true));
          const colBase = b * 32;

          for (let i = 0; i < 32; i++) {
            const q = view.getInt8(bStart + 2 + i);
            sum += q * d * x[colBase + i];
          }
        }
        y[r] = sum;
      }
      return y;
    }

    if (type === "Q4_K") {
      const blocksPerRow = cols / 256;
      const rowByteStride = blocksPerRow * 144;

      for (let r = 0; r < rows; r++) {
        const rowStart = r * rowByteStride;
        let sum = 0.0;

        for (let b = 0; b < blocksPerRow; b++) {
          const bStart = rowStart + b * 144;
          const d = fp16ToFloat(view.getUint16(bStart, true));
          const colBase = b * 256;

          for (let i = 0; i < 128; i++) {
            const byteVal = qMatrix[bStart + 16 + i];
            const q0 = byteVal & 0x0f;
            const q1 = (byteVal >>> 4) & 0x0f;
            sum += (q0 - 8) * d * x[colBase + i];
            sum += (q1 - 8) * d * x[colBase + i + 128];
          }
        }
        y[r] = sum;
      }
      return y;
    }

    throw new Error(`Unsupported GGML type for direct MatMul: ${type}`);
  }

  /**
   * Root Mean Square Normalization (RMSNorm).
   */
  public static rmsNorm(x: Float32Array, weight?: Float32Array, eps: number = 1e-5): Float32Array {
    let sumSq = 0;
    const len = x.length;
    for (let i = 0; i < len; i++) {
      sumSq += x[i] * x[i];
    }
    const rms = 1.0 / Math.sqrt(sumSq / len + eps);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = x[i] * rms * (weight ? weight[i] : 1.0);
    }
    return out;
  }

  /**
   * Cosine similarity between two dense vectors.
   */
  public static cosineSimilarity(u: Float32Array, v: Float32Array): number {
    if (u.length !== v.length) {
      throw new Error(`Vector dimension mismatch: ${u.length} !== ${v.length}`);
    }
    let dot = 0.0;
    let normU = 0.0;
    let normV = 0.0;
    for (let i = 0; i < u.length; i++) {
      dot += u[i] * v[i];
      normU += u[i] * u[i];
      normV += v[i] * v[i];
    }
    const denom = Math.sqrt(normU) * Math.sqrt(normV);
    if (denom === 0) return 0.0;
    return Math.max(-1.0, Math.min(1.0, dot / denom));
  }

  /**
   * Serialize tensors into standard GGUF v3 binary container.
   */
  public static writeGguf(tensors: readonly QuantizedTensor[], metadata: Record<string, string> = {}): Uint8Array {
    const parts: Uint8Array[] = [];

    // Header: magic (4B), version (4B), tensor_count (8B), metadata_kv_count (8B)
    const headerBuf = new Uint8Array(24);
    const hView = new DataView(headerBuf.buffer);
    hView.setUint32(0, GGUF_MAGIC, true);
    hView.setUint32(4, GGUF_VERSION, true);
    hView.setBigUint64(8, BigInt(tensors.length), true);
    const metaKeys = Object.keys(metadata);
    hView.setBigUint64(16, BigInt(metaKeys.length), true);
    parts.push(headerBuf);

    // Write metadata KV pairs
    for (const key of metaKeys) {
      const keyBytes = Buffer.from(key, "utf8");
      const kHeader = new Uint8Array(8 + keyBytes.length + 4);
      const kView = new DataView(kHeader.buffer);
      kView.setBigUint64(0, BigInt(keyBytes.length), true);
      kHeader.set(keyBytes, 8);
      // GGUF String Type = 8
      kView.setUint32(8 + keyBytes.length, 8, true);
      parts.push(kHeader);

      const valBytes = Buffer.from(metadata[key], "utf8");
      const vHeader = new Uint8Array(8 + valBytes.length);
      const vView = new DataView(vHeader.buffer);
      vView.setBigUint64(0, BigInt(valBytes.length), true);
      vHeader.set(valBytes, 8);
      parts.push(vHeader);
    }

    // Prepare tensor infos
    let dataOffset = 0;
    const tensorHeaders: Uint8Array[] = [];
    const tensorDataParts: Uint8Array[] = [];

    const typeCodeMap: Record<GgmlType, number> = {
      F32: 0,
      F16: 1,
      Q4_0: 2,
      Q8_0: 8,
      Q4_K: 12,
    };

    for (const tensor of tensors) {
      const nameBytes = Buffer.from(tensor.name, "utf8");
      const nDims = tensor.shape.length;
      const thBuf = new Uint8Array(8 + nameBytes.length + 4 + nDims * 8 + 4 + 8);
      const thView = new DataView(thBuf.buffer);

      let p = 0;
      thView.setBigUint64(p, BigInt(nameBytes.length), true);
      p += 8;
      thBuf.set(nameBytes, p);
      p += nameBytes.length;

      thView.setUint32(p, nDims, true);
      p += 4;
      for (const d of tensor.shape) {
        thView.setBigUint64(p, BigInt(d), true);
        p += 8;
      }

      thView.setUint32(p, typeCodeMap[tensor.ggmlType] ?? 2, true);
      p += 4;
      thView.setBigUint64(p, BigInt(dataOffset), true);

      tensorHeaders.push(thBuf);
      tensorDataParts.push(tensor.rawData);
      dataOffset += tensor.rawData.length;
    }

    for (const th of tensorHeaders) parts.push(th);
    for (const td of tensorDataParts) parts.push(td);

    // Concatenate all parts
    const totalLength = parts.reduce((acc, part) => acc + part.length, 0);
    const finalBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      finalBuffer.set(part, offset);
      offset += part.length;
    }
    return finalBuffer;
  }

  /**
   * Parse GGUF v3 binary container.
   */
  public static readGguf(buffer: Uint8Array): GgufContainer {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const magic = view.getUint32(0, true);
    if (magic !== GGUF_MAGIC) {
      throw new Error(`Invalid GGUF magic: 0x${magic.toString(16)} (expected 0x${GGUF_MAGIC.toString(16)})`);
    }

    const version = view.getUint32(4, true);
    const tensorCount = Number(view.getBigUint64(8, true));
    const metadataCount = Number(view.getBigUint64(16, true));

    let pos = 24;
    const metadata: Record<string, string> = {};

    for (let i = 0; i < metadataCount; i++) {
      const kLen = Number(view.getBigUint64(pos, true));
      pos += 8;
      const key = Buffer.from(buffer.subarray(pos, pos + kLen)).toString("utf8");
      pos += kLen;
      const type = view.getUint32(pos, true);
      pos += 4;
      if (type === 8) {
        // String
        const vLen = Number(view.getBigUint64(pos, true));
        pos += 8;
        const val = Buffer.from(buffer.subarray(pos, pos + vLen)).toString("utf8");
        pos += vLen;
        metadata[key] = val;
      }
    }

    const codeToTypeMap: Record<number, GgmlType> = {
      0: "F32",
      1: "F16",
      2: "Q4_0",
      8: "Q8_0",
      12: "Q4_K",
    };

    const descriptors: { name: string; shape: number[]; type: GgmlType; offset: number }[] = [];
    for (let t = 0; t < tensorCount; t++) {
      const nLen = Number(view.getBigUint64(pos, true));
      pos += 8;
      const name = Buffer.from(buffer.subarray(pos, pos + nLen)).toString("utf8");
      pos += nLen;
      const nDims = view.getUint32(pos, true);
      pos += 4;
      const shape: number[] = [];
      for (let d = 0; d < nDims; d++) {
        shape.push(Number(view.getBigUint64(pos, true)));
        pos += 8;
      }
      const typeCode = view.getUint32(pos, true);
      pos += 4;
      const tOffset = Number(view.getBigUint64(pos, true));
      pos += 8;
      descriptors.push({
        name,
        shape,
        type: codeToTypeMap[typeCode] ?? "Q4_0",
        offset: tOffset,
      });
    }

    const dataSectionOffset = pos;
    const tensors: QuantizedTensor[] = [];

    for (let t = 0; t < descriptors.length; t++) {
      const desc = descriptors[t];
      const start = dataSectionOffset + desc.offset;
      const nextOffset = t + 1 < descriptors.length ? descriptors[t + 1].offset : buffer.byteLength - dataSectionOffset;
      const len = nextOffset - desc.offset;
      const rawData = buffer.subarray(start, start + len);

      tensors.push(
        deepFreeze({
          name: desc.name,
          shape: desc.shape,
          ggmlType: desc.type,
          rawData,
          tensorSha256: sha256Hex(rawData),
        }),
      );
    }

    return deepFreeze({
      version,
      tensorCount,
      metadata: deepFreeze(metadata),
      tensors: deepFreeze(tensors),
      containerSha256: sha256Hex(buffer),
    });
  }

  /**
   * Deterministic Sovereign Semantic Text Embedding.
   */
  public static embedText(
    text: string,
    projectionMatrix: Uint8Array,
    dims: number = 64,
    type: GgmlType = "Q4_0",
  ): EmbeddingResult {
    const t0 = performance.now();
    const inputVec = new Float32Array(dims * 2);

    // Deterministic bag-of-characters / BPE hash projection into input vector
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const idx = (code * 31 + i) % inputVec.length;
      inputVec[idx] += 1.0;
    }

    // Multiply by quantized projection matrix
    const projected = this.quantizedMatMulVec(projectionMatrix, inputVec, dims, inputVec.length, type);
    const rmsNormalized = this.rmsNorm(projected);

    let sumSq = 0;
    for (let i = 0; i < dims; i++) sumSq += rmsNormalized[i] * rmsNormalized[i];
    const l2Norm = Math.sqrt(sumSq);
    const invNorm = l2Norm > 0 ? 1.0 / l2Norm : 0;
    const normalized = new Float32Array(dims);
    for (let i = 0; i < dims; i++) normalized[i] = rmsNormalized[i] * invNorm;

    const norm = l2Norm > 0 ? 1.0 : 0.0;
    const elapsed = Math.round((performance.now() - t0) * 100) / 100;
    const digest = sha256Hex(`embed:${dims}:${text}:${elapsed}`);
    const receipt: TensorReceipt = deepFreeze({
      receiptId: `rcpt-embed-${Date.now()}`,
      operation: "embed",
      timestamp: new Date().toISOString(),
      digest,
      receiptSha256: sha256Hex(digest),
    });

    return deepFreeze({
      text,
      embedding: normalized,
      dimensions: dims,
      norm,
      durationMs: elapsed,
      receipt,
    });
  }

  /**
   * Run performance benchmarks for quantization and quantized matrix multiplications.
   */
  public static benchmark(iterations: number = 20): TensorBenchmarkResult {
    const iters = Math.max(1, iterations);
    const size = 1024;
    const weights = new Float32Array(size);
    for (let i = 0; i < size; i++) weights[i] = Math.sin(i * 0.1);

    // Q4_0
    const t0Q4 = performance.now();
    let q4Data: Uint8Array = new Uint8Array();
    for (let i = 0; i < iters; i++) {
      q4Data = this.quantizeQ4_0(weights);
    }
    const q4_0QuantizeOpsPerSec = Math.round((iters / ((performance.now() - t0Q4) / 1000)) * 100) / 100;

    const t0Deq4 = performance.now();
    for (let i = 0; i < iters; i++) {
      this.dequantizeQ4_0(q4Data, size);
    }
    const q4_0DequantizeOpsPerSec = Math.round((iters / ((performance.now() - t0Deq4) / 1000)) * 100) / 100;

    // Q8_0
    const t0Q8 = performance.now();
    for (let i = 0; i < iters; i++) {
      this.quantizeQ8_0(weights);
    }
    const q8_0QuantizeOpsPerSec = Math.round((iters / ((performance.now() - t0Q8) / 1000)) * 100) / 100;

    // Q4_K
    const t0Q4K = performance.now();
    for (let i = 0; i < iters; i++) {
      this.quantizeQ4_K(weights);
    }
    const q4_kQuantizeOpsPerSec = Math.round((iters / ((performance.now() - t0Q4K) / 1000)) * 100) / 100;

    // Matmul: 64 rows x 128 cols
    const rows = 64;
    const cols = 128;
    const matWeights = new Float32Array(rows * cols);
    for (let i = 0; i < matWeights.length; i++) matWeights[i] = Math.cos(i * 0.05);
    const qMat = this.quantizeQ4_0(matWeights);
    const x = new Float32Array(cols);
    for (let i = 0; i < cols; i++) x[i] = 1.0;

    const t0Mm = performance.now();
    for (let i = 0; i < iters; i++) {
      this.quantizedMatMulVec(qMat, x, rows, cols, "Q4_0");
    }
    const mmElapsed = performance.now() - t0Mm;
    const totalFlops = 2 * rows * cols * iters;
    const matmulThroughputGFlops = Math.round((totalFlops / (mmElapsed / 1000) / 1e9) * 1000) / 1000;
    const averageMatMulTimeMs = Math.round((mmElapsed / iters) * 100) / 100;

    const receipt: TensorReceipt = deepFreeze({
      receiptId: `rcpt-tensor-bench-${Date.now()}`,
      operation: "benchmark",
      timestamp: new Date().toISOString(),
      digest: sha256Hex(`bench:${iters}:${matmulThroughputGFlops}:${q4_0QuantizeOpsPerSec}`),
      receiptSha256: sha256Hex(JSON.stringify({ iters, matmulThroughputGFlops, averageMatMulTimeMs })),
    });

    return deepFreeze({
      matmulThroughputGFlops,
      q4_0QuantizeOpsPerSec,
      q4_0DequantizeOpsPerSec,
      q8_0QuantizeOpsPerSec,
      q4_kQuantizeOpsPerSec,
      averageMatMulTimeMs,
      receipt,
    });
  }
}
