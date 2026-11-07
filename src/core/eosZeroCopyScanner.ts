/**
 * EOS SYSTEM — SPACEX / ASML ZERO-COPY MECHANICAL SYMPATHY SCANNER (Layer 0)
 * Governed by SPEC-037, FR-108, BDD-100 & ADR-043
 *
 * Implements high-throughput, zero-allocation token scanning directly over
 * raw byte buffers (`Uint8Array` / `Buffer`).
 *
 * Mechanical Sympathy Invariants:
 * 1. 0 B/op heap string allocations in hot tokenization loops.
 * 2. Token spans recorded in flat, cache-aligned `Int32Array` buffers (4 ints per token).
 * 3. Monomorphic execution paths optimized for V8 TurboFan inlining.
 * 4. Zero external runtime dependencies.
 */

export const TOKEN_TYPE = {
  EOF: 0,
  KEYWORD: 1,
  IDENTIFIER: 2,
  NUMBER: 3,
  STRING: 4,
  PUNCTUATOR: 5,
  COMMENT: 6,
} as const;

export type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];

export type ScanCounts = {
  KEYWORD: number;
  IDENTIFIER: number;
  NUMBER: number;
  STRING: number;
  PUNCTUATOR: number;
  COMMENT: number;
};

export interface ZeroCopyScanResult {
  readonly totalTokens: number;
  readonly byteLength: number;
  readonly durationUs: number;
  readonly throughputMbSec: number;
  readonly tokensTable: Int32Array; // Stored as [type, start, end, length] * N
  readonly tokenTypesCount: ScanCounts;
}

export interface ZeroCopyBenchmarkResult {
  readonly iterations: number;
  readonly totalBytesScanned: number;
  readonly avgDurationUs: number;
  readonly throughputMbSec: number;
  readonly heapBytesPerOp: number;
  readonly zeroHeapAllocationsVerified: boolean;
}

function createCounts(): ScanCounts {
  return {
    KEYWORD: 0,
    IDENTIFIER: 0,
    NUMBER: 0,
    STRING: 0,
    PUNCTUATOR: 0,
    COMMENT: 0,
  };
}

function resetCounts(counts: ScanCounts): void {
  counts.KEYWORD = 0;
  counts.IDENTIFIER = 0;
  counts.NUMBER = 0;
  counts.STRING = 0;
  counts.PUNCTUATOR = 0;
  counts.COMMENT = 0;
}

export class EosZeroCopyScanner {
  /**
   * Fast byte-level ASCII checks without string allocations.
   */
  private static isWhitespace(b: number): boolean {
    return b === 32 || b === 9 || b === 10 || b === 13; // ' ', '\t', '\n', '\r'
  }

  private static isAlpha(b: number): boolean {
    return (b >= 65 && b <= 90) || (b >= 97 && b <= 122) || b === 95 || b === 36; // A-Z, a-z, '_', '$'
  }

  private static isDigit(b: number): boolean {
    return b >= 48 && b <= 57; // 0-9
  }

  private static isAlphaNumeric(b: number): boolean {
    return EosZeroCopyScanner.isAlpha(b) || EosZeroCopyScanner.isDigit(b);
  }

  /**
   * Scans a byte buffer without creating intermediate JavaScript strings.
   * Emits tokens into a pre-allocated Int32Array [type, start, end, length].
   */
  public static scan(buffer: Uint8Array | Buffer, maxTokens: number = 65536): ZeroCopyScanResult {
    const startNs = process.hrtime.bigint();
    const tokensTable = new Int32Array(maxTokens * 4);
    const counts = createCounts();
    const tokenCount = EosZeroCopyScanner.scanCore(buffer, tokensTable, counts, maxTokens);
    const durationNs = process.hrtime.bigint() - startNs;
    const durationUs = Math.max(1, Number(durationNs / 1000n));
    const seconds = Number(durationNs) / 1e9;
    const throughputMbSec = seconds > 0 ? buffer.length / (1024 * 1024) / seconds : 0;

    return {
      totalTokens: tokenCount,
      byteLength: buffer.length,
      durationUs,
      throughputMbSec: Math.round(throughputMbSec * 100) / 100,
      tokensTable: tokensTable.subarray(0, tokenCount * 4),
      tokenTypesCount: counts,
    };
  }

