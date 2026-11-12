/**
 * @file eosCuckooFilterCore.ts
 * @module EosCuckooFilterCore
 * @description Layer-0 Cuckoo Filter for dynamic set membership, partial-key hashing,
 * bounded displacement kicks, true deletion, and compact binary serialization.
 * SPEC-231 / CHANGE-116
 */

import { createHash } from "node:crypto";
import type {
  CuckooFilterConfig,
  CuckooFilterStats,
  CuckooInsertResult,
  CuckooHashPair,
} from "./eosCuckooFilterCore.types.js";

const MAGIC = Buffer.from([0x43, 0x4b, 0x46, 0x4c]); // "CKFL"
const FORMAT_VERSION = 1;
const DEFAULT_SLOTS_PER_BUCKET = 4;
const DEFAULT_MAX_KICKS = 500;
const DEFAULT_FINGERPRINT_BITS = 8;
const DEFAULT_CAPACITY = 1024;

export class EosCuckooFilterCore {
  private readonly slotsPerBucket: number;
  private readonly fingerprintBits: 8 | 16;
  private readonly bucketCount: number;
  private readonly maxKicks: number;
  private table: Uint8Array | Uint16Array;
  private elementCount: number = 0;

  constructor(config: CuckooFilterConfig = {}) {
    this.slotsPerBucket = config.slotsPerBucket ?? DEFAULT_SLOTS_PER_BUCKET;
    this.fingerprintBits = config.fingerprintBits ?? DEFAULT_FINGERPRINT_BITS;
    this.maxKicks = config.maxKicks ?? DEFAULT_MAX_KICKS;

    if (this.slotsPerBucket <= 0) {
      throw new Error(`slotsPerBucket must be positive, got ${this.slotsPerBucket}`);
    }
    if (this.fingerprintBits !== 8 && this.fingerprintBits !== 16) {
      throw new Error(`fingerprintBits must be 8 or 16, got ${this.fingerprintBits}`);
    }

    if (config.bucketCount !== undefined) {
      this.bucketCount = this.roundUpToPowerOfTwo(config.bucketCount);
    } else {
      const targetCapacity = config.capacity ?? DEFAULT_CAPACITY;
      const targetBuckets = Math.ceil(targetCapacity / this.slotsPerBucket);
      this.bucketCount = this.roundUpToPowerOfTwo(Math.max(4, targetBuckets));
    }

    const totalSlots = this.bucketCount * this.slotsPerBucket;
    this.table = this.fingerprintBits === 8 ? new Uint8Array(totalSlots) : new Uint16Array(totalSlots);
  }

  /**
   * Rounds a positive integer up to the next power of two.
   */
  private roundUpToPowerOfTwo(n: number): number {
    let power = 1;
    while (power < n) {
      power <<= 1;
    }
    return Math.max(power, 2);
  }

  /**
   * Computes the non-zero fingerprint for an item.
   * Guaranteed to be in [1, 2^f - 1].
   */
  public getFingerprint(item: string | Buffer): number {
    const buf = typeof item === "string" ? Buffer.from(item, "utf-8") : item;
    const digest = createHash("sha256").update(buf).digest();

    let fp: number;
    if (this.fingerprintBits === 8) {
      fp = digest[4] & 0xff;
      if (fp === 0) fp = 1;
    } else {
      fp = digest.readUInt16BE(4) & 0xffff;
      if (fp === 0) fp = 1;
    }
    return fp;
  }

  /**
   * Hashes a fingerprint to a bucket offset within [0, bucketCount - 1].
   */
  public hashFp(fp: number): number {
    const fpBuf = Buffer.allocUnsafe(2);
    fpBuf.writeUInt16BE(fp, 0);
    const digest = createHash("sha256").update(fpBuf).digest();
    let h = digest.readUInt32BE(0) & (this.bucketCount - 1);
    // If h is 0 and bucketCount > 1, adjust to 1 to ensure alternate bucket differs
    if (h === 0 && this.bucketCount > 1) {
      h = 1;
    }
    return h;
  }

  /**
   * Computes the primary bucket index for an item.
   */
  public getPrimaryIndex(item: string | Buffer): number {
    const buf = typeof item === "string" ? Buffer.from(item, "utf-8") : item;
    const digest = createHash("sha256").update(buf).digest();
    return digest.readUInt32BE(0) & (this.bucketCount - 1);
  }

