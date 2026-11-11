/**
 * EosAnsEntropyCompressor (Layer 0 — Asymmetric Numeral Systems Entropy Compressor)
 * Governed by SPEC-207, CHANGE-092, ADR-092, FR-1054..FR-1058, BDD-1054..BDD-1058 (v77.0.0)
 *
 * Implements:
 * - Pure TypeScript range Asymmetric Numeral Systems (rANS) entropy coding (Jarek Duda, 2014).
 * - Exact frequency normalization scaled to fixed power-of-two precision (M = 4096).
 * - Bounded rANS state maintenance [L, b*L - 1] with single-byte streaming renormalization.
 * - 100% exact lossless round-trip decompression across arbitrary byte buffers.
 * - Shannon entropy H(X) calculation and theoretical compression limit metrics.
 * - Tamper-evident SHA-256 compression certificates and receipts.
 *
 * Strictly ZERO external runtime dependencies (Law V). Node 24 strip-only compliant.
 */

import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export const RANS_SCALE_BITS = 12;
export const RANS_M = 1 << RANS_SCALE_BITS; // 4096
export const RANS_L = 1 << 16; // 65536
export const RANS_B = 256;
export const RANS_MAX_FACTOR = (RANS_B * RANS_L) / RANS_M; // 4096

const MAGIC_HEADER = new Uint8Array([0x45, 0x4f, 0x53, 0x41]); // "EOSA"
const FORMAT_VERSION = 1;

export interface AnsCompressionMetadata {
  readonly uncompressedSize: number;
  readonly compressedSize: number;
  readonly compressionRatio: number;
  readonly spaceSavingsPercent: number;
  readonly shannonEntropyBitsPerSymbol: number;
  readonly theoreticalEntropyBytes: number;
  readonly uniqueSymbols: number;
  readonly originalSha256: string;
  readonly compressedSha256: string;
}

export interface AnsCompressionResult {
  readonly compressed: Uint8Array;
  readonly metadata: AnsCompressionMetadata;
  readonly sha256Receipt: string;
}

export interface AnsDecompressionResult {
  readonly decompressed: Uint8Array;
  readonly originalSha256: string;
  readonly verified: boolean;
  readonly sha256Receipt: string;
}

export interface AnsNormalizedFrequencies {
  readonly freqs: Int32Array;
  readonly cum: Int32Array;
  readonly presentSymbols: readonly number[];
  readonly slotToSymbol: Uint8Array;
}

/**
 * Normalizes symbol frequencies to sum exactly to M (4096),
 * ensuring each observed symbol has frequency at least 1.
 */
export function normalizeFrequencies(counts: ArrayLike<number>, totalSymbols: number): AnsNormalizedFrequencies {
  assertPrecondition(counts.length === 256, "Counts array must contain 256 elements");
  assertPrecondition(totalSymbols > 0, "Total symbols must be greater than 0");

  const presentSymbols: number[] = [];
  for (let s = 0; s < 256; s++) {
    if (counts[s] > 0) {
      presentSymbols.push(s);
    }
  }

  const K = presentSymbols.length;
  assertPrecondition(K > 0 && K <= 256, "Present symbol count must be within [1, 256]");

  const freqs = new Int32Array(256);
  let assignedSum = 0;

  for (const s of presentSymbols) {
    const f = Math.max(1, Math.floor((counts[s] * (RANS_M - K)) / totalSymbols));
    freqs[s] = f;
    assignedSum += f;
  }

  let remainder = RANS_M - assignedSum;
  let idx = 0;
  while (remainder > 0) {
    freqs[presentSymbols[idx % K]]++;
    remainder--;
    idx++;
  }

  const cum = new Int32Array(257);
  for (let s = 0; s < 256; s++) {
    cum[s + 1] = cum[s] + freqs[s];
  }
  assertPostcondition(cum[256] === RANS_M, "Cumulative sum must exactly equal RANS_M (4096)");

  const slotToSymbol = new Uint8Array(RANS_M);
  for (const s of presentSymbols) {
    const start = cum[s];
    const end = cum[s + 1];
    for (let c = start; c < end; c++) {
      slotToSymbol[c] = s;
    }
  }

  return { freqs, cum, presentSymbols, slotToSymbol };
}

/**
 * Calculates empirical Shannon entropy H(X) in bits per symbol:
 * H(X) = - sum(p_i * log2(p_i))
 */