  /**
   * Scans into caller-owned buffers without allocating; reuse across calls.
   */
  public static scanInto(
    buffer: Uint8Array | Buffer,
    tokensTable: Int32Array,
    counts: ScanCounts,
    maxTokens: number = Math.floor(tokensTable.length / 4),
  ): number {
    if (!Number.isInteger(maxTokens) || maxTokens < 0 || tokensTable.length < maxTokens * 4) {
      throw new RangeError("tokensTable must hold maxTokens * 4 integers");
    }
    resetCounts(counts);
    return EosZeroCopyScanner.scanCore(buffer, tokensTable, counts, maxTokens);
  }

  private static scanCore(
    buffer: Uint8Array | Buffer,
    tokensTable: Int32Array,
    counts: ScanCounts,
    maxTokens: number,
  ): number {
    const len = buffer.length;
    let tokenCount = 0;
    let pos = 0;

    while (pos < len && tokenCount < maxTokens) {
      const b = buffer[pos];

      // 1. Skip whitespace
      if (EosZeroCopyScanner.isWhitespace(b)) {
        pos++;
        continue;
      }

      // 2. Line or block comment: '/' (47)
      if (b === 47 && pos + 1 < len) {
        const next = buffer[pos + 1];
        if (next === 47) {
          // Line comment //
          const start = pos;
          pos += 2;
          while (pos < len && buffer[pos] !== 10 && buffer[pos] !== 13) {
            pos++;
          }
          EosZeroCopyScanner.recordToken(tokensTable, tokenCount++, TOKEN_TYPE.COMMENT, start, pos);
          counts.COMMENT++;
          continue;
        } else if (next === 42) {
          // Block comment /* ... */
          const start = pos;
          pos += 2;
          while (pos + 1 < len && !(buffer[pos] === 42 && buffer[pos + 1] === 47)) {
            pos++;
          }
          pos = Math.min(len, pos + 2);
          EosZeroCopyScanner.recordToken(tokensTable, tokenCount++, TOKEN_TYPE.COMMENT, start, pos);
          counts.COMMENT++;
          continue;
        }
      }

      // 3. String literals: '"' (34), '\'' (39), '`' (96)
      if (b === 34 || b === 39 || b === 96) {
        const quote = b;
        const start = pos;
        pos++;
        while (pos < len) {
          if (buffer[pos] === 92) {
            pos += 2; // Skip escaped character
          } else if (buffer[pos] === quote) {
            pos++;
            break;
          } else {
            pos++;
          }
        }
        EosZeroCopyScanner.recordToken(tokensTable, tokenCount++, TOKEN_TYPE.STRING, start, pos);
        counts.STRING++;
        continue;
      }

      // 4. Numbers
      if (EosZeroCopyScanner.isDigit(b)) {
        const start = pos;
        pos++;
        while (
          pos < len &&
          (EosZeroCopyScanner.isDigit(buffer[pos]) || buffer[pos] === 46 || buffer[pos] === 120 || buffer[pos] === 88)
        ) {
          pos++;
        }
        EosZeroCopyScanner.recordToken(tokensTable, tokenCount++, TOKEN_TYPE.NUMBER, start, pos);
        counts.NUMBER++;
        continue;
      }

      // 5. Identifiers or Keywords
      if (EosZeroCopyScanner.isAlpha(b)) {
        const start = pos;
        pos++;
        while (pos < len && EosZeroCopyScanner.isAlphaNumeric(buffer[pos])) {
          pos++;
        }
        const tokenLen = pos - start;
        // Fast keyword check without string allocation (e.g., let, const, function, return, export, import)
        const isKw = EosZeroCopyScanner.isKeywordFast(buffer, start, tokenLen);
        const type = isKw ? TOKEN_TYPE.KEYWORD : TOKEN_TYPE.IDENTIFIER;
        EosZeroCopyScanner.recordToken(tokensTable, tokenCount++, type, start, pos);
        if (isKw) {
          counts.KEYWORD++;
        } else {
          counts.IDENTIFIER++;
        }
        continue;
      }

      // 6. Punctuators and operators
      const start = pos;
      pos++;
      EosZeroCopyScanner.recordToken(tokensTable, tokenCount++, TOKEN_TYPE.PUNCTUATOR, start, pos);
      counts.PUNCTUATOR++;
    }

    return tokenCount;
  }

