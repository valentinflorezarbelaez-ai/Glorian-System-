/**
 * EOS SYSTEM — LAYER-0 TIME-LOCK PUZZLE ENGINE (SPEC-230)
 *
 * Provable timed-release encryption based on:
 * 1. Rivest-Shamir-Wagner (RSW96) sequential modular squarings with $O(\log T)$ trapdoor generation
 * 2. Authenticated AES-256-GCM symmetric payload encapsulation
 * 3. Sloth modular square-root permutation with $O(\log T)$ verification
 * 4. Verifiable intermediate progress checkpoints
 *
 * Hardware-independent sequential computation. Zero external runtime dependencies.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type {
  CheckpointVerificationResult,
  PuzzleSolution,
  SlothPuzzle,
  SlothSolution,
  TimeLockPuzzle,
  TimeLockTrapdoor,
} from "./eosTimeLockPuzzleCore.types.ts";

/**
 * Standard SECP256K1 Prime (p = 2^256 - 2^32 - 977 = 3 mod 4).
 */
export const SLOTH_SECP256K1_PRIME = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;

/**
 * Pre-computed 1024-bit composite modulus trapdoor for deterministic evaluation.
 */
export const STANDARD_RSW_TRAPDOOR: TimeLockTrapdoor = {
  p: BigInt(
    "0xf424a4564a895134b306dc3942904079286ed37d3e4438f6d24d0d9623bf72d38218c0e862466471f91fb49ff5f659b9dd4eb69d7c0edff64e1451b411aa6941",
  ),
  q: BigInt(
    "0xeba06ba5548725ca045bc9a41f842230d95f6f27f2a62dd1959cbe139f8598037504c31db5d1965513f30460dfd8468464011e401e474867978b85cc438b19f5",
  ),
  phi:
    (BigInt(
      "0xf424a4564a895134b306dc3942904079286ed37d3e4438f6d24d0d9623bf72d38218c0e862466471f91fb49ff5f659b9dd4eb69d7c0edff64e1451b411aa6941",
    ) -
      1n) *
    (BigInt(
      "0xeba06ba5548725ca045bc9a41f842230d95f6f27f2a62dd1959cbe139f8598037504c31db5d1965513f30460dfd8468464011e401e474867978b85cc438b19f5",
    ) -
      1n),
};

