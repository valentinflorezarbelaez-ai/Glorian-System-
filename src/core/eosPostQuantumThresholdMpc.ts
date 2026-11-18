/**
 * Glorian System — Threshold Secret Sharing & Ring-LWE Homomorphic Secure Aggregation (PQ-MPC)
 * Governed by SPEC-335 / CHANGE-197 / ADR-197-001..003
 *
 * Reference implementation only. Default parameters (n = 64) provide no meaningful
 * security level; BigInt arithmetic is not constant-time; key generation uses a
 * trusted dealer; partial decryptions carry no smudging noise. Use audited libraries
 * (OpenFHE, Microsoft SEAL, liboqs) to protect real data.
 *
 * Invariant: pure Layer-0 TypeScript, zero external runtime dependencies.
 */

import { createHash, randomBytes } from "node:crypto";
import type {
  PqmpcAggregationResult,
  PqmpcAuditReceipt,
  PqmpcCiphertext,
  PqmpcConfig,
  PqmpcErrorCode,
  PqmpcKeyShare,
  PqmpcParameters,
  PqmpcPartialDecryption,
  PqmpcPolynomial,
  PqmpcPublicKey,
  PqmpcShamirShare,
  PqmpcThresholdKeySet,
} from "./eosPostQuantumThresholdMpc.types.ts";

export * from "./eosPostQuantumThresholdMpc.types.ts";

/** Mersenne prime M61 = 2^61 - 1: Shamir field and Ring-LWE ciphertext modulus (ADR-197-001). */
export const PQMPC_FIELD_MODULUS: bigint = (1n << 61n) - 1n;

export const PQMPC_SECURITY_NOTICE =
  "Reference implementation (SPEC-335). Not production cryptography: parameters are not " +
  "security-validated, arithmetic is not constant-time, keys use a trusted dealer and " +
  "partial decryptions carry no smudging noise. Do not use to protect real secrets.";

const MASK64 = 0xffffffffffffffffn;

/** Error carrying a stable machine-readable code. */
export class PqmpcError extends Error {
  public readonly code: PqmpcErrorCode;

  constructor(code: PqmpcErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "PqmpcError";
  }
}

/** Seedable entropy source: SplitMix64 when seeded, crypto.randomBytes otherwise (ADR-197-003). */
class PqmpcEntropySource {
  private state: bigint | null;

  constructor(seed?: string | number | bigint) {
    if (seed === undefined) {
      this.state = null;
      return;
    }
    const digest = createHash("sha256")
      .update(`pqmpc-seed:${String(seed)}`)
      .digest();
    this.state = digest.readBigUInt64BE(0);
  }

  public isDeterministic(): boolean {
    return this.state !== null;
  }

  public nextU64(): bigint {
    if (this.state === null) {
      return randomBytes(8).readBigUInt64BE(0);
    }
    this.state = (this.state + 0x9e3779b97f4a7c15n) & MASK64;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    return (z ^ (z >> 31n)) & MASK64;
  }
}

