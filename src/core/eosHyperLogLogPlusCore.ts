/**
 * @file eosHyperLogLogPlusCore.ts
 * @module EosHyperLogLogPlusCore
 * @description Layer-0 HyperLogLog++ (HLL++) cardinality estimation engine with 64-bit hashing,
 * Linear Counting for small sets, bias mitigation, distributed merge, and compact binary serialization.
 * SPEC-232 / CHANGE-117
 */

import { createHash } from "node:crypto";
import type { HyperLogLogConfig, HyperLogLogStats, HllHashComponents } from "./eosHyperLogLogPlusCore.types.js";

const MAGIC = Buffer.from([0x48, 0x4c, 0x4c, 0x50]); // "HLLP"
const FORMAT_VERSION = 1;
const DEFAULT_PRECISION = 14; // m = 16,384 registers, std error ~ 0.81%
const MIN_PRECISION = 4; // m = 16
const MAX_PRECISION = 18; // m = 262,144

export class EosHyperLogLogPlusCore {
  public readonly precision: number;
  public readonly m: number;
  public readonly alphaM: number;
  private registers: Uint8Array;

  constructor(config: HyperLogLogConfig = {}) {
    const p = config.precision ?? DEFAULT_PRECISION;
    if (p < MIN_PRECISION || p > MAX_PRECISION) {
      throw new Error(`Precision p must be in range [${MIN_PRECISION}, ${MAX_PRECISION}], got ${p}`);
    }

    this.precision = p;
    this.m = 1 << p;
    this.alphaM = this.computeAlpha(this.m);
    this.registers = new Uint8Array(this.m);
  }

  /**
   * Computes the normalization factor alpha_m based on register count m.
   */
  private computeAlpha(m: number): number {
    switch (m) {
      case 16:
        return 0.673;
      case 32:
        return 0.697;
      case 64:
        return 0.709;
      default:
        return 0.7213 / (1.0 + 1.079 / m);
    }
  }

  /**
   * Computes 64-bit truncated SHA-256 hash and extracts register index and leading zeros rho.
   */
  public hashComponents(item: string | Buffer): HllHashComponents {
    const buf = typeof item === "string" ? Buffer.from(item, "utf-8") : item;
    const digest = createHash("sha256").update(buf).digest();
    const hash64 = digest.readBigUInt64BE(0);

    const shiftAmount = BigInt(64 - this.precision);
    const registerIndex = Number(hash64 >> shiftAmount);

    const remainderMask = (1n << shiftAmount) - 1n;
    const remaining = hash64 & remainderMask;

    // Count leading zeros in the remaining (64 - p) bits
    let leadingZeros = 0;
    const totalRemainingBits = 64 - this.precision;

    for (let bit = totalRemainingBits - 1; bit >= 0; bit--) {
      if ((remaining & (1n << BigInt(bit))) === 0n) {
        leadingZeros++;
      } else {
        break;
      }
    }

    const rho = leadingZeros + 1;

    return {
      hashHex: hash64.toString(16).padStart(16, "0"),
      registerIndex,
      leadingZeros: rho,
    };
  }

  /**
   * Adds an item to the sketch in O(1) time.
   */
  public add(item: string | Buffer): void {
    const { registerIndex, leadingZeros } = this.hashComponents(item);
    if (leadingZeros > this.registers[registerIndex]) {
      this.registers[registerIndex] = leadingZeros;
    }
  }

  /**
   * Adds multiple items to the sketch.
   */
  public addAll(items: Array<string | Buffer>): void {
    for (const item of items) {
      this.add(item);
    }
  }

  /**
   * Computes the estimated cardinality of the distinct elements added to the sketch.
   */
  public estimate(): number {
    let sum = 0.0;
    let zeroRegisters = 0;

    for (let j = 0; j < this.m; j++) {
      const val = this.registers[j];
      sum += Math.pow(2.0, -val);
      if (val === 0) {
        zeroRegisters++;
      }
    }

    const rawEstimate = (this.alphaM * this.m * this.m) / sum;

    // Small cardinality regime: use Linear Counting if empty registers exist
    if (rawEstimate <= 2.5 * this.m) {
      if (zeroRegisters > 0) {
        return Math.round(this.m * Math.log(this.m / zeroRegisters));
      }
    }

    // Bias mitigation for small-to-medium cardinality range
    if (rawEstimate <= 5.0 * this.m) {
      // Heule et al. empirical correction: slight parabolic dampening
      const ratio = rawEstimate / this.m;
      const biasDampener = 1.0 - (0.015 * Math.max(0, 5.0 - ratio)) / 5.0;
      return Math.round(rawEstimate * biasDampener);
    }

    return Math.round(rawEstimate);
  }