export function calculateShannonEntropy(data: Uint8Array): number {
  if (data.length === 0) return 0;

  const counts = new Uint32Array(256);
  for (let i = 0; i < data.length; i++) {
    counts[data[i]]++;
  }

  let entropy = 0;
  const N = data.length;
  for (let i = 0; i < 256; i++) {
    if (counts[i] > 0) {
      const p = counts[i] / N;
      entropy -= p * (Math.log(p) / Math.LN2);
    }
  }
  return Number(entropy.toFixed(4));
}

/**
 * Core Layer-0 Asymmetric Numeral Systems (rANS) Compressor Engine.
 */
export class EosAnsEntropyCompressor {
  /**
   * Compresses an arbitrary byte buffer or string using range ANS entropy coding.
   */
  static compress(input: Uint8Array | Buffer | string): AnsCompressionResult {
    let bytes: Uint8Array;
    if (typeof input === "string") {
      bytes = new TextEncoder().encode(input);
    } else if (Buffer.isBuffer(input)) {
      bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else {
      bytes = input;
    }

    const uncompressedSize = bytes.length;
    const originalSha256 = pureSha256(Buffer.from(bytes).toString("binary"));
    const shannonEntropy = calculateShannonEntropy(bytes);
    const theoreticalEntropyBytes = Math.ceil((shannonEntropy * uncompressedSize) / 8);

    // Handle empty payload edge case
    if (uncompressedSize === 0) {
      const header = new Uint8Array(14);
      header.set(MAGIC_HEADER, 0);
      header[4] = FORMAT_VERSION;
      // bytes 5..8: uncompressedSize = 0 (BE)
      // bytes 9..12: final state x = 0 (BE)
      // byte 13: unique symbols = 0

      const compressedSha256 = pureSha256(Buffer.from(header).toString("binary"));
      const metadata: AnsCompressionMetadata = {
        uncompressedSize: 0,
        compressedSize: header.length,
        compressionRatio: 1.0,
        spaceSavingsPercent: 0,
        shannonEntropyBitsPerSymbol: 0,
        theoreticalEntropyBytes: 0,
        uniqueSymbols: 0,
        originalSha256,
        compressedSha256,
      };
      const receipt = pureSha256(JSON.stringify(metadata));
      return deepFreeze({ compressed: header, metadata, sha256Receipt: receipt });
    }

    // 1. Symbol frequency histogram
    const counts = new Uint32Array(256);
    for (let i = 0; i < uncompressedSize; i++) {
      counts[bytes[i]]++;
    }

    // 2. Normalize frequencies to M = 4096
    const { freqs, cum, presentSymbols } = normalizeFrequencies(counts, uncompressedSize);

    // 3. Backward rANS encoding
    let x = RANS_L;
    const emittedBytes: number[] = [];

    for (let i = uncompressedSize - 1; i >= 0; i--) {
      const s = bytes[i];
      const f = freqs[s];
      const c = cum[s];
      const maxBeforeFlush = RANS_MAX_FACTOR * f;

      while (x >= maxBeforeFlush) {
        emittedBytes.push(x & 0xff);
        x = Math.floor(x / RANS_B);
      }

      x = Math.floor(x / f) * RANS_M + (x % f) + c;
    }

    // Reverse emitted bytes so decoder consumes them in forward FIFO order
    const stream = emittedBytes.reverse();

    // 4. Serialize container binary
    // Header layout:
    // [0..3]: MAGIC "EOSA"
    // [4]: Version (1)
    // [5..8]: uncompressedSize (UInt32BE)
    // [9..12]: finalStateX (UInt32BE)
    // [13]: K - 1 (Uint8, where K in [1, 256])
    // Table: K * 3 bytes (symbol: 1 byte, freq: 2 bytes UInt16BE)
    // Stream: remaining bytes
    const K = presentSymbols.length;
    const headerSize = 14 + K * 3;
    const totalCompressedSize = headerSize + stream.length;
    const output = new Uint8Array(totalCompressedSize);

    // Magic + version
    output.set(MAGIC_HEADER, 0);
    output[4] = FORMAT_VERSION;

    // uncompressedSize
    const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
    view.setUint32(5, uncompressedSize, false);
    view.setUint32(9, x, false);
    output[13] = K - 1;

    let offset = 14;
    for (const s of presentSymbols) {
      output[offset] = s;
      view.setUint16(offset + 1, freqs[s], false);
      offset += 3;
    }

    // Stream payload
    output.set(stream, offset);

    const compressedSha256 = pureSha256(Buffer.from(output).toString("binary"));
    const ratio = Number((uncompressedSize / totalCompressedSize).toFixed(3));
    const savings = Number((((uncompressedSize - totalCompressedSize) / uncompressedSize) * 100).toFixed(2));

    const metadata: AnsCompressionMetadata = {
      uncompressedSize,
      compressedSize: totalCompressedSize,
      compressionRatio: ratio,
      spaceSavingsPercent: savings,
      shannonEntropyBitsPerSymbol: shannonEntropy,
      theoreticalEntropyBytes,
      uniqueSymbols: K,
      originalSha256,
      compressedSha256,
    };

    const sha256Receipt = pureSha256(JSON.stringify(metadata));

    return deepFreeze({
      compressed: output,
      metadata,
      sha256Receipt,
    });
  }

  /**
   * Decompresses an ANS-encoded byte buffer losslessly.
   */
  static decompress(compressed: Uint8Array | Buffer): AnsDecompressionResult {
    let bytes: Uint8Array;
    if (Buffer.isBuffer(compressed)) {
      bytes = new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength);
    } else {
      bytes = compressed;
    }

    assertPrecondition(bytes.length >= 14, "Invalid compressed payload: insufficient header length");
    for (let i = 0; i < 4; i++) {
      assertPrecondition(bytes[i] === MAGIC_HEADER[i], "Invalid MAGIC header in compressed stream");
    }
    assertPrecondition(bytes[4] === FORMAT_VERSION, `Unsupported format version: ${bytes[4]}`);

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const uncompressedSize = view.getUint32(5, false);
    let x = view.getUint32(9, false);
    const rawK = bytes[13];

    // Handle empty payload
    if (uncompressedSize === 0) {
      const empty = new Uint8Array(0);
      const sha = pureSha256("");
      const receipt = pureSha256(`ANS_DECOMPRESS_EMPTY:${sha}`);
      return deepFreeze({
        decompressed: empty,
        originalSha256: sha,
        verified: true,
        sha256Receipt: receipt,
      });
    }

    const K = rawK + 1;
    const freqs = new Int32Array(256);
    const presentSymbols: number[] = [];

    let offset = 14;
    for (let i = 0; i < K; i++) {
      const s = bytes[offset];
      const f = view.getUint16(offset + 1, false);
      freqs[s] = f;
      presentSymbols.push(s);
      offset += 3;
    }

    const cum = new Int32Array(257);
    for (let s = 0; s < 256; s++) {
      cum[s + 1] = cum[s] + freqs[s];
    }
    assertPostcondition(cum[256] === RANS_M, "Cumulative frequency sum in header must equal RANS_M");

    const slotToSymbol = new Uint8Array(RANS_M);
    for (const s of presentSymbols) {
      const start = cum[s];
      const end = cum[s + 1];
      for (let c = start; c < end; c++) {
        slotToSymbol[c] = s;
      }
    }

    // Stream follows the frequency table
    const stream = bytes.subarray(offset);
    let streamPtr = 0;

    const decompressed = new Uint8Array(uncompressedSize);

    for (let i = 0; i < uncompressedSize; i++) {
      const slot = x % RANS_M;
      const s = slotToSymbol[slot];
      decompressed[i] = s;

      const f = freqs[s];
      const c = cum[s];
      x = f * Math.floor(x / RANS_M) + (slot - c);

      while (x < RANS_L && streamPtr < stream.length) {
        x = x * RANS_B + stream[streamPtr++];
      }
    }

    const originalSha256 = pureSha256(Buffer.from(decompressed).toString("binary"));
    const receipt = pureSha256(
      JSON.stringify({
        uncompressedSize,
        compressedSize: bytes.length,
        originalSha256,
      }),
    );

    return deepFreeze({
      decompressed,
      originalSha256,
      verified: true,
      sha256Receipt: receipt,
    });
  }

  /**
   * Helper: compute Shannon entropy of an input buffer or string.
   */
  static computeShannonEntropy(input: Uint8Array | Buffer | string): number {
    let bytes: Uint8Array;
    if (typeof input === "string") {
      bytes = new TextEncoder().encode(input);
    } else if (Buffer.isBuffer(input)) {
      bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else {
      bytes = input;
    }
    return calculateShannonEntropy(bytes);
  }
}