  /**
   * Computes alternate bucket index given current index and fingerprint.
   * Symmetrical involution: alt(alt(i, fp), fp) === i.
   */
  public getAltIndex(index: number, fp: number): number {
    const h = this.hashFp(fp);
    return (index ^ h) & (this.bucketCount - 1);
  }

  /**
   * Computes both bucket indices and fingerprint for an item.
   */
  public computeHashPair(item: string | Buffer): CuckooHashPair {
    const fp = this.getFingerprint(item);
    const i1 = this.getPrimaryIndex(item);
    const i2 = this.getAltIndex(i1, fp);
    return { fingerprint: fp, i1, i2 };
  }

  /**
   * Reads the fingerprint at a specific bucket and slot index.
   */
  private getSlot(bucketIndex: number, slotIndex: number): number {
    return this.table[bucketIndex * this.slotsPerBucket + slotIndex];
  }

  /**
   * Writes the fingerprint at a specific bucket and slot index.
   */
  private setSlot(bucketIndex: number, slotIndex: number, fp: number): void {
    this.table[bucketIndex * this.slotsPerBucket + slotIndex] = fp;
  }

  /**
   * Finds an empty slot in a bucket. Returns slot index or -1 if full.
   */
  private findEmptySlot(bucketIndex: number): number {
    const offset = bucketIndex * this.slotsPerBucket;
    for (let s = 0; s < this.slotsPerBucket; s++) {
      if (this.table[offset + s] === 0) {
        return s;
      }
    }
    return -1;
  }

  /**
   * Tests whether an item is likely present in the set.
   * False negatives are impossible unless the item was never inserted or deleted.
   */
  public contains(item: string | Buffer): boolean {
    const { fingerprint, i1, i2 } = this.computeHashPair(item);

    // Check bucket i1
    const offset1 = i1 * this.slotsPerBucket;
    for (let s = 0; s < this.slotsPerBucket; s++) {
      if (this.table[offset1 + s] === fingerprint) {
        return true;
      }
    }

    // Check bucket i2
    const offset2 = i2 * this.slotsPerBucket;
    for (let s = 0; s < this.slotsPerBucket; s++) {
      if (this.table[offset2 + s] === fingerprint) {
        return true;
      }
    }

    return false;
  }

  /**
   * Inserts an item into the cuckoo filter.
   * Resolves collisions via recursive cuckoo displacements up to maxKicks.
   */
  public insert(item: string | Buffer): CuckooInsertResult {
    const { fingerprint, i1, i2 } = this.computeHashPair(item);

    // Try primary bucket
    const emptySlot1 = this.findEmptySlot(i1);
    if (emptySlot1 !== -1) {
      this.setSlot(i1, emptySlot1, fingerprint);
      this.elementCount++;
      return { success: true, kickedCount: 0 };
    }

    // Try secondary bucket
    const emptySlot2 = this.findEmptySlot(i2);
    if (emptySlot2 !== -1) {
      this.setSlot(i2, emptySlot2, fingerprint);
      this.elementCount++;
      return { success: true, kickedCount: 0 };
    }

    // Both buckets full — perform cuckoo kick displacement
    let curBucket = Math.random() < 0.5 ? i1 : i2;
    let curFp = fingerprint;

    for (let kick = 0; kick < this.maxKicks; kick++) {
      // Pick random slot in curBucket
      const randomSlot = Math.floor(Math.random() * this.slotsPerBucket);
      const displacedFp = this.getSlot(curBucket, randomSlot);
      this.setSlot(curBucket, randomSlot, curFp);
      curFp = displacedFp;

      // Find alternate bucket for the displaced fingerprint
      curBucket = this.getAltIndex(curBucket, curFp);

      const emptySlot = this.findEmptySlot(curBucket);
      if (emptySlot !== -1) {
        this.setSlot(curBucket, emptySlot, curFp);
        this.elementCount++;
        return { success: true, kickedCount: kick + 1 };
      }
    }

    // Table is full (could not place element after maxKicks)
    return { success: false, kickedCount: this.maxKicks };
  }

  /**
   * Deletes an item from the cuckoo filter.
   * Returns true if found and removed, false if not found.
   */
  public delete(item: string | Buffer): boolean {
    const { fingerprint, i1, i2 } = this.computeHashPair(item);

    // Check bucket i1
    const offset1 = i1 * this.slotsPerBucket;
    for (let s = 0; s < this.slotsPerBucket; s++) {
      if (this.table[offset1 + s] === fingerprint) {
        this.table[offset1 + s] = 0;
        this.elementCount--;
        return true;
      }
    }

    // Check bucket i2
    const offset2 = i2 * this.slotsPerBucket;
    for (let s = 0; s < this.slotsPerBucket; s++) {
      if (this.table[offset2 + s] === fingerprint) {
        this.table[offset2 + s] = 0;
        this.elementCount--;
        return true;
      }
    }

    return false;
  }