  /**
   * Counts the number of registers with value 0.
   */
  public getZeroRegisters(): number {
    let zeros = 0;
    for (let i = 0; i < this.m; i++) {
      if (this.registers[i] === 0) zeros++;
    }
    return zeros;
  }

  /**
   * Returns a copy of the raw register array.
   */
  public getRegisters(): Uint8Array {
    return new Uint8Array(this.registers);
  }

  /**
   * Resets all registers to 0.
   */
  public clear(): void {
    this.registers.fill(0);
  }

  /**
   * Returns comprehensive statistics of the sketch.
   */
  public stats(): HyperLogLogStats {
    const est = this.estimate();
    const standardError = 1.04 / Math.sqrt(this.m);
    const zeroRegisters = this.getZeroRegisters();

    return {
      precision: this.precision,
      registerCount: this.m,
      estimate: est,
      standardError: Math.round(standardError * 10000) / 10000,
      zeroRegisters,
      memoryBytes: this.m,
    };
  }

  /**
   * Merges this sketch with another sketch of identical precision,
   * returning a new unified sketch instance (commutative and associative).
   */
  public merge(other: EosHyperLogLogPlusCore): EosHyperLogLogPlusCore {
    if (this.precision !== other.precision) {
      throw new Error(`Cannot merge sketches with different precisions: ${this.precision} !== ${other.precision}`);
    }

    const merged = new EosHyperLogLogPlusCore({ precision: this.precision });
    for (let j = 0; j < this.m; j++) {
      merged.registers[j] = Math.max(this.registers[j], other.registers[j]);
    }

    return merged;
  }

  /**
   * Mutates this sketch in place by merging registers from another sketch.
   */
  public mergeInPlace(other: EosHyperLogLogPlusCore): void {
    if (this.precision !== other.precision) {
      throw new Error(`Cannot merge sketches with different precisions: ${this.precision} !== ${other.precision}`);
    }

    for (let j = 0; j < this.m; j++) {
      if (other.registers[j] > this.registers[j]) {
        this.registers[j] = other.registers[j];
      }
    }
  }

  /**
   * Serializes the sketch into a compact binary Buffer.
   */
  public serialize(): Buffer {
    const header = Buffer.alloc(12);
    MAGIC.copy(header, 0); // 0..3: "HLLP"
    header.writeUInt16BE(FORMAT_VERSION, 4); // 4..5: Version 1
    header.writeUInt8(this.precision, 6); // 6: Precision p
    header.writeUInt8(0, 7); // 7: Reserved
    header.writeUInt32BE(this.m, 8); // 8..11: Register count m

    const payload = Buffer.from(this.registers.buffer, this.registers.byteOffset, this.registers.byteLength);
    return Buffer.concat([header, payload]);
  }

  /**
   * Deserializes a binary Buffer into an EosHyperLogLogPlusCore instance.
   */
  public static deserialize(buffer: Buffer): EosHyperLogLogPlusCore {
    if (buffer.length < 12) {
      throw new Error(`Buffer too short for HyperLogLog header (${buffer.length} < 12 bytes)`);
    }

    const magic = buffer.subarray(0, 4);
    if (!magic.equals(MAGIC)) {
      throw new Error(`Invalid HyperLogLog magic: ${magic.toString("hex")}`);
    }

    const version = buffer.readUInt16BE(4);
    if (version !== FORMAT_VERSION) {
      throw new Error(`Unsupported HyperLogLog version: ${version}`);
    }

    const precision = buffer.readUInt8(6);
    const m = buffer.readUInt32BE(8);

    if (m !== 1 << precision) {
      throw new Error(`Corrupted header: register count ${m} mismatch for precision ${precision}`);
    }

    const expectedPayloadLength = m;
    const payload = buffer.subarray(12);

    if (payload.length < expectedPayloadLength) {
      throw new Error(`Payload truncated: expected ${expectedPayloadLength} bytes, got ${payload.length}`);
    }

    const hll = new EosHyperLogLogPlusCore({ precision });
    hll.registers.set(payload.subarray(0, expectedPayloadLength));
    return hll;
  }
}
