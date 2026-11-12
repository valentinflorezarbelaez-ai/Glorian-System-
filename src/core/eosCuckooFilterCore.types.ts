/**
 * @file eosCuckooFilterCore.types.ts
 * @module EosCuckooFilterCore/Types
 * @description Type definitions for Layer-0 Cuckoo Filter engine.
 * SPEC-231 / CHANGE-116
 */

export interface CuckooFilterConfig {
  /** Approximate target capacity (number of elements). Rounded up to determine power-of-two bucket count. */
  capacity?: number;
  /** Explicit power-of-two bucket count. If provided, overrides capacity calculation. */
  bucketCount?: number;
  /** Number of entries stored per bucket (default: 4). */
  slotsPerBucket?: number;
  /** Fingerprint size in bits (8 or 16, default: 8). */
  fingerprintBits?: 8 | 16;
  /** Maximum cuckoo displacement kicks before declaring table full (default: 500). */
  maxKicks?: number;
}

export interface CuckooFilterStats {
  capacity: number;
  count: number;
  loadFactor: number;
  bucketCount: number;
  slotsPerBucket: number;
  fingerprintBits: 8 | 16;
  maxKicks: number;
  memoryBytes: number;
}

export interface CuckooInsertResult {
  success: boolean;
  kickedCount: number;
}

export interface CuckooHashPair {
  fingerprint: number;
  i1: number;
  i2: number;
}
