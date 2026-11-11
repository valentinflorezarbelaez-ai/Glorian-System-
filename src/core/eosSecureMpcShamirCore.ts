/**
 * EOS Layer-0 Secure Multi-Party Computation Engine
 *
 * SPEC-212 / CHANGE-097 / Shamir's Secret Sharing & Beaver Multiplicative Triples
 * Galois Field Z_p arithmetic with native BigInt
 *
 * Inviolable Laws:
 * - Law I: Zero Vibe Coding — Information-theoretically secure Shamir + Beaver protocol
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
  DEFAULT_MPC_PRIME,
  DEFAULT_MPC_THRESHOLD,
  DEFAULT_MPC_PARTIES,
  type MpcFieldParameters,
  type SecretShare,
  type BeaverTriple,
  type ReconstructionResult,
  type MpcReceipt,
  type MpcOperationType,
} from "./eosSecureMpcShamirCore.types.ts";

export { DEFAULT_MPC_PRIME, DEFAULT_MPC_THRESHOLD, DEFAULT_MPC_PARTIES };

/**
 * Standard positive modulo for BigInt: ((a % m) + m) % m
 */
export function modBigInt(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r < 0n ? r + m : r;
}

/**
 * Computes modular inverse using the Extended Euclidean Algorithm: (a * inv) === 1 mod p
 */
export function modInverseBigInt(a: bigint, p: bigint): bigint {
  let oldR = modBigInt(a, p);
  let r = p;
  let oldS = 1n;
  let s = 0n;

  while (r !== 0n) {
    const quotient = oldR / r;
    const tempR = r;
    r = oldR - quotient * r;
    oldR = tempR;

    const tempS = s;
    s = oldS - quotient * s;
    oldS = tempS;
  }

  assertPrecondition(oldR === 1n, `Value ${a} is not coprime to prime modulus ${p}`);
  return modBigInt(oldS, p);
}

/**
 * Computes SHA-256 integrity commitment for a secret share
 */
export function computeShareCommitment(x: bigint, y: bigint, prime: bigint): string {
  return pureSha256(`${x.toString()}:${y.toString()}:${prime.toString()}`);
}

/**
 * EosSecureMpcShamirCore provides information-theoretically secure threshold secret
 * sharing and interactive Beaver-triple multi-party computation over prime fields.
 */
export class EosSecureMpcShamirCore {
  private readonly _params: MpcFieldParameters;

  constructor(customParams?: Partial<MpcFieldParameters>) {
    const prime = customParams?.prime ?? DEFAULT_MPC_PRIME;
    const threshold = customParams?.threshold ?? DEFAULT_MPC_THRESHOLD;
    const totalParties = customParams?.totalParties ?? DEFAULT_MPC_PARTIES;

    assertPrecondition(prime > 2n, `Prime modulus must be > 2; received ${prime}`);
    assertPrecondition(threshold >= 2, `Threshold k must be >= 2; received ${threshold}`);
    assertPrecondition(
      totalParties >= threshold,
      `Total parties N (${totalParties}) must be >= threshold k (${threshold})`,
    );
    assertPrecondition(
      prime > BigInt(totalParties),
      `Prime modulus (${prime}) must be strictly greater than total parties (${totalParties})`,
    );

    this._params = deepFreeze({
      prime,
      threshold,
      totalParties,
    });
  }

  public getParameters(): MpcFieldParameters {
    return this._params;
  }

  /**
   * Splits secret s into N shares such that any k shares can reconstruct s.
   * P(x) = s + a_1*x + ... + a_{k-1}*x^{k-1} mod p
   */
  public split(secret: bigint | number, seed?: number): SecretShare[] {
    const s = modBigInt(BigInt(secret), this._params.prime);
    const { prime, threshold: k, totalParties: N } = this._params;

    const rng = seed !== undefined ? createMulberry32(seed) : undefined;

    // Sample k - 1 random polynomial coefficients in [1, prime - 1]
    const coeffs = new Array<bigint>(k);
    coeffs[0] = s;

    for (let i = 1; i < k; i++) {
      if (rng) {
        // Deterministic pseudo-random BigInt for testing
        const high = BigInt(Math.floor(rng() * 65536));
        const low = BigInt(Math.floor(rng() * 65536));
        const raw = (high << 16n) | low;
        coeffs[i] = modBigInt(raw, prime - 1n) + 1n;
      } else {
        const bytes = crypto.randomBytes(8);
        const rand = bytes.readBigUInt64BE(0);
        coeffs[i] = modBigInt(rand, prime - 1n) + 1n;
      }
    }

    // Evaluate P(x) for x = 1 .. N
    const shares: SecretShare[] = [];
    for (let i = 1; i <= N; i++) {
      const x = BigInt(i);
      let y = 0n;
      let xPower = 1n;

      for (let j = 0; j < k; j++) {
        y = modBigInt(y + coeffs[j] * xPower, prime);
        xPower = modBigInt(xPower * x, prime);
      }

      const commitment = computeShareCommitment(x, y, prime);
      shares.push(deepFreeze({ x, y, commitment }));
    }

    assertPostcondition(shares.length === N, "Split produced incorrect number of shares");
    return deepFreeze(shares) as SecretShare[];
  }

