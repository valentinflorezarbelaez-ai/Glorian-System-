/**
 * EOS Layer-0 Verifiable Delay Function Engine
 *
 * SPEC-213 / CHANGE-098 / Wesolowski VDF over RSA Composite Groups
 * Inherently sequential squarings with sub-millisecond logarithmic proof verification.
 *
 * Inviolable Laws:
 * - Law I: Zero Vibe Coding — Proven Wesolowski (2019) cryptographic protocol
 * - Law V: Zero External Runtime Dependencies — pure Node 24 strip-only TypeScript
 * - Law VII: Node module line budget <= 800 lines
 */

import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  DEFAULT_VDF_MODULUS,
  DEFAULT_VDF_DELAY,
  DEFAULT_CHALLENGE_BITS,
  type VdfParameters,
  type WesolowskiProof,
  type VdfEvaluationResult,
  type VdfVerificationResult,
  type VdfReceipt,
  type VdfOperationType,
} from "./eosVerifiableDelayFunctionCore.types.ts";

export { DEFAULT_VDF_MODULUS, DEFAULT_VDF_DELAY, DEFAULT_CHALLENGE_BITS };

/**
 * Fast binary modular exponentiation: (base^exp) mod modulus
 */
export function modPowBigInt(base: bigint, exponent: bigint, modulus: bigint): bigint {
  assertPrecondition(modulus > 1n, `Modulus must be > 1; received ${modulus}`);
  if (exponent === 0n) return 1n;

  let res = 1n;
  let b = base % modulus;
  if (b < 0n) b += modulus;
  let e = exponent;

  while (e > 0n) {
    if (e & 1n) {
      res = (res * b) % modulus;
    }
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return res;
}

/**
 * Computes greatest common divisor using Euclidean algorithm
 */
export function gcdBigInt(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x;
}

/**
 * Deterministic Miller-Rabin primality test for BigInt
 */
export function isProbablePrime(n: bigint, rounds = 16): boolean {
  if (n <= 1n) return false;
  if (n <= 3n) return true;
  if (n % 2n === 0n || n % 3n === 0n) return false;

  let d = n - 1n;
  let s = 0n;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }

  const bases = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
  for (const a of bases) {
    if (n <= a) break;
    let x = modPowBigInt(a, d, n);
    if (x === 1n || x === n - 1n) continue;

    let composite = true;
    for (let r = 1n; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) {
        composite = false;
        break;
      }
    }
    if (composite) return false;
  }
  return true;
}

/**
 * Fiat-Shamir hash-to-prime derivation: derives prime challenge \ell from (x, y, T)
 */
export function hashToPrime(x: bigint, y: bigint, delayT: number, bits = 64): bigint {
  const digest = pureSha256(`${x.toString(16)}:${y.toString(16)}:${delayT}`);
  const rawHex = digest.slice(0, Math.floor(bits / 4));
  let candidate = BigInt("0x" + rawHex);

  // Ensure candidate is odd and has the target bit length
  candidate |= (1n << BigInt(bits - 1)) | 1n;

  while (!isProbablePrime(candidate, 16)) {
    candidate += 2n;
  }
  return candidate;
}

/**
 * EosVerifiableDelayFunctionCore provides verifiable sequential time delay,
 * Wesolowski succinct proof generation, and unbiased randomness beacon generation.
 */
export class EosVerifiableDelayFunctionCore {
  private readonly _params: VdfParameters;

  constructor(customParams?: Partial<VdfParameters>) {
    const modulus = customParams?.modulus ?? DEFAULT_VDF_MODULUS;
    const defaultDelay = customParams?.defaultDelay ?? DEFAULT_VDF_DELAY;
    const challengeBits = customParams?.challengeBits ?? DEFAULT_CHALLENGE_BITS;

    assertPrecondition(modulus > 3n, `Modulus must be > 3; received ${modulus}`);
    assertPrecondition(defaultDelay >= 1, `Delay parameter T must be >= 1; received ${defaultDelay}`);
    assertPrecondition(
      challengeBits >= 32 && challengeBits <= 256,
      `Challenge bits must be in [32, 256]; received ${challengeBits}`,
    );

    this._params = deepFreeze({
      modulus,
      defaultDelay,
      challengeBits,
    });
  }

  public getParameters(): VdfParameters {
    return this._params;
  }

  /**
   * Maps an arbitrary seed string or BigInt to a valid base element x in Z_N^*
   */
  public mapToGroupElement(seed: string | bigint): bigint {
    const { modulus: N } = this._params;
    let x: bigint;

    if (typeof seed === "bigint") {
      x = seed % N;
      if (x < 2n) x = 2n;
    } else {
      const hashHex = pureSha256(seed);
      x = (BigInt("0x" + hashHex) % (N - 3n)) + 2n;
    }

    assertPrecondition(gcdBigInt(x, N) === 1n, `Base element shares factor with modulus`);
    return x;
  }

