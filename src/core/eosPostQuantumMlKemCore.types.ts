/**
 * EOS POST-QUANTUM ML-KEM CORE TYPES (SPEC-221 / NIST FIPS 203)
 *
 * Domain types for Layer-0 Module-Lattice-Based Key-Encapsulation Mechanism
 * parameter set ML-KEM-768 (Category 3 / AES-192 equivalent).
 *
 * Zero external runtime dependencies. Node 24 strip-only TypeScript.
 */

export interface MlKemParams {
  readonly q: number;
  readonly n: number;
  readonly k: number;
  readonly eta1: number;
  readonly eta2: number;
  readonly du: number;
  readonly dv: number;
  readonly publicKeyBytes: number;
  readonly secretKeyBytes: number;
  readonly ciphertextBytes: number;
  readonly sharedSecretBytes: number;
}

export interface MlKem768KeyPair {
  readonly encapsulationKey: Uint8Array; // 1184 bytes
  readonly decapsulationKey: Uint8Array; // 2400 bytes
  readonly receiptSha256: string;
}
export type MlKemKeyPair = MlKem768KeyPair;

export interface MlKem768EncapsulationResult {
  readonly sharedSecret: Uint8Array; // 32 bytes
  readonly ciphertext: Uint8Array; // 1088 bytes
  readonly receiptSha256: string;
}
export type MlKemEncapsulationResult = MlKem768EncapsulationResult;

export interface MlKem768DecapsulationResult {
  readonly sharedSecret: Uint8Array; // 32 bytes
  readonly valid: boolean;
  readonly receiptSha256: string;
}
export type MlKemDecapsulationResult = MlKem768DecapsulationResult;

export interface MlKem768BenchmarkResult {
  readonly keyGenOpsPerSec: number;
  readonly encapsOpsPerSec: number;
  readonly decapsOpsPerSec: number;
  readonly totalDurationMs: number;
  readonly receiptSha256: string;
}
export type MlKemBenchmarkResult = MlKem768BenchmarkResult;

export interface MlKem768Receipt {
  readonly operation: "keygen" | "encaps" | "decaps" | "benchmark";
  readonly timestampIso: string;
  readonly receiptSha256: string;
  readonly details: Readonly<Record<string, unknown>>;
}
export type MlKemReceipt = MlKem768Receipt;