  /**
   * Reconstructs secret from M shares (M >= k) using Lagrange polynomial interpolation at x = 0.
   */
  public combine(shares: readonly SecretShare[]): ReconstructionResult {
    const { prime, threshold: k } = this._params;
    assertPrecondition(
      shares.length >= k,
      `Insufficient shares for reconstruction: received ${shares.length}, threshold is ${k}`,
    );

    // Verify share uniqueness and commitments
    const seenX = new Set<string>();
    for (const share of shares) {
      const xStr = share.x.toString();
      assertPrecondition(!seenX.has(xStr), `Duplicate share evaluation point x=${xStr}`);
      seenX.add(xStr);

      const expectedCommitment = computeShareCommitment(share.x, share.y, prime);
      assertPrecondition(
        share.commitment === expectedCommitment,
        `Share integrity violation at x=${share.x}: commitment verification failed`,
      );
    }

    // Use the first k distinct shares
    const subset = shares.slice(0, k);
    let secret = 0n;

    for (let j = 0; j < k; j++) {
      const { x: xj, y: yj } = subset[j];
      let numerator = 1n;
      let denominator = 1n;

      for (let m = 0; m < k; m++) {
        if (m === j) continue;
        const xm = subset[m].x;
        // Lagrange basis at x=0: prod_{m != j} (-xm) / (xj - xm)
        numerator = modBigInt(numerator * -xm, prime);
        denominator = modBigInt(denominator * (xj - xm), prime);
      }

      const invDenominator = modInverseBigInt(denominator, prime);
      const lagrangeCoeff = modBigInt(numerator * invDenominator, prime);
      const term = modBigInt(yj * lagrangeCoeff, prime);
      secret = modBigInt(secret + term, prime);
    }

    const receipt = this._createReceipt(
      "combine",
      pureSha256(subset.map((s) => s.commitment).join(":")),
      pureSha256(secret.toString()),
    );

    return deepFreeze({
      secret,
      sharesUsed: k,
      receipt,
    });
  }

  /**
   * Non-interactive local share addition: [a + b]_i = [a]_i + [b]_i mod p
   */
  public addShares(shareA: SecretShare, shareB: SecretShare): SecretShare {
    assertPrecondition(shareA.x === shareB.x, `Share evaluation point mismatch: xA=${shareA.x} vs xB=${shareB.x}`);
    const { prime } = this._params;
    const y = modBigInt(shareA.y + shareB.y, prime);
    const commitment = computeShareCommitment(shareA.x, y, prime);

    return deepFreeze({
      x: shareA.x,
      y,
      commitment,
    });
  }

  /**
   * Non-interactive local share subtraction: [a - b]_i = [a]_i - [b]_i mod p
   */
  public subShares(shareA: SecretShare, shareB: SecretShare): SecretShare {
    assertPrecondition(shareA.x === shareB.x, `Share evaluation point mismatch: xA=${shareA.x} vs xB=${shareB.x}`);
    const { prime } = this._params;
    const y = modBigInt(shareA.y - shareB.y, prime);
    const commitment = computeShareCommitment(shareA.x, y, prime);

    return deepFreeze({
      x: shareA.x,
      y,
      commitment,
    });
  }

  /**
   * Non-interactive local share scaling: [c * a]_i = c * [a]_i mod p
   */
  public scaleShare(share: SecretShare, scalar: bigint | number): SecretShare {
    const { prime } = this._params;
    const c = modBigInt(BigInt(scalar), prime);
    const y = modBigInt(share.y * c, prime);
    const commitment = computeShareCommitment(share.x, y, prime);

    return deepFreeze({
      x: share.x,
      y,
      commitment,
    });
  }