  /**
   * Evaluates the VDF sequentially: y = x^{2^T} mod N, generates proof \pi and randomness beacon.
   */
  public compute(input: string | bigint, customDelay?: number): VdfEvaluationResult {
    const delayT = customDelay !== undefined ? customDelay : this._params.defaultDelay;
    assertPrecondition(delayT >= 1, `Delay parameter must be >= 1; received ${delayT}`);

    const { modulus: N, challengeBits } = this._params;
    const x = this.mapToGroupElement(input);

    const startTime = performance.now();

    // 1. Inherently sequential squarings: y = x^{2^T} mod N
    let y = x;
    for (let i = 0; i < delayT; i++) {
      y = (y * y) % N;
    }

    // 2. Fiat-Shamir prime challenge: \ell = HashPrime(x, y, T)
    const challengePrime = hashToPrime(x, y, delayT, challengeBits);

    // 3. Quotient division: q_div = floor(2^T / \ell)
    const twoPowerT = 1n << BigInt(delayT);
    const qDiv = twoPowerT / challengePrime;

    // 4. Wesolowski proof: \pi = x^{q_div} mod N
    const pi = modPowBigInt(x, qDiv, N);

    const elapsedMs = performance.now() - startTime;
    const proofHex = pi.toString(16);

    // 5. Unbiased randomness beacon: SHA-256(y)
    const randomnessBeacon = pureSha256(`eos-vdf-beacon:${y.toString(16)}`);

    const proof: WesolowskiProof = deepFreeze({
      pi,
      challengePrime,
      proofHex,
    });

    const receipt = this._createReceipt(
      "compute",
      pureSha256(`${x.toString(16)}:${delayT}`),
      pureSha256(`${y.toString(16)}:${proofHex}`),
    );

    const result: VdfEvaluationResult = deepFreeze({
      x,
      y,
      delayT,
      proof,
      randomnessBeacon,
      elapsedMs,
      receipt,
    });

    assertPostcondition(result.proof.pi < N, "Proof element exceeds modulus");
    return result;
  }

  /**
   * Verifies Wesolowski proof \pi: checks that \pi^\ell * x^{2^T mod \ell} == y mod N
   * Executes in sub-millisecond logarithmic time O(log \ell + log T).
   */
  public verify(x: bigint, y: bigint, delayT: number, proof: WesolowskiProof): VdfVerificationResult {
    const startTime = performance.now();
    const { modulus: N, challengeBits } = this._params;

    assertPrecondition(delayT >= 1, "Delay parameter must be >= 1");
    assertPrecondition(proof.pi >= 1n && proof.pi < N, "Invalid proof element range");

    // 1. Recompute Fiat-Shamir prime challenge \ell
    const expectedPrime = hashToPrime(x, y, delayT, challengeBits);
    if (proof.challengePrime !== expectedPrime) {
      const elapsedMs = performance.now() - startTime;
      return deepFreeze({
        valid: false,
        verificationTimeMs: elapsedMs,
        receipt: this._createReceipt("verify", "challenge_mismatch", "invalid"),
      });
    }

    const ell = proof.challengePrime;

    // 2. Compute remainder r = 2^T mod \ell in O(log T) steps
    const r = modPowBigInt(2n, BigInt(delayT), ell);

    // 3. Fast verification check: \pi^\ell * x^r == y mod N
    const term1 = modPowBigInt(proof.pi, ell, N);
    const term2 = modPowBigInt(x, r, N);
    const reconstructedY = (term1 * term2) % N;

    const valid = reconstructedY === y;
    const verificationTimeMs = performance.now() - startTime;

    const receipt = this._createReceipt(
      "verify",
      pureSha256(`${x.toString(16)}:${y.toString(16)}:${proof.proofHex}`),
      valid ? "VALID" : "FORGED",
    );

    return deepFreeze({
      valid,
      verificationTimeMs,
      receipt,
    });
  }

  /**
   * Generates a tamper-evident randomness beacon from evaluated output y
   */
  public generateBeacon(y: bigint): string {
    return pureSha256(`eos-vdf-beacon:${y.toString(16)}`);
  }

  private _createReceipt(operation: VdfOperationType, inputDigest: string, outputDigest: string): VdfReceipt {
    const timestamp = new Date().toISOString();
    const receiptId = `eos-vdf-${operation}-${pureSha256(`${inputDigest}:${timestamp}`).slice(0, 16)}`;
    const receiptSha256 = pureSha256(JSON.stringify({ receiptId, operation, timestamp, inputDigest, outputDigest }));

    return deepFreeze({
      receiptId,
      operation,
      timestamp,
      inputDigest,
      outputDigest,
      receiptSha256,
    });
  }
}