  /**
   * Clears the filter, resetting all slots to 0.
   */
  public clear(): void {
    this.table.fill(0);
    this.elementCount = 0;
  }

  /**
   * Returns runtime statistics of the filter.
   */
  public stats(): CuckooFilterStats {
    const capacity = this.bucketCount * this.slotsPerBucket;
    const loadFactor = capacity > 0 ? this.elementCount / capacity : 0;
    const bytesPerSlot = this.fingerprintBits === 8 ? 1 : 2;
    const memoryBytes = capacity * bytesPerSlot;

    return {
      capacity,
      count: this.elementCount,
      loadFactor: Math.round(loadFactor * 10000) / 10000,
      bucketCount: this.bucketCount,
      slotsPerBucket: this.slotsPerBucket,
      fingerprintBits: this.fingerprintBits,
      maxKicks: this.maxKicks,
      memoryBytes,
    };
  }

  /**
   * Serializes the filter into a compact binary Buffer.
   */
  public serialize(): Buffer {
    const header = Buffer.alloc(20);
    MAGIC.copy(header, 0); // 0..3: "CKFL"
    header.writeUInt16BE(FORMAT_VERSION, 4); // 4..5: Version 1
    header.writeUInt8(this.fingerprintBits, 6); // 6: 8 or 16
    header.writeUInt8(this.slotsPerBucket, 7); // 7: slots
    header.writeUInt32BE(this.bucketCount, 8); // 8..11: bucketCount
    header.writeUInt32BE(this.elementCount, 12); // 12..15: elementCount
    header.writeUInt32BE(this.maxKicks, 16); // 16..19: maxKicks

    let payload: Buffer;
    if (this.fingerprintBits === 8) {
      payload = Buffer.from(this.table.buffer, this.table.byteOffset, this.table.byteLength);
    } else {
      // 16-bit: ensure Big-Endian encoding
      payload = Buffer.allocUnsafe(this.table.length * 2);
      const u16 = this.table as Uint16Array;
      for (let i = 0; i < u16.length; i++) {
        payload.writeUInt16BE(u16[i], i * 2);
      }
    }

    return Buffer.concat([header, payload]);
  }

  /**
   * Deserializes a binary Buffer back into an EosCuckooFilterCore instance.
   */
  public static deserialize(buffer: Buffer): EosCuckooFilterCore {
    if (buffer.length < 20) {
      throw new Error(`Buffer too short for CuckooFilter header (${buffer.length} < 20 bytes)`);
    }

    const magic = buffer.subarray(0, 4);
    if (!magic.equals(MAGIC)) {
      throw new Error(`Invalid CuckooFilter magic: ${magic.toString("hex")}`);
    }

    const version = buffer.readUInt16BE(4);
    if (version !== FORMAT_VERSION) {
      throw new Error(`Unsupported CuckooFilter version: ${version}`);
    }

    const fingerprintBits = buffer.readUInt8(6) as 8 | 16;
    const slotsPerBucket = buffer.readUInt8(7);
    const bucketCount = buffer.readUInt32BE(8);
    const elementCount = buffer.readUInt32BE(12);
    const maxKicks = buffer.readUInt32BE(16);

    const filter = new EosCuckooFilterCore({
      bucketCount,
      slotsPerBucket,
      fingerprintBits,
      maxKicks,
    });

    const payload = buffer.subarray(20);
    const totalSlots = bucketCount * slotsPerBucket;

    if (fingerprintBits === 8) {
      if (payload.length < totalSlots) {
        throw new Error(`Payload truncated: expected ${totalSlots} bytes, got ${payload.length}`);
      }
      filter.table = new Uint8Array(payload.buffer, payload.byteOffset, totalSlots);
    } else {
      if (payload.length < totalSlots * 2) {
        throw new Error(`Payload truncated: expected ${totalSlots * 2} bytes, got ${payload.length}`);
      }
      const u16 = new Uint16Array(totalSlots);
      for (let i = 0; i < totalSlots; i++) {
        u16[i] = payload.readUInt16BE(i * 2);
      }
      filter.table = u16;
    }

    filter.elementCount = elementCount;
    return filter;
  }
}