  /**
   * Generates a pre-shared Beaver multiplication triple ([a], [b], [c]) where c = a * b mod p.
   */
  public generateBeaverTriple(seed?: number): BeaverTriple {
    const { prime } = this._params;
    const rng = seed !== undefined ? createMulberry32(seed) : undefined;

    let a: bigint;
    let b: bigint;

    if (rng) {
      const rawA = BigInt(Math.floor(rng() * 1000000));
      const rawB = BigInt(Math.floor(rng() * 1000000));
      a = modBigInt(rawA, prime - 1n) + 1n;
      b = modBigInt(rawB, prime - 1n) + 1n;
    } else {
      const bytesA = crypto.randomBytes(8);
      const bytesB = crypto.randomBytes(8);
      a = modBigInt(bytesA.readBigUInt64BE(0), prime - 1n) + 1n;
      b = modBigInt(bytesB.readBigUInt64BE(0), prime - 1n) + 1n;
    }

    const c = modBigInt(a * b, prime);

    const sharesA = this.split(a, seed !== undefined ? seed + 1 : undefined);
    const sharesB = this.split(b, seed !== undefined ? seed + 2 : undefined);
    const sharesC = this.split(c, seed !== undefined ? seed + 3 : undefined);

    const tripleId = `triple-${pureSha256(`${a}:${b}:${c}`).slice(0, 16)}`;

    return deepFreeze({
      tripleId,
      a,
      b,
      c,
      sharesA,
      sharesB,
      sharesC,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Secure Multi-Party Multiplication using Beaver Triples:
   * To compute [z] = [x * y]:
   * 1. Parties compute shares of d = x - a, e = y - b
   * 2. Parties reconstruct public values d and e
   * 3. Each party locally computes: [z]_i = [c]_i + d * [b]_i + e * [a]_i + delta_i * (d * e) mod p
   *    where delta_1 = 1, delta_{i > 1} = 0
   */
  public multiplyShares(
    sharesX: readonly SecretShare[],
    sharesY: readonly SecretShare[],
    triple: BeaverTriple,
  ): SecretShare[] {
    const { prime, totalParties: N } = this._params;
    assertPrecondition(
      sharesX.length === N && sharesY.length === N,
      `Share array lengths must equal totalParties (${N})`,
    );

    // 1. Compute [d]_i = [x]_i - [a]_i and [e]_i = [y]_i - [b]_i
    const sharesD: SecretShare[] = [];
    const sharesE: SecretShare[] = [];

    for (let i = 0; i < N; i++) {
      sharesD.push(this.subShares(sharesX[i], triple.sharesA[i]));
      sharesE.push(this.subShares(sharesY[i], triple.sharesB[i]));
    }

    // 2. Reconstruct public d and e
    const d = this.combine(sharesD).secret;
    const e = this.combine(sharesE).secret;

    // 3. Each party computes local share: [z]_i = [c]_i + d * [b]_i + e * [a]_i + delta_i * d * e mod p
    const sharesZ: SecretShare[] = [];
    const deProduct = modBigInt(d * e, prime);

    for (let i = 0; i < N; i++) {
      const ci = triple.sharesC[i].y;
      const bi = triple.sharesB[i].y;
      const ai = triple.sharesA[i].y;
      const term1 = ci;
      const term2 = modBigInt(d * bi, prime);
      const term3 = modBigInt(e * ai, prime);
      const term4 = deProduct;

      const zi = modBigInt(term1 + term2 + term3 + term4, prime);
      const xi = sharesX[i].x;
      const commitment = computeShareCommitment(xi, zi, prime);

      sharesZ.push(deepFreeze({ x: xi, y: zi, commitment }));
    }

    return deepFreeze(sharesZ) as SecretShare[];
  }

  private _createReceipt(operation: MpcOperationType, inputsDigest: string, outputDigest: string): MpcReceipt {
    const timestamp = new Date().toISOString();
    const receiptId = `eos-mpc-${operation}-${pureSha256(`${inputsDigest}:${timestamp}`).slice(0, 16)}`;
    const receiptSha256 = pureSha256(JSON.stringify({ receiptId, operation, timestamp, inputsDigest, outputDigest }));

    return deepFreeze({
      receiptId,
      operation,
      timestamp,
      inputsDigest,
      outputDigest,
      receiptSha256,
    });
  }
}
