/**
 * @file eosHyperLogLogPlusCore.types.ts
 * @module EosHyperLogLogPlusCore/Types
 * @description Type definitions for Layer-0 HyperLogLog++ cardinality estimation engine.
 * SPEC-232 / CHANGE-117
 */

export interface HyperLogLogConfig {
  /**
   * Precision parameter p in range [4, 18] (default: 14).
   * Determines register count m = 2^p and theoretical standard error 1.04 / sqrt(m).
   */
  precision?: number;
}

export interface HyperLogLogStats {
  precision: number;
  registerCount: number;
  estimate: number;
  standardError: number;
  zeroRegisters: number;
  memoryBytes: number;
}

export interface HllHashComponents {
  hashHex: string;
  registerIndex: number;
  leadingZeros: number;
}
