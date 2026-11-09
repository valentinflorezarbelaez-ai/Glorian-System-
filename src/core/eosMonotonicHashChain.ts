/**
 * EosMonotonicHashChain (Layer 0 — Pure Domain & Algorithms)
 * SPEC-038: Palantir HNSW Vector Reasoning & Aladdin Risk Ledger Engine
 *
 * Implements high-resolution monotonic timekeeping and Merkle-style sequential
 * SHA-256 hash chaining for tamper-evident audit trails.
 *
 * Inspired by SpaceX telemetry streams and NSA cryptographic ledger standards.
 * ZERO external dependencies — 100% pure TypeScript.
 */

export const GENESIS_PREVIOUS_HASH = "0".repeat(64);

export interface BlockPayload {
  readonly recordId: string;
  readonly type: string;
  readonly payloadHash: string;
  readonly summary: string;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface HashChainBlockData {
  readonly index: number;
  readonly previousHash: string;
  readonly currentHash: string;
  readonly payload: BlockPayload;
  readonly wallClockIso: string;
  readonly monotonicNs: string; // Serialized BigInt for JSON safety
}

export interface ChainVerificationResult {
  readonly valid: boolean;
  readonly totalBlocks: number;
  readonly brokenIndex?: number | undefined;
  readonly reason?: string | undefined;
}

export interface MonotonicTimestamp {
  readonly wallClockIso: string;
  readonly monotonicNs: bigint;
  readonly sequenceIndex: number;
}

export type MonotonicProvider = () => bigint;
export type WallClockProvider = () => string;

/**
 * Pure TypeScript implementation of standard FIPS 180-4 SHA-256.
 * Guarantees cryptographic determinism across all platforms without node:crypto.
 */
export function pureSha256(asciiOrUtf8: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < asciiOrUtf8.length; i++) {
    let code = asciiOrUtf8.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (asciiOrUtf8.charCodeAt(i) & 0x3ff));
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length + 8) % 64 !== 0) {
    bytes.push(0x00);
  }

  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  for (let i = 3; i >= 0; i--) bytes.push((highBits >>> (i * 8)) & 0xff);
  for (let i = 3; i >= 0; i--) bytes.push((lowBits >>> (i * 8)) & 0xff);

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
    0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
    0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
    0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ];

  let h0 = 0x6a09e667 >>> 0;
  let h1 = 0xbb67ae85 >>> 0;
  let h2 = 0x3c6ef372 >>> 0;
  let h3 = 0xa54ff53a >>> 0;
  let h4 = 0x510e527f >>> 0;
  let h5 = 0x9b05688c >>> 0;
  let h6 = 0x1f83d9ab >>> 0;
  let h7 = 0x5be0cd19 >>> 0;

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const idx = offset + i * 4;
      const b0 = bytes[idx] ?? 0;
      const b1 = bytes[idx + 1] ?? 0;
      const b2 = bytes[idx + 2] ?? 0;
      const b3 = bytes[idx + 3] ?? 0;
      w[i] = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10)) >>> 0;
      w[i] = (((w[i - 16]! + s0) >>> 0) + ((w[i - 7]! + s1) >>> 0)) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (((h + S1) >>> 0) + ((ch + (K[i] ?? 0)) >>> 0) + w[i]!) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const toHex = (n: number): string => n.toString(16).padStart(8, "0");
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

export class MonotonicClock {
  private lastMonotonicNs: bigint;
  private sequence: number;
  private readonly monotonicProvider: MonotonicProvider;
  private readonly wallClockProvider: WallClockProvider;

  constructor(options?: {
    initialNs?: bigint;
    monotonicProvider?: MonotonicProvider;
    wallClockProvider?: WallClockProvider;
  }) {
    this.lastMonotonicNs = options?.initialNs ?? 0n;
    this.sequence = 0;

    this.monotonicProvider =
      options?.monotonicProvider ??
      (() => {
        if (
          typeof globalThis !== "undefined" &&
          "performance" in globalThis &&
          typeof globalThis.performance?.now === "function"
        ) {
          const origin = typeof globalThis.performance.timeOrigin === "number" ? globalThis.performance.timeOrigin : 0;
          const ms = origin + globalThis.performance.now();
          return BigInt(Math.floor(ms * 1_000_000));
        }
        return BigInt(Date.now()) * 1_000_000n;
      });

    this.wallClockProvider = options?.wallClockProvider ?? (() => new Date().toISOString());
  }

