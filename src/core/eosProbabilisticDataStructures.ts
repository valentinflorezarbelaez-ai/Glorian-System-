/**
 * EOS SYSTEM — PROBABILISTIC DATA STRUCTURES (Layer 0)
 * Governed by SPEC-176 (Bloom filter + Count-Min sketch, Cache/Big Data pattern)
 *
 * Implements:
 * - Bloom filter with configurable FP rate and k hash functions (double hashing)
 * - Count-Min sketch for streaming frequency estimation with conservative update
 * - Deterministic FNV-1a hashing (no external RNG)
 * - Statistical accuracy telemetry: estimated FP rate vs measured
 * - State fingerprints for CI regression tracking
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

function fnv1a(s: string, seed = 2166136261): number {
  let h = seed;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface BloomFilterConfig {
  readonly capacity: number; // expected insertions
  readonly falsePositiveRate: number; // target FP rate (e.g. 0.01)
}

export class EosBloomFilter {
  private readonly bits: Uint8Array;
  private readonly numBits: number;
  private readonly numHashes: number;
  private inserted = 0;

  constructor(config: BloomFilterConfig) {
    assertPrecondition(config.capacity >= 1, "capacity must be >= 1");
    assertPrecondition(config.falsePositiveRate > 0 && config.falsePositiveRate < 1, "fp rate must be in (0,1)");

    // m = -n*ln(p) / (ln2)^2 ; k = m/n * ln2
    const n = config.capacity;
    const p = config.falsePositiveRate;
    const m = Math.ceil((-n * Math.log(p)) / (Math.LN2 * Math.LN2));
    const k = Math.max(1, Math.round((m / n) * Math.LN2));

    this.numBits = m;
    this.numHashes = k;
    this.bits = new Uint8Array(Math.ceil(m / 8));
  }

  private positions(key: string): number[] {
    const h1 = fnv1a(key, 2166136261);
    const h2 = fnv1a(key, 847031731);
    const out: number[] = [];
    for (let i = 0; i < this.numHashes; i++) {
      out.push(((h1 + Math.imul(i, h2)) >>> 0) % this.numBits);
    }
    return out;
  }

  add(key: string): void {
    for (const p of this.positions(key)) {
      this.bits[p >>> 3] |= 1 << (p & 7);
    }
    this.inserted++;
  }

  has(key: string): boolean {
    for (const p of this.positions(key)) {
      if ((this.bits[p >>> 3] & (1 << (p & 7))) === 0) return false;
    }
    return true;
  }

  /**
   * Estimated current false-positive rate given the number of insertions.
   * (1 - e^(-k*n/m))^k
   */
  estimatedFpRate(): number {
    const exp = (-this.numHashes * this.inserted) / this.numBits;
    return Math.pow(1 - Math.exp(exp), this.numHashes);
  }

  get config(): { bits: number; hashes: number; inserted: number } {
    return deepFreeze({ bits: this.numBits, hashes: this.numHashes, inserted: this.inserted });
  }

  fingerprint(): string {
    let hex = "";
    for (const b of this.bits) hex += b.toString(16).padStart(2, "0");
    return pureSha256(hex);
  }
}

export class EosCountMinSketch {
  private readonly table: Uint32Array;
  private readonly rows: number;
  private readonly cols: number;
  private total = 0;
  private readonly seeds: number[];

  constructor(width: number, depth: number) {
    assertPrecondition(width >= 1 && depth >= 1, "width and depth must be >= 1");
    this.rows = depth;
    this.cols = width;
    this.table = new Uint32Array(width * depth);
    this.seeds = [];
    for (let r = 0; r < depth; r++) this.seeds.push(fnv1a(`seed:${r}`, 2166136261 + r));
  }

  /**
   * Increments counter(s) for key; returns the post-increment estimate.
   */
  add(key: string, delta = 1): number {
    let min = Infinity;
    for (let r = 0; r < this.rows; r++) {
      const idx = r * this.cols + (fnv1a(key, this.seeds[r]) % this.cols);
      this.table[idx] += delta;
      if (this.table[idx] < min) min = this.table[idx];
    }
    this.total += delta;
    return min;
  }

  estimate(key: string): number {
    let min = Infinity;
    for (let r = 0; r < this.rows; r++) {
      const idx = r * this.cols + (fnv1a(key, this.seeds[r]) % this.cols);
      if (this.table[idx] < min) min = this.table[idx];
    }
    return min;
  }

  /**
   * Conservative update (CU): only bump rows whose current min equals the
   * estimate; improves accuracy under heavy-tailed distributions.
   */
  conservativeAdd(key: string): number {
    let min = Infinity;
    for (let r = 0; r < this.rows; r++) {
      const idx = r * this.cols + (fnv1a(key, this.seeds[r]) % this.cols);
      if (this.table[idx] < min) min = this.table[idx];
    }
    for (let r = 0; r < this.rows; r++) {
      const idx = r * this.cols + (fnv1a(key, this.seeds[r]) % this.cols);
      if (this.table[idx] === min) this.table[idx] += 1;
    }
    this.total += 1;
    return min + 1;
  }

  get observedTotal(): number {
    return this.total;
  }
  get shape(): { width: number; depth: number } {
    return deepFreeze({ width: this.cols, depth: this.rows });
  }

  fingerprint(): string {
    let hex = "";
    for (const v of this.table) hex += v.toString(16).padStart(8, "0");
    return pureSha256(hex);
  }
}