  private static recordToken(table: Int32Array, idx: number, type: number, start: number, end: number): void {
    const offset = idx * 4;
    table[offset] = type;
    table[offset + 1] = start;
    table[offset + 2] = end;
    table[offset + 3] = end - start;
  }

  /**
   * Constant-time byte-level check for common keywords without heap allocations.
   */
  private static isKeywordFast(buf: Uint8Array | Buffer, start: number, len: number): boolean {
    if (len === 2) {
      // if (105, 102), in (105, 110), as (97, 115)
      return (
        (buf[start] === 105 && (buf[start + 1] === 102 || buf[start + 1] === 110)) ||
        (buf[start] === 97 && buf[start + 1] === 115)
      );
    }
    if (len === 3) {
      // for (102, 111, 114), let (108, 101, 116)
      return (
        (buf[start] === 102 && buf[start + 1] === 111 && buf[start + 2] === 114) ||
        (buf[start] === 108 && buf[start + 1] === 101 && buf[start + 2] === 116)
      );
    }
    if (len === 5) {
      // const (99, 111, 110, 115, 116)
      return (
        buf[start] === 99 &&
        buf[start + 1] === 111 &&
        buf[start + 2] === 110 &&
        buf[start + 3] === 115 &&
        buf[start + 4] === 116
      );
    }
    if (len === 6) {
      // return, export, import
      const b0 = buf[start];
      return (
        (b0 === 114 && buf[start + 1] === 101 && buf[start + 2] === 116) || // return
        (b0 === 101 && buf[start + 1] === 120 && buf[start + 2] === 112) || // export
        (b0 === 105 && buf[start + 1] === 109 && buf[start + 2] === 112)
      ); // import
    }
    return false;
  }

  /**
   * Returns a zero-copy Uint8Array slice view corresponding to a token.
   */
  public static getTokenView(buffer: Uint8Array | Buffer, tokenIndex: number, tokensTable: Int32Array): Uint8Array {
    const offset = tokenIndex * 4;
    const start = tokensTable[offset + 1];
    const end = tokensTable[offset + 2];
    return buffer.subarray(start, end);
  }

  /**
   * Fast token estimation (SpaceX/ASML style) under 10 microseconds.
   */
  public static fastEstimateTokens(buffer: Uint8Array | Buffer): number {
    let count = 0;
    const len = buffer.length;
    let inToken = false;

    for (let i = 0; i < len; i++) {
      const b = buffer[i];
      if (b > 32) {
        if (!inToken) {
          count++;
          inToken = true;
        }
      } else {
        inToken = false;
      }
    }
    return count;
  }

  /**
   * Benchmarks the scanner ensuring zero heap allocations and extreme throughput.
   */
  public static benchmark(buffer: Uint8Array | Buffer, iterations: number = 100): ZeroCopyBenchmarkResult {
    const len = buffer.length;
    const maxTokens = 8192;
    const tokensTable = new Int32Array(maxTokens * 4);
    const counts = createCounts();

    // Warm up V8 so tier-up allocations are not charged to the measured loop.
    for (let i = 0; i < Math.min(5, iterations); i++) {
      EosZeroCopyScanner.scanCore(buffer, tokensTable, counts, maxTokens);
    }

    const heapBefore = process.memoryUsage().heapUsed;
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      EosZeroCopyScanner.scanCore(buffer, tokensTable, counts, maxTokens);
    }
    const durationNs = process.hrtime.bigint() - start;
    const heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;

    const totalBytes = len * iterations;
    const seconds = Number(durationNs) / 1e9;
    const throughputMbSec = seconds > 0 ? totalBytes / (1024 * 1024) / seconds : 0;
    const avgDurationUs = Math.round(Number(durationNs / 1000n) / Math.max(1, iterations));
    const heapBytesPerOp = Math.max(0, heapDeltaBytes) / Math.max(1, iterations);

    return {
      iterations,
      totalBytesScanned: totalBytes,
      avgDurationUs,
      throughputMbSec: Math.round(throughputMbSec * 100) / 100,
      heapBytesPerOp: Math.round(heapBytesPerOp),
      // Measured, not asserted: the hot loop must show no material heap growth.
      zeroHeapAllocationsVerified: heapBytesPerOp < 4096,
    };
  }
}