  public now(): MonotonicTimestamp {
    let currentNs = this.monotonicProvider();
    if (currentNs <= this.lastMonotonicNs) {
      currentNs = this.lastMonotonicNs + 1n;
    }
    this.lastMonotonicNs = currentNs;
    this.sequence += 1;

    return Object.freeze({
      wallClockIso: this.wallClockProvider(),
      monotonicNs: currentNs,
      sequenceIndex: this.sequence,
    });
  }

  public reset(initialNs?: bigint): void {
    this.lastMonotonicNs = initialNs ?? 0n;
    this.sequence = 0;
  }
}

export class HashChainBlock {
  public readonly index: number;
  public readonly previousHash: string;
  public readonly currentHash: string;
  public readonly payload: BlockPayload;
  public readonly wallClockIso: string;
  public readonly monotonicNs: bigint;

  constructor(data: {
    index: number;
    previousHash: string;
    payload: BlockPayload;
    wallClockIso: string;
    monotonicNs: bigint;
    currentHash?: string;
  }) {
    if (data.index < 0) {
      throw new Error(`Invalid block index ${data.index}: index cannot be negative`);
    }

    if (data.index === 0 && data.previousHash !== GENESIS_PREVIOUS_HASH) {
      throw new Error(`Genesis block (index 0) must have previousHash equal to "${GENESIS_PREVIOUS_HASH}"`);
    }

    this.index = data.index;
    this.previousHash = data.previousHash;
    this.payload = Object.freeze({ ...data.payload });
    this.wallClockIso = data.wallClockIso;
    this.monotonicNs = data.monotonicNs;

    const computed = HashChainBlock.computeHash(
      this.index,
      this.previousHash,
      this.payload.payloadHash,
      this.monotonicNs,
    );

    if (data.currentHash !== undefined && data.currentHash !== computed) {
      throw new Error(
        `Block hash mismatch for index ${this.index}: provided ${data.currentHash} !== computed ${computed}`,
      );
    }

    this.currentHash = computed;
    Object.freeze(this);
  }

  public static computeHash(index: number, previousHash: string, payloadHash: string, monotonicNs: bigint): string {
    const raw = `${index}:${previousHash}:${payloadHash}:${monotonicNs.toString()}`;
    return pureSha256(raw);
  }

  public static createGenesis(payload: BlockPayload, wallClockIso: string, monotonicNs: bigint): HashChainBlock {
    return new HashChainBlock({
      index: 0,
      previousHash: GENESIS_PREVIOUS_HASH,
      payload,
      wallClockIso,
      monotonicNs,
    });
  }

  public static createNextBlock(
    previousBlock: HashChainBlock,
    payload: BlockPayload,
    wallClockIso: string,
    monotonicNs: bigint,
  ): HashChainBlock {
    if (monotonicNs < previousBlock.monotonicNs) {
      throw new Error(
        `Invariant violation: Monotonic time cannot decrease in hash chain (${monotonicNs} < ${previousBlock.monotonicNs})`,
      );
    }

    return new HashChainBlock({
      index: previousBlock.index + 1,
      previousHash: previousBlock.currentHash,
      payload,
      wallClockIso,
      monotonicNs,
    });
  }