export class EosTimeLockPuzzleCore {
  /**
   * Arbitrary-precision modular exponentiation: (base^exp) mod modulus.
   */
  static modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    if (mod === 1n) return 0n;
    let res = 1n;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0n) {
      if ((e & 1n) === 1n) {
        res = (res * b) % mod;
      }
      b = (b * b) % mod;
      e >>= 1n;
    }
    return res;
  }

  /**
   * Generates a 256-bit symmetric encryption key from a BigInt seed via SHA-256.
   */
  static deriveKey(seed: bigint): Buffer {
    let hex = seed.toString(16);
    if (hex.length % 2 !== 0) hex = "0" + hex;
    return createHash("sha256").update(Buffer.from(hex, "hex")).digest();
  }

  /**
   * Creates an RSW96 time-lock puzzle in O(log T) time using the creator trapdoor.
   * Encapsulates the secret payload with authenticated AES-256-GCM.
   */
  static createPuzzle(
    message: string,
    difficultyT: number,
    trapdoor: TimeLockTrapdoor = STANDARD_RSW_TRAPDOOR,
    generatorA: bigint = 2n,
    checkpointInterval?: number,
  ): TimeLockPuzzle {
    if (difficultyT < 1) {
      throw new Error("createPuzzle: difficultyT must be >= 1");
    }

    const N = trapdoor.p * trapdoor.q;
    const a = generatorA % N;

    // Fast shortcut using Euler's totient theorem: e = 2^T mod phi(N)
    const expT = BigInt(difficultyT);
    const e = EosTimeLockPuzzleCore.modPow(2n, expT, trapdoor.phi);
    const keySeed = EosTimeLockPuzzleCore.modPow(a, e, N);

    // Derive symmetric key
    const aesKey = EosTimeLockPuzzleCore.deriveKey(keySeed);
    const iv = randomBytes(12);

    const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(message, "utf8")), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      modulusHex: N.toString(16),
      generatorHex: a.toString(16),
      difficultyT,
      ivHex: iv.toString("hex"),
      authTagHex: authTag.toString("hex"),
      ciphertextHex: ciphertext.toString("hex"),
      checkpointInterval,
    };
  }

  /**
   * Solves an RSW96 time-lock puzzle without the trapdoor by performing T sequential squarings.
   * Decrypts the secret message and verifies the AES-GCM authentication tag.
   */
  static solvePuzzle(puzzle: TimeLockPuzzle): PuzzleSolution {
    const startTime = Date.now();
    const N = BigInt("0x" + puzzle.modulusHex);
    const a = BigInt("0x" + puzzle.generatorHex);
    const T = puzzle.difficultyT;
    const interval = puzzle.checkpointInterval;

    let y = a % N;
    const checkpointsHex: string[] = [y.toString(16)];

    for (let i = 1; i <= T; i++) {
      y = (y * y) % N;
      if (interval && interval > 0 && i % interval === 0) {
        checkpointsHex.push(y.toString(16));
      }
    }

    // Derive key and decrypt payload
    const aesKey = EosTimeLockPuzzleCore.deriveKey(y);
    const iv = Buffer.from(puzzle.ivHex, "hex");
    const authTag = Buffer.from(puzzle.authTagHex, "hex");
    const ciphertext = Buffer.from(puzzle.ciphertextHex, "hex");

    const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
    decipher.setAuthTag(authTag);

    let plaintext = "";
    try {
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      throw new Error(
        "solvePuzzle: Decryption integrity verification failed — corrupted ciphertext, auth tag, or incorrect key",
      );
    }

    const elapsedMs = Date.now() - startTime;

    return {
      plaintext,
      keyHex: aesKey.toString("hex"),
      squaringsPerformed: T,
      checkpointsHex: interval ? checkpointsHex : undefined,
      elapsedMs,
    };
  }

  /**
   * Verifies an intermediate checkpoint transition: y_next = y_prev^(2^segmentSteps) mod N.
   */
  static verifyCheckpointSegment(
    modulusHex: string,
    fromStateHex: string,
    toStateHex: string,
    segmentSteps: number,
    segmentIndex = 0,
  ): CheckpointVerificationResult {
    const N = BigInt("0x" + modulusHex);
    const fromState = BigInt("0x" + fromStateHex);
    const expectedState = BigInt("0x" + toStateHex);

    let cur = fromState % N;
    for (let i = 0; i < segmentSteps; i++) {
      cur = (cur * cur) % N;
    }

    const valid = cur === expectedState;

    return {
      valid,
      segmentIndex,
      segmentSteps,
      fromStateHex,
      toStateHex,
    };
  }

  /**
   * Creates a Sloth time-lock puzzle over prime p = 3 mod 4.
   */
  static createSlothPuzzle(
    message: string,
    iterations: number,
    seed = 123456789n,
    prime: bigint = SLOTH_SECP256K1_PRIME,
  ): SlothPuzzle {
    if (prime % 4n !== 3n) {
      throw new Error("createSlothPuzzle: prime must satisfy p = 3 mod 4");
    }
    if (iterations < 1) {
      throw new Error("createSlothPuzzle: iterations must be >= 1");
    }

    // Ensure input x0 is a quadratic residue
    const x0 = EosTimeLockPuzzleCore.modPow(seed, 2n, prime);

    // Compute target state x_T by running T square roots or fast squaring
    let cur = x0;
    const sqrtExp = (prime + 1n) / 4n;
    for (let i = 0; i < iterations; i++) {
      cur = EosTimeLockPuzzleCore.modPow(cur, sqrtExp, prime);
    }

    // Derive symmetric key from x_T
    const aesKey = EosTimeLockPuzzleCore.deriveKey(cur);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(message, "utf8")), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      primeHex: prime.toString(16),
      iterations,
      inputHex: x0.toString(16),
      ciphertextHex: ciphertext.toString("hex"),
      ivHex: iv.toString("hex"),
      authTagHex: authTag.toString("hex"),
    };
  }

  /**
   * Solves a Sloth time-lock puzzle by executing T sequential modular square roots.
   */
  static solveSlothPuzzle(puzzle: SlothPuzzle): SlothSolution {
    const prime = BigInt("0x" + puzzle.primeHex);
    let cur = BigInt("0x" + puzzle.inputHex);
    const sqrtExp = (prime + 1n) / 4n;

    for (let i = 0; i < puzzle.iterations; i++) {
      cur = EosTimeLockPuzzleCore.modPow(cur, sqrtExp, prime);
    }

    let plaintext: string | undefined;
    if (puzzle.ciphertextHex && puzzle.ivHex && puzzle.authTagHex) {
      const aesKey = EosTimeLockPuzzleCore.deriveKey(cur);
      const iv = Buffer.from(puzzle.ivHex, "hex");
      const authTag = Buffer.from(puzzle.authTagHex, "hex");
      const ciphertext = Buffer.from(puzzle.ciphertextHex, "hex");

      const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
      decipher.setAuthTag(authTag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    }

    return {
      outputHex: cur.toString(16),
      plaintext,
      iterations: puzzle.iterations,
    };
  }

  /**
   * Fast verification of Sloth square-root sequence in O(log T) modular exponentiation.
   * Checks whether x_T^(2^T) = x0 mod p.
   */
  static verifySloth(primeHex: string, inputHex: string, outputHex: string, iterations: number): boolean {
    const prime = BigInt("0x" + primeHex);
    const x0 = BigInt("0x" + inputHex);
    const xT = BigInt("0x" + outputHex);

    // Fast exponentiation: exp = 2^T mod (prime - 1)
    const exp = EosTimeLockPuzzleCore.modPow(2n, BigInt(iterations), prime - 1n);
    const reconstructedX0 = EosTimeLockPuzzleCore.modPow(xT, exp, prime);

    return reconstructedX0 === x0;
  }
}
