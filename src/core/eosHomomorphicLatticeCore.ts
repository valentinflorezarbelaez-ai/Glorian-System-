/**
 * EOS Layer-0 Lattice-Based Homomorphic Encryption Core
 *
 * SPEC-211 / CHANGE-096 / Ring Learning with Errors (RLWE) BFV-style SHE
 * Cyclotomic quotient polynomial ring: R_q = Z_q[X] / (X^N + 1)
 *
 * Inviolable Laws:
 * - Law I: Zero Vibe Coding — Proven algebraic RLWE/BFV construction
 * - Law V: Zero External Runtime Dependencies — pure Node 24 strip-only TypeScript
 * - Law VII: Node module line budget <= 800 lines
 */

import crypto from "node:crypto";
import {
  assertPrecondition,
  assertPostcondition,
  deepFreeze,
  pureSha256,
  createMulberry32,
} from "./eosKernelPrimitives.ts";
import {
  DEFAULT_HOMOMORPHIC_PARAMS,
  type HomomorphicParameters,
  type LatticeSecretKey,
  type LatticePublicKey,
  type LatticeKeypair,
  type Ciphertext,
  type DecryptionResult,
  type HomomorphicReceipt,
  type HomomorphicOperationType,
} from "./eosHomomorphicLatticeCore.types.ts";

export { DEFAULT_HOMOMORPHIC_PARAMS };

/**
 * Standard positive modulo: ((n % m) + m) % m
 */
export function mod(n: number, m: number): number {
  const r = n % m;
  return r < 0 ? r + m : r;
}

/**
 * Negacyclic polynomial multiplication in Z_q[X] / (X^N + 1)
 * Since X^N = -1, any term of degree k = N + j wraps around to -X^j.
 */
export function polyMultiply(a: readonly number[], b: readonly number[], N: number, q: number): number[] {
  const result = new Array<number>(N).fill(0);
  for (let k = 0; k < N; k++) {
    let sum = 0;
    // Lower sum: i <= k -> term X^k from a[i] * b[k - i]
    for (let i = 0; i <= k; i++) {
      sum += a[i] * b[k - i];
    }
    // Upper sum: i > k -> term X^(N + k) = -X^k from a[i] * b[N + k - i]
    for (let i = k + 1; i < N; i++) {
      sum -= a[i] * b[N + k - i];
    }
    result[k] = mod(sum, q);
  }
  return result;
}

/**
 * Component-wise polynomial addition modulo q
 */
export function polyAdd(a: readonly number[], b: readonly number[], q: number): number[] {
  const N = a.length;
  const result = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    result[i] = mod(a[i] + b[i], q);
  }
  return result;
}

/**
 * Component-wise polynomial subtraction modulo q
 */
export function polySub(a: readonly number[], b: readonly number[], q: number): number[] {
  const N = a.length;
  const result = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    result[i] = mod(a[i] - b[i], q);
  }
  return result;
}

/**
 * Component-wise polynomial scalar multiplication modulo q
 */
export function polyScalarMultiply(a: readonly number[], scalar: number, q: number): number[] {
  const N = a.length;
  const result = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    result[i] = mod(a[i] * scalar, q);
  }
  return result;
}

/**
 * Sample a uniform random polynomial in Z_q^N
 */
export function sampleUniformPoly(N: number, q: number, rng?: () => number): number[] {
  const poly = new Array<number>(N);
  if (rng) {
    for (let i = 0; i < N; i++) {
      poly[i] = Math.floor(rng() * q);
    }
  } else {
    const bytes = crypto.randomBytes(N * 4);
    for (let i = 0; i < N; i++) {
      const u32 = bytes.readUInt32LE(i * 4);
      poly[i] = u32 % q;
    }
  }
  return poly;
}

/**
 * Sample a ternary polynomial with coefficients in {-1, 0, 1}
 */
export function sampleTernaryPoly(N: number, rng?: () => number): number[] {
  const poly = new Array<number>(N);
  if (rng) {
    for (let i = 0; i < N; i++) {
      const r = rng();
      poly[i] = r < 0.333333 ? -1 : r < 0.666666 ? 0 : 1;
    }
  } else {
    const bytes = crypto.randomBytes(N);
    for (let i = 0; i < N; i++) {
      const b = bytes[i] % 3;
      poly[i] = b === 0 ? -1 : b === 1 ? 0 : 1;
    }
  }
  return poly;
}