  public static verifyChain(blocks: readonly HashChainBlock[]): ChainVerificationResult {
    if (blocks.length === 0) {
      return Object.freeze({ valid: true, totalBlocks: 0 });
    }

    const first = blocks[0];
    if (!first || first.index !== 0) {
      return Object.freeze({
        valid: false,
        totalBlocks: blocks.length,
        brokenIndex: 0,
        reason: "BROKEN_CHAIN_DETECTED: First block must be genesis with index 0",
      });
    }

    if (first.previousHash !== GENESIS_PREVIOUS_HASH) {
      return Object.freeze({
        valid: false,
        totalBlocks: blocks.length,
        brokenIndex: 0,
        reason: `BROKEN_CHAIN_DETECTED: Genesis previousHash must be ${GENESIS_PREVIOUS_HASH}`,
      });
    }

    const computePayloadHash = (p: BlockPayload): string => {
      return pureSha256(`${p.recordId}:${p.type}:${p.summary}:${JSON.stringify(p.metadata ?? {})}`);
    };

    if (first.payload.payloadHash !== computePayloadHash(first.payload)) {
      return Object.freeze({
        valid: false,
        totalBlocks: blocks.length,
        brokenIndex: 0,
        reason: "BROKEN_CHAIN_DETECTED: Genesis payload content hash mismatch (tampered payload)",
      });
    }

    const computedGen = HashChainBlock.computeHash(
      first.index,
      first.previousHash,
      first.payload.payloadHash,
      first.monotonicNs,
    );
    if (first.currentHash !== computedGen) {
      return Object.freeze({
        valid: false,
        totalBlocks: blocks.length,
        brokenIndex: 0,
        reason: "BROKEN_CHAIN_DETECTED: Genesis hash verification failed",
      });
    }

    for (let i = 1; i < blocks.length; i++) {
      const prev = blocks[i - 1]!;
      const curr = blocks[i]!;

      if (curr.index !== prev.index + 1) {
        return Object.freeze({
          valid: false,
          totalBlocks: blocks.length,
          brokenIndex: curr.index,
          reason: `BROKEN_CHAIN_DETECTED: Non-consecutive index gap between ${prev.index} and ${curr.index}`,
        });
      }

      if (curr.previousHash !== prev.currentHash) {
        return Object.freeze({
          valid: false,
          totalBlocks: blocks.length,
          brokenIndex: curr.index,
          reason: `BROKEN_CHAIN_DETECTED: Block ${curr.index} previousHash does not match predecessor hash`,
        });
      }

      if (curr.monotonicNs < prev.monotonicNs) {
        return Object.freeze({
          valid: false,
          totalBlocks: blocks.length,
          brokenIndex: curr.index,
          reason: `BROKEN_CHAIN_DETECTED: Monotonic clock decreased at block ${curr.index}`,
        });
      }

      if (curr.payload.payloadHash !== computePayloadHash(curr.payload)) {
        return Object.freeze({
          valid: false,
          totalBlocks: blocks.length,
          brokenIndex: curr.index,
          reason: `BROKEN_CHAIN_DETECTED: Block ${curr.index} payload content hash mismatch (tampered payload)`,
        });
      }

      const recomputed = HashChainBlock.computeHash(
        curr.index,
        curr.previousHash,
        curr.payload.payloadHash,
        curr.monotonicNs,
      );

      if (curr.currentHash !== recomputed) {
        return Object.freeze({
          valid: false,
          totalBlocks: blocks.length,
          brokenIndex: curr.index,
          reason: `BROKEN_CHAIN_DETECTED: Block ${curr.index} hash mismatch (tampered payload or header)`,
        });
      }
    }

    return Object.freeze({ valid: true, totalBlocks: blocks.length });
  }

  public toJSON(): HashChainBlockData {
    return {
      index: this.index,
      previousHash: this.previousHash,
      currentHash: this.currentHash,
      payload: this.payload,
      wallClockIso: this.wallClockIso,
      monotonicNs: this.monotonicNs.toString(),
    };
  }

  public static fromJSON(data: HashChainBlockData): HashChainBlock {
    return new HashChainBlock({
      index: data.index,
      previousHash: data.previousHash,
      currentHash: data.currentHash,
      payload: data.payload,
      wallClockIso: data.wallClockIso,
      monotonicNs: BigInt(data.monotonicNs),
    });
  }
}

export class EosMonotonicHashChain {
  private clock: MonotonicClock;
  private blocks: HashChainBlock[] = [];

  constructor(options?: { clock?: MonotonicClock }) {
    this.clock = options?.clock ?? new MonotonicClock();
  }

  public append(recordId: string, type: string, summary: string, metadata?: Record<string, unknown>): HashChainBlock {
    const ts = this.clock.now();
    const payloadHash = pureSha256(`${recordId}:${type}:${summary}:${JSON.stringify(metadata ?? {})}`);
    const payload: BlockPayload = { recordId, type, payloadHash, summary, metadata };

    let block: HashChainBlock;
    if (this.blocks.length === 0) {
      block = HashChainBlock.createGenesis(payload, ts.wallClockIso, ts.monotonicNs);
    } else {
      const prev = this.blocks[this.blocks.length - 1]!;
      block = HashChainBlock.createNextBlock(prev, payload, ts.wallClockIso, ts.monotonicNs);
    }

    this.blocks.push(block);
    return block;
  }

  public verify(): ChainVerificationResult {
    return HashChainBlock.verifyChain(this.blocks);
  }

  public getBlocks(): readonly HashChainBlock[] {
    return this.blocks;
  }

  public getLatestBlock(): HashChainBlock | null {
    return this.blocks.length > 0 ? this.blocks[this.blocks.length - 1]! : null;
  }

  public toJSON(): HashChainBlockData[] {
    return this.blocks.map((b) => b.toJSON());
  }

  public loadFromJSON(records: HashChainBlockData[]): void {
    this.blocks = records.map((r) => HashChainBlock.fromJSON(r));
    const latest = this.getLatestBlock();
    if (latest) {
      this.clock.reset(latest.monotonicNs);
    }
  }
}