function modq(a: bigint, q: bigint): bigint {
  const r = a % q;
  return r < 0n ? r + q : r;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let b = modq(base, modulus);
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

function modInverse(a: bigint, prime: bigint): bigint {
  const v = modq(a, prime);
  if (v === 0n) {
    throw new PqmpcError("PQMPC_INVALID_PARAMETERS", "zero has no modular inverse");
  }
  return modPow(v, prime - 2n, prime);
}

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Threshold Secret Sharing & Ring-LWE Homomorphic Secure Aggregation Core.
 */
export class EosPostQuantumThresholdMpcCore {
  private readonly n: number;
  private readonly q: bigint = PQMPC_FIELD_MODULUS;
  private readonly t: bigint;
  private readonly delta: bigint;
  private readonly parties: number;
  private readonly threshold: number;
  private readonly rng: PqmpcEntropySource;
  private readonly qBits: number;

  constructor(config: PqmpcConfig = {}) {
    const n = config.ringDegree ?? 64;
    const t = config.plaintextModulus ?? 65537n;
    const parties = config.parties ?? 5;
    const threshold = config.threshold ?? 3;

    if (!Number.isInteger(n) || n < 8 || n > 4096 || (n & (n - 1)) !== 0) {
      throw new PqmpcError("PQMPC_INVALID_PARAMETERS", `ringDegree must be a power of two in [8, 4096], got ${n}`);
    }
    if (typeof t !== "bigint" || t < 2n || t > 1n << 20n) {
      throw new PqmpcError("PQMPC_INVALID_PARAMETERS", `plaintextModulus must be in [2, 2^20], got ${String(t)}`);
    }
    if (!Number.isInteger(parties) || parties < 2 || parties > 64) {
      throw new PqmpcError("PQMPC_INVALID_PARAMETERS", `parties must be an integer in [2, 64], got ${parties}`);
    }
    if (!Number.isInteger(threshold) || threshold < 2 || threshold > parties) {
      throw new PqmpcError(
        "PQMPC_INVALID_PARAMETERS",
        `threshold must be an integer in [2, parties=${parties}], got ${threshold}`,
      );
    }

    this.n = n;
    this.t = t;
    this.delta = this.q / t;
    this.parties = parties;
    this.threshold = threshold;
    this.rng = new PqmpcEntropySource(config.seed);
    this.qBits = this.q.toString(2).length;
  }

  public getParameters(): PqmpcParameters {
    return {
      ringDegree: this.n,
      ciphertextModulus: this.q,
      plaintextModulus: this.t,
      scalingFactor: this.delta,
      parties: this.parties,
      threshold: this.threshold,
      deterministic: this.rng.isDeterministic(),
    };
  }

  // ---------------------------------------------------------------------------
  // Shamir threshold secret sharing over F_q (FR-1, FR-2)
  // ---------------------------------------------------------------------------

  /** Split a secret into `parties` shares, any `threshold` of which reconstruct it. */
  public shamirSplit(
    secret: bigint,
    parties: number = this.parties,
    threshold: number = this.threshold,
  ): PqmpcShamirShare[] {
    if (!Number.isInteger(parties) || parties < 2 || parties > 64 || threshold < 2 || threshold > parties) {
      throw new PqmpcError("PQMPC_INVALID_PARAMETERS", `invalid (parties=${parties}, threshold=${threshold})`);
    }
    const coefficients = [modq(secret, this.q)];
    for (let i = 1; i < threshold; i++) {
      coefficients.push(this.sampleUniform());
    }
    const shares: PqmpcShamirShare[] = [];
    for (let i = 1; i <= parties; i++) {
      const x = BigInt(i);
      const y = this.evaluatePolynomial(coefficients, x);
      shares.push({ x, y, commitment: this.commitShare(x, y) });
    }
    return shares;
  }

  /** Reconstruct a secret, enforcing threshold, uniqueness and commitments. */
  public shamirReconstruct(shares: PqmpcShamirShare[], threshold: number = this.threshold): bigint {
    if (shares.length < threshold) {
      throw new PqmpcError("PQMPC_BELOW_THRESHOLD", `received ${shares.length} share(s), threshold is ${threshold}`);
    }
    for (const share of shares) {
      if (this.commitShare(share.x, share.y) !== share.commitment) {
        throw new PqmpcError("PQMPC_COMMITMENT_MISMATCH", `share at x=${share.x} does not match its commitment`);
      }
    }
    return this.interpolateAtZero(shares);
  }

  /**
   * Raw Lagrange interpolation at zero without threshold or commitment checks.
   * With fewer than `threshold` shares the result is statistically independent of the secret.
   */
  public interpolateAtZero(shares: Array<{ x: bigint; y: bigint }>): bigint {
    if (shares.length === 0) {
      throw new PqmpcError("PQMPC_BELOW_THRESHOLD", "at least one share is required");
    }
    const xs = shares.map((s) => s.x);
    const lambdas = this.lagrangeCoefficientsAtZero(xs);
    let acc = 0n;
    for (let i = 0; i < shares.length; i++) {
      acc = (acc + lambdas[i] * modq(shares[i].y, this.q)) % this.q;
    }
    return acc;
  }

  /** Lagrange basis coefficients λ_i = Π_{j≠i} x_j / (x_j − x_i) mod q. */
  public lagrangeCoefficientsAtZero(xs: bigint[]): bigint[] {
    const seen = new Set<string>();
    for (const x of xs) {
      const key = modq(x, this.q).toString();
      if (key === "0") {
        throw new PqmpcError("PQMPC_INVALID_PARAMETERS", "abscissa 0 is reserved for the secret");
      }
      if (seen.has(key)) {
        throw new PqmpcError("PQMPC_DUPLICATE_SHARE", `duplicate abscissa x=${key}`);
      }
      seen.add(key);
    }
    return xs.map((xi, i) => {
      let num = 1n;
      let den = 1n;
      for (let j = 0; j < xs.length; j++) {
        if (j === i) continue;
        num = (num * modq(xs[j], this.q)) % this.q;
        den = (den * modq(xs[j] - xi, this.q)) % this.q;
      }
      return (num * modInverse(den, this.q)) % this.q;
    });
  }

  // ---------------------------------------------------------------------------
  // Ring-LWE threshold key generation (trusted dealer, ADR-197-002)
  // ---------------------------------------------------------------------------

  /** Generate a public key and coefficient-wise Shamir shares of the ring secret. */
  public generateThresholdKeys(): PqmpcThresholdKeySet {
    const s = this.sampleTernaryPolynomial();
    const a = this.sampleUniformPolynomial();
    const e = this.sampleNoisePolynomial();
    // b = -(a·s + e)
    const b = this.polyNeg(this.polyAdd(this.polyMul(a, s), e));

    const perParty: PqmpcPolynomial[] = Array.from({ length: this.parties }, () => new Array<bigint>(this.n));
    for (let k = 0; k < this.n; k++) {
      const shares = this.shamirSplit(s[k], this.parties, this.threshold);
      for (let i = 0; i < this.parties; i++) {
        perParty[i][k] = shares[i].y;
      }
    }
    s.fill(0n); // dealer discards the secret

    const keyShares: PqmpcKeyShare[] = perParty.map((secretShare, i) => {
      const x = BigInt(i + 1);
      return {
        partyId: `custodian-${i + 1}`,
        x,
        secretShare,
        commitment: this.commitPolynomial(x, secretShare),
      };
    });
    const publishedCommitments: Record<string, string> = {};
    for (const ks of keyShares) publishedCommitments[ks.partyId] = ks.commitment;

    return { publicKey: { b, a }, keyShares, publishedCommitments };
  }

  // ---------------------------------------------------------------------------
  // Encryption and additive homomorphism (FR-3, FR-4)
  // ---------------------------------------------------------------------------

  /** Encrypt a vector of integers in [0, t) packed into polynomial coefficients. */
  public encryptVector(publicKey: PqmpcPublicKey, values: ReadonlyArray<number | bigint>): PqmpcCiphertext {
    this.assertPolynomialShape(publicKey.a);
    this.assertPolynomialShape(publicKey.b);
    if (values.length === 0 || values.length > this.n) {
      throw new PqmpcError("PQMPC_SLOT_OVERFLOW", `vector length must be in [1, ${this.n}], got ${values.length}`);
    }
    const m = new Array<bigint>(this.n).fill(0n);
    values.forEach((raw, j) => {
      const v = typeof raw === "bigint" ? raw : BigInt(raw);
      if ((typeof raw === "number" && !Number.isInteger(raw)) || v < 0n || v >= this.t) {
        throw new PqmpcError("PQMPC_PLAINTEXT_OUT_OF_RANGE", `slot ${j} value ${String(raw)} not in [0, ${this.t})`);
      }
      m[j] = v;
    });

    const u = this.sampleTernaryPolynomial();
    const e1 = this.sampleNoisePolynomial();
    const e2 = this.sampleNoisePolynomial();
    const scaled = m.map((c) => (c * this.delta) % this.q);

    const c0 = this.polyAdd(this.polyAdd(this.polyMul(publicKey.b, u), e1), scaled);
    const c1 = this.polyAdd(this.polyMul(publicKey.a, u), e2);
    return { c0, c1, slots: values.length, operations: 0 };
  }

  /** Homomorphic addition: Dec(a + b) = Dec(a) + Dec(b) mod t. */
  public addCiphertexts(left: PqmpcCiphertext, right: PqmpcCiphertext): PqmpcCiphertext {
    this.assertCiphertext(left);
    this.assertCiphertext(right);
    return {
      c0: this.polyAdd(left.c0, right.c0),
      c1: this.polyAdd(left.c1, right.c1),
      slots: Math.max(left.slots, right.slots),
      operations: left.operations + right.operations + 1,
    };
  }

  /** Sum a non-empty list of ciphertexts. */
  public aggregateCiphertexts(ciphertexts: PqmpcCiphertext[]): PqmpcCiphertext {
    if (ciphertexts.length === 0) {
      throw new PqmpcError("PQMPC_SHAPE_MISMATCH", "cannot aggregate an empty ciphertext list");
    }
    return ciphertexts.slice(1).reduce((acc, ct) => this.addCiphertexts(acc, ct), ciphertexts[0]);
  }

  /** Homomorphic multiplication by a public scalar k in [0, t). */
  public scalarMultiply(ciphertext: PqmpcCiphertext, scalar: number | bigint): PqmpcCiphertext {
    this.assertCiphertext(ciphertext);
    const k = typeof scalar === "bigint" ? scalar : BigInt(scalar);
    if ((typeof scalar === "number" && !Number.isInteger(scalar)) || k < 0n || k >= this.t) {
      throw new PqmpcError("PQMPC_PLAINTEXT_OUT_OF_RANGE", `scalar ${String(scalar)} not in [0, ${this.t})`);
    }
    return {
      c0: ciphertext.c0.map((c) => (c * k) % this.q),
      c1: ciphertext.c1.map((c) => (c * k) % this.q),
      slots: ciphertext.slots,
      operations: ciphertext.operations + 1,
    };
  }

  // ---------------------------------------------------------------------------
  // Threshold decryption (FR-5)
  // ---------------------------------------------------------------------------

  /** Custodian partial decryption d_i = c1 · s_i. Verifies the key share against its commitment. */
  public partialDecrypt(ciphertext: PqmpcCiphertext, keyShare: PqmpcKeyShare): PqmpcPartialDecryption {
    this.assertCiphertext(ciphertext);
    this.assertPolynomialShape(keyShare.secretShare);
    if (this.commitPolynomial(keyShare.x, keyShare.secretShare) !== keyShare.commitment) {
      throw new PqmpcError(
        "PQMPC_COMMITMENT_MISMATCH",
        `key share of ${keyShare.partyId} does not match its commitment`,
      );
    }
    return { partyId: keyShare.partyId, x: keyShare.x, share: this.polyMul(ciphertext.c1, keyShare.secretShare) };
  }

  /** Combine >= T partial decryptions: c0 + Σ λ_i d_i = Δ·m + noise, then decode. */
  public combinePartialDecryptions(
    ciphertext: PqmpcCiphertext,
    partials: PqmpcPartialDecryption[],
    threshold: number = this.threshold,
  ): bigint[] {
    this.assertCiphertext(ciphertext);
    if (partials.length < threshold) {
      throw new PqmpcError(
        "PQMPC_BELOW_THRESHOLD",
        `received ${partials.length} partial decryption(s), threshold is ${threshold}`,
      );
    }
    const lambdas = this.lagrangeCoefficientsAtZero(partials.map((p) => p.x));
    let acc = ciphertext.c0.slice();
    partials.forEach((p, i) => {
      this.assertPolynomialShape(p.share);
      acc = this.polyAdd(
        acc,
        p.share.map((c) => (c * lambdas[i]) % this.q),
      );
    });
    return this.decode(acc).slice(0, ciphertext.slots);
  }

  /** End-to-end secure aggregation: encrypt each input, sum homomorphically, threshold-decrypt. */
  public secureAggregate(
    keys: PqmpcThresholdKeySet,
    inputs: ReadonlyArray<ReadonlyArray<number | bigint>>,
    decryptingPartyIds: string[],
  ): PqmpcAggregationResult {
    if (inputs.length === 0) {
      throw new PqmpcError("PQMPC_SHAPE_MISMATCH", "at least one contributor is required");
    }
    const ciphertexts = inputs.map((vector) => this.encryptVector(keys.publicKey, vector));
    const aggregate = this.aggregateCiphertexts(ciphertexts);
    const byId = new Map(keys.keyShares.map((ks) => [ks.partyId, ks]));
    const partials = decryptingPartyIds.map((id) => {
      const ks = byId.get(id);
      if (!ks) {
        throw new PqmpcError("PQMPC_SHAPE_MISMATCH", `unknown custodian ${id}`);
      }
      if (keys.publishedCommitments[id] !== ks.commitment) {
        throw new PqmpcError("PQMPC_COMMITMENT_MISMATCH", `custodian ${id} commitment differs from published value`);
      }
      return this.partialDecrypt(aggregate, ks);
    });
    const sum = this.combinePartialDecryptions(aggregate, partials);
    return {
      sum,
      contributors: inputs.length,
      decryptingParties: [...decryptingPartyIds],
      aggregateDigest: sha256Hex(`${aggregate.c0.join(",")}|${aggregate.c1.join(",")}`),
    };
  }

  // ---------------------------------------------------------------------------
  // Audit (FR-6)
  // ---------------------------------------------------------------------------

  /** Run correctness self-tests and emit a receipt with SHA-256 digest and security notice. */
  public audit(): PqmpcAuditReceipt {
    const secret = 0x1f2e3d4c5b6an;
    const shares = this.shamirSplit(secret);
    const shamirRoundTrip =
      this.shamirReconstruct(shares.slice(0, this.threshold)) === secret &&
      this.shamirReconstruct(shares.slice(-this.threshold)) === secret;

    const belowThresholdRejected = this.expectError("PQMPC_BELOW_THRESHOLD", () =>
      this.shamirReconstruct(shares.slice(0, this.threshold - 1)),
    );
    const tampered = shares.slice(0, this.threshold).map((s, i) => (i === 0 ? { ...s, y: modq(s.y + 1n, this.q) } : s));
    const tamperDetected = this.expectError("PQMPC_COMMITMENT_MISMATCH", () => this.shamirReconstruct(tampered));

    const keys = this.generateThresholdKeys();
    const slots = Math.min(3, this.n);
    const vecA = [1n, 2n, 3n].slice(0, slots).map((v) => v % this.t);
    const vecB = [4n, 5n, 6n].slice(0, slots).map((v) => v % this.t);
    const ctA1 = this.encryptVector(keys.publicKey, vecA);
    const ctA2 = this.encryptVector(keys.publicKey, vecA);
    const encryptionRandomized = ctA1.c0.some((c, i) => c !== ctA2.c0[i]);

    const sumCt = this.addCiphertexts(ctA1, this.encryptVector(keys.publicKey, vecB));
    const quorum = keys.keyShares.slice(0, this.threshold).map((ks) => this.partialDecrypt(sumCt, ks));
    const decrypted = this.combinePartialDecryptions(sumCt, quorum);
    const expected = vecA.map((v, i) => (v + vecB[i]) % this.t);
    const homomorphicAggregation = decrypted.every((v, i) => v === expected[i]);

    const altQuorum = keys.keyShares.slice(-this.threshold).map((ks) => this.partialDecrypt(sumCt, ks));
    const altDecrypted = this.combinePartialDecryptions(sumCt, altQuorum);
    const thresholdDecryption =
      altDecrypted.every((v, i) => v === expected[i]) &&
      this.expectError("PQMPC_BELOW_THRESHOLD", () =>
        this.combinePartialDecryptions(sumCt, quorum.slice(0, this.threshold - 1)),
      );

    const allPassed =
      shamirRoundTrip &&
      belowThresholdRejected &&
      tamperDetected &&
      encryptionRandomized &&
      homomorphicAggregation &&
      thresholdDecryption;

    const parameters = {
      ringDegree: this.n,
      ciphertextModulus: this.q.toString(),
      plaintextModulus: this.t.toString(),
      parties: this.parties,
      threshold: this.threshold,
    };
    const body = {
      specRef: "SPEC-335" as const,
      parameters,
      shamirRoundTrip,
      belowThresholdRejected,
      tamperDetected,
      encryptionRandomized,
      homomorphicAggregation,
      thresholdDecryption,
      allPassed,
      securityNotice: PQMPC_SECURITY_NOTICE,
    };
    return { ...body, sha256Digest: sha256Hex(JSON.stringify(body)) };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private expectError(code: PqmpcErrorCode, fn: () => unknown): boolean {
    try {
      fn();
      return false;
    } catch (err) {
      return err instanceof PqmpcError && err.code === code;
    }
  }

  private decode(poly: PqmpcPolynomial): bigint[] {
    // m = round(t · x / q) mod t
    const twoQ = 2n * this.q;
    return poly.map((x) => ((2n * this.t * modq(x, this.q) + this.q) / twoQ) % this.t);
  }

  private evaluatePolynomial(coefficients: bigint[], x: bigint): bigint {
    let acc = 0n;
    for (let i = coefficients.length - 1; i >= 0; i--) {
      acc = (acc * x + coefficients[i]) % this.q;
    }
    return acc;
  }

  private commitShare(x: bigint, y: bigint): string {
    return sha256Hex(`pqmpc-share|${x.toString()}|${modq(y, this.q).toString()}`);
  }

  private commitPolynomial(x: bigint, poly: PqmpcPolynomial): string {
    return sha256Hex(`pqmpc-keyshare|${x.toString()}|${poly.join(",")}`);
  }

  private sampleUniform(): bigint {
    const mask = (1n << BigInt(this.qBits)) - 1n;
    for (;;) {
      const v = this.rng.nextU64() & mask;
      if (v < this.q) return v;
    }
  }

  private sampleUniformPolynomial(): PqmpcPolynomial {
    return Array.from({ length: this.n }, () => this.sampleUniform());
  }

  /** Uniform ternary coefficients {-1, 0, 1} via rejection sampling on 2 bits. */
  private sampleTernaryPolynomial(): PqmpcPolynomial {
    const out = new Array<bigint>(this.n);
    for (let i = 0; i < this.n; i++) {
      let r = 3n;
      while (r === 3n) r = this.rng.nextU64() & 3n;
      out[i] = modq(r - 1n, this.q);
    }
    return out;
  }

  /** Centered binomial distribution with η = 2: coefficients in [-2, 2]. */
  private sampleNoisePolynomial(): PqmpcPolynomial {
    const out = new Array<bigint>(this.n);
    for (let i = 0; i < this.n; i++) {
      const bits = this.rng.nextU64();
      const a = (bits & 1n) + ((bits >> 1n) & 1n);
      const b = ((bits >> 2n) & 1n) + ((bits >> 3n) & 1n);
      out[i] = modq(a - b, this.q);
    }
    return out;
  }

  private polyAdd(a: PqmpcPolynomial, b: PqmpcPolynomial): PqmpcPolynomial {
    return a.map((c, i) => (c + b[i]) % this.q);
  }

  private polyNeg(a: PqmpcPolynomial): PqmpcPolynomial {
    return a.map((c) => (c === 0n ? 0n : this.q - c));
  }

  /** Negacyclic schoolbook multiplication in Z_q[x]/(x^n + 1). */
  private polyMul(a: PqmpcPolynomial, b: PqmpcPolynomial): PqmpcPolynomial {
    const acc = new Array<bigint>(this.n).fill(0n);
    for (let i = 0; i < this.n; i++) {
      const ai = a[i];
      if (ai === 0n) continue;
      for (let j = 0; j < this.n; j++) {
        const k = i + j;
        if (k < this.n) acc[k] += ai * b[j];
        else acc[k - this.n] -= ai * b[j];
      }
    }
    return acc.map((c) => modq(c, this.q));
  }

  private assertPolynomialShape(poly: PqmpcPolynomial): void {
    if (!Array.isArray(poly) || poly.length !== this.n) {
      throw new PqmpcError("PQMPC_SHAPE_MISMATCH", `expected polynomial of degree ${this.n}`);
    }
  }

  private assertCiphertext(ct: PqmpcCiphertext): void {
    this.assertPolynomialShape(ct.c0);
    this.assertPolynomialShape(ct.c1);
  }
}