/**
 * Sample bounded discrete error polynomial with coefficients in [-bound, bound]
 */
export function sampleErrorPoly(N: number, bound: number, rng?: () => number): number[] {
  const poly = new Array<number>(N);
  const span = 2 * bound + 1;
  if (rng) {
    for (let i = 0; i < N; i++) {
      poly[i] = Math.floor(rng() * span) - bound;
    }
  } else {
    const bytes = crypto.randomBytes(N);
    for (let i = 0; i < N; i++) {
      poly[i] = (bytes[i] % span) - bound;
    }
  }
  return poly;
}

/**
 * EosHomomorphicLatticeCore provides RLWE/BFV-style somewhat homomorphic encryption
 * over cyclotomic polynomial rings Z_q[X] / (X^N + 1) with zero runtime dependencies.
 */
export class EosHomomorphicLatticeCore {
  private readonly _params: HomomorphicParameters;

  constructor(customParams?: Partial<HomomorphicParameters>) {
    const polyDegree = customParams?.polyDegree ?? DEFAULT_HOMOMORPHIC_PARAMS.polyDegree;
    const ciphertextModulus = customParams?.ciphertextModulus ?? DEFAULT_HOMOMORPHIC_PARAMS.ciphertextModulus;
    const plaintextModulus = customParams?.plaintextModulus ?? DEFAULT_HOMOMORPHIC_PARAMS.plaintextModulus;
    const errorBound = customParams?.errorBound ?? DEFAULT_HOMOMORPHIC_PARAMS.errorBound;

    assertPrecondition(
      polyDegree >= 16 && (polyDegree & (polyDegree - 1)) === 0,
      `Polynomial degree N must be a power of two >= 16; received ${polyDegree}`,
    );
    assertPrecondition(
      ciphertextModulus > plaintextModulus * 2,
      `Ciphertext modulus q (${ciphertextModulus}) must be strictly greater than 2 * plaintext modulus t (${plaintextModulus})`,
    );
    assertPrecondition(plaintextModulus >= 2, `Plaintext modulus t must be >= 2; received ${plaintextModulus}`);
    assertPrecondition(errorBound >= 1 && errorBound < 10, `Error bound must be in [1, 9]; received ${errorBound}`);

    this._params = deepFreeze({
      polyDegree,
      ciphertextModulus,
      plaintextModulus,
      errorBound,
    });
  }

  public getParameters(): HomomorphicParameters {
    return this._params;
  }

