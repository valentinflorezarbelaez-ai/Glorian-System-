/**
 * EOS SYSTEM — LAYER-0 TIME-LOCK PUZZLE ENGINE (SPEC-230)
 * Type Definitions & Interfaces
 *
 * Provable timed-release encryption based on Rivest-Shamir-Wagner (RSW96)
 * sequential modular squarings and Sloth modular square-root permutations.
 *
 * Zero external runtime dependencies.
 */

export interface TimeLockTrapdoor {
  readonly p: bigint;
  readonly q: bigint;
  readonly phi: bigint;
}

export interface TimeLockPuzzle {
  /** Modulus N = p * q in hexadecimal */
  readonly modulusHex: string;
  /** Generator base a in hexadecimal */
  readonly generatorHex: string;
  /** Difficulty parameter T (total sequential squarings required) */
  readonly difficultyT: number;
  /** Initialization vector (96-bit) for AES-256-GCM in hexadecimal */
  readonly ivHex: string;
  /** Authentication tag (128-bit) for AES-256-GCM in hexadecimal */
  readonly authTagHex: string;
  /** Ciphertext containing the encrypted confidential payload */
  readonly ciphertextHex: string;
  /** Optional checkpoint interval k (snapshots every k squarings) */
  readonly checkpointInterval?: number;
}

export interface PuzzleSolution {
  /** Decrypted plaintext message */
  readonly plaintext: string;
  /** Symmetric key derived from y = a^(2^T) mod N */
  readonly keyHex: string;
  /** Number of squarings evaluated */
  readonly squaringsPerformed: number;
  /** Intermediate checkpoint states (hexadecimal) */
  readonly checkpointsHex?: string[];
  /** Execution duration in milliseconds */
  readonly elapsedMs: number;
}

export interface SlothPuzzle {
  /** Prime modulus p (p = 3 mod 4) in hexadecimal */
  readonly primeHex: string;
  /** Number of square-root iterations T */
  readonly iterations: number;
  /** Initial input state x0 in hexadecimal */
  readonly inputHex: string;
  /** Optional encrypted ciphertext */
  readonly ciphertextHex?: string;
  /** Optional IV for authenticated decryption */
  readonly ivHex?: string;
  /** Optional auth tag */
  readonly authTagHex?: string;
}

export interface SlothSolution {
  /** Output state x_T after T modular square roots in hexadecimal */
  readonly outputHex: string;
  /** Decrypted message if ciphertext was included */
  readonly plaintext?: string;
  /** Iteration count verified */
  readonly iterations: number;
}

export interface CheckpointVerificationResult {
  readonly valid: boolean;
  readonly segmentIndex: number;
  readonly segmentSteps: number;
  readonly fromStateHex: string;
  readonly toStateHex: string;
}