  /**
   * Generates a public/secret keypair.
   * sk = s in {-1, 0, 1}^N
   * pk = (pk0, pk1) = (-(a * s + e) mod q, a)
   */
  public generateKeypair(seed?: number): LatticeKeypair {
    const rng = seed !== undefined ? createMulberry32(seed) : undefined;
    const { polyDegree: N, ciphertextModulus: q, errorBound } = this._params;

    const s = sampleTernaryPoly(N, rng);
    const a = sampleUniformPoly(N, q, rng);
    const e = sampleErrorPoly(N, errorBound, rng);

    // a * s in R_q
    const aTimesS = polyMultiply(a, s, N, q);
    // a * s + e
    const aSTimesE = polyAdd(aTimesS, e, q);
    // pk0 = -(a * s + e) mod q
    const pk0 = polyScalarMultiply(aSTimesE, -1, q);
    const pk1 = a;

    const keyFingerprint = pureSha256(JSON.stringify({ pk0: pk0.slice(0, 8), pk1: pk1.slice(0, 8), N, q }));

    const secretKey: LatticeSecretKey = deepFreeze({
      s,
      params: this._params,
      keyFingerprint,
    });

    const publicKey: LatticePublicKey = deepFreeze({
      pk0,
      pk1,
      params: this._params,
      keyFingerprint,
    });

    return deepFreeze({
      publicKey,
      secretKey,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Encrypts a plaintext message vector m in Z_t^N.
   * Delta = floor(q / t)
   * c0 = (pk0 * u + e0 + Delta * m) mod (q, X^N + 1)
   * c1 = (pk1 * u + e1) mod (q, X^N + 1)
   */
  public encrypt(publicKey: LatticePublicKey, message: readonly number[], seed?: number): Ciphertext {
    assertPrecondition(
      publicKey.params.polyDegree === this._params.polyDegree,
      `Public key degree mismatch: expected ${this._params.polyDegree}, got ${publicKey.params.polyDegree}`,
    );
    assertPrecondition(
      message.length <= this._params.polyDegree,
      `Message length (${message.length}) exceeds ring polynomial degree (${this._params.polyDegree})`,
    );

    const { polyDegree: N, ciphertextModulus: q, plaintextModulus: t, errorBound } = this._params;
    const rng = seed !== undefined ? createMulberry32(seed) : undefined;

    // Pad message to N coefficients and reduce mod t
    const mPadded = new Array<number>(N).fill(0);
    for (let i = 0; i < message.length; i++) {
      mPadded[i] = mod(message[i], t);
    }

    const scaleDelta = Math.floor(q / t);
    const scaledMessage = polyScalarMultiply(mPadded, scaleDelta, q);

    const u = sampleTernaryPoly(N, rng);
    const e0 = sampleErrorPoly(N, errorBound, rng);
    const e1 = sampleErrorPoly(N, errorBound, rng);

    // c0 = pk0 * u + e0 + Delta * m
    const pk0TimesU = polyMultiply(publicKey.pk0, u, N, q);
    const c0WithE = polyAdd(pk0TimesU, e0, q);
    const c0 = polyAdd(c0WithE, scaledMessage, q);

    // c1 = pk1 * u + e1
    const pk1TimesU = polyMultiply(publicKey.pk1, u, N, q);
    const c1 = polyAdd(pk1TimesU, e1, q);

    // Initial noise estimate ~ 2 * errorBound * sqrt(N)
    const initialNoise = 2 * errorBound * Math.sqrt(N) + 1;
    const noiseBudgetBits = Math.max(0, Math.floor(Math.log2(q / (2 * initialNoise))));

    const ciphertextDigest = pureSha256(JSON.stringify({ c0: c0.slice(0, 8), c1: c1.slice(0, 8), scaleDelta }));

    const ct: Ciphertext = deepFreeze({
      c0,
      c1,
      params: this._params,
      scaleDelta,
      noiseBudgetBits,
      ciphertextDigest,
    });

    assertPostcondition(ct.c0.length === N && ct.c1.length === N, "Ciphertext size invariant violated");
    return ct;
  }

  /**
   * Decrypts ciphertext C = (c0, c1) using secret key s.
   * Phase v = (c0 + c1 * s) mod (q, X^N + 1)
   * Recover m_i = round((t / q) * v_i) mod t
   */
  public decrypt(secretKey: LatticeSecretKey, ciphertext: Ciphertext): DecryptionResult {
    assertPrecondition(
      secretKey.params.polyDegree === this._params.polyDegree,
      "Secret key ring parameters mismatch with engine configuration",
    );
    assertPrecondition(
      ciphertext.params.polyDegree === this._params.polyDegree,
      "Ciphertext ring parameters mismatch with engine configuration",
    );

    const { polyDegree: N, ciphertextModulus: q, plaintextModulus: t } = this._params;

    // Phase: c1 * s
    const c1TimesS = polyMultiply(ciphertext.c1, secretKey.s, N, q);
    // v = c0 + c1 * s mod q
    const v = polyAdd(ciphertext.c0, c1TimesS, q);

    const plaintext = new Array<number>(N);
    let maxNoiseMagnitude = 0;

    for (let i = 0; i < N; i++) {
      const vi = v[i];
      // Rounded scale: round((t / q) * vi) mod t
      const rawDecoded = Math.round((t / q) * vi);
      plaintext[i] = mod(rawDecoded, t);

      // Estimate observed noise deviation: noise = vi - Delta * m_i
      const expectedScaled = plaintext[i] * ciphertext.scaleDelta;
      let noiseVal = Math.abs(vi - expectedScaled);
      if (noiseVal > q / 2) {
        noiseVal = q - noiseVal;
      }
      if (noiseVal > maxNoiseMagnitude) {
        maxNoiseMagnitude = noiseVal;
      }
    }

    const noiseBudgetBits = Math.max(0, Math.floor(Math.log2(q / (2 * (maxNoiseMagnitude + 1)))));

    const receipt = this._createReceipt(
      "decrypt",
      ciphertext.ciphertextDigest,
      pureSha256(JSON.stringify(plaintext)),
      noiseBudgetBits,
    );

    return deepFreeze({
      plaintext,
      noiseBudgetBits,
      receipt,
    });
  }

  /**
   * Homomorphic blind addition: C_sum = (c0_A + c0_B mod q, c1_A + c1_B mod q)
   * Preserves (m_A + m_B) mod t without decryption.
   */
  public add(cA: Ciphertext, cB: Ciphertext): Ciphertext {
    this._assertCompatibleCiphertexts(cA, cB);
    const { ciphertextModulus: q } = this._params;

    const c0 = polyAdd(cA.c0, cB.c0, q);
    const c1 = polyAdd(cA.c1, cB.c1, q);

    // In addition, noise accumulates additively; noise budget decreases by ~1 bit
    const noiseBudgetBits = Math.max(0, Math.min(cA.noiseBudgetBits, cB.noiseBudgetBits) - 1);

    const ciphertextDigest = pureSha256(JSON.stringify({ c0: c0.slice(0, 8), c1: c1.slice(0, 8), op: "add" }));

    return deepFreeze({
      c0,
      c1,
      params: this._params,
      scaleDelta: cA.scaleDelta,
      noiseBudgetBits,
      ciphertextDigest,
    });
  }

  /**
   * Homomorphic blind subtraction: C_diff = (c0_A - c0_B mod q, c1_A - c1_B mod q)
   * Preserves (m_A - m_B) mod t without decryption.
   */
  public sub(cA: Ciphertext, cB: Ciphertext): Ciphertext {
    this._assertCompatibleCiphertexts(cA, cB);
    const { ciphertextModulus: q } = this._params;

    const c0 = polySub(cA.c0, cB.c0, q);
    const c1 = polySub(cA.c1, cB.c1, q);

    const noiseBudgetBits = Math.max(0, Math.min(cA.noiseBudgetBits, cB.noiseBudgetBits) - 1);

    const ciphertextDigest = pureSha256(JSON.stringify({ c0: c0.slice(0, 8), c1: c1.slice(0, 8), op: "sub" }));

    return deepFreeze({
      c0,
      c1,
      params: this._params,
      scaleDelta: cA.scaleDelta,
      noiseBudgetBits,
      ciphertextDigest,
    });
  }

  /**
   * Homomorphic scalar multiplication: k * C = (k * c0 mod q, k * c1 mod q)
   * Preserves (k * m) mod t.
   */
  public scalarMultiply(c: Ciphertext, scalar: number): Ciphertext {
    assertPrecondition(
      c.params.polyDegree === this._params.polyDegree,
      "Ciphertext ring parameters mismatch with engine configuration",
    );
    const { ciphertextModulus: q } = this._params;

    const c0 = polyScalarMultiply(c.c0, scalar, q);
    const c1 = polyScalarMultiply(c.c1, scalar, q);

    const absScalar = Math.max(1, Math.abs(scalar));
    const scalarBits = Math.ceil(Math.log2(absScalar + 1));
    const noiseBudgetBits = Math.max(0, c.noiseBudgetBits - scalarBits);

    const ciphertextDigest = pureSha256(JSON.stringify({ c0: c0.slice(0, 8), c1: c1.slice(0, 8), scalar }));

    return deepFreeze({
      c0,
      c1,
      params: this._params,
      scaleDelta: c.scaleDelta,
      noiseBudgetBits,
      ciphertextDigest,
    });
  }

  private _assertCompatibleCiphertexts(cA: Ciphertext, cB: Ciphertext): void {
    assertPrecondition(
      cA.params.polyDegree === this._params.polyDegree && cB.params.polyDegree === this._params.polyDegree,
      "Ciphertext polyDegree mismatch",
    );
    assertPrecondition(
      cA.scaleDelta === cB.scaleDelta,
      "Ciphertext scaleDelta mismatch — cannot combine ciphertexts with distinct plaintext scaling",
    );
  }

  private _createReceipt(
    operation: HomomorphicOperationType,
    inputsDigest: string,
    outputDigest: string,
    noiseBudgetBits?: number,
  ): HomomorphicReceipt {
    const timestamp = new Date().toISOString();
    const receiptId = `eos-he-${operation}-${pureSha256(`${inputsDigest}:${timestamp}`).slice(0, 16)}`;
    const receiptSha256 = pureSha256(
      JSON.stringify({ receiptId, operation, timestamp, inputsDigest, outputDigest, noiseBudgetBits }),
    );

    return deepFreeze({
      receiptId,
      operation,
      timestamp,
      inputsDigest,
      outputDigest,
      noiseBudgetBits,
      receiptSha256,
    });
  }
}
