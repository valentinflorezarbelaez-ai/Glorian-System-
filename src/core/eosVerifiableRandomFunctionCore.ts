/**
 * EOS Layer-0 Verifiable Random Functions (ECVRF RFC 9381) Core (SPEC-217)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 * Enforces IEEE 830 EARS FR-1104..FR-1108 and ISO/IEC/IEEE 29148 BDD-1104..BDD-1108.
 */

import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  type AffinePoint,
  type SecpPoint,
  type VrfKeyPair,
  type VrfProof,
  type VrfEvaluationResult,
  type VrfVerificationResult,
  type VrfElectionResult,
  type VrfReceipt,
  type VrfOperationType,
} from "./eosVerifiableRandomFunctionCore.types.ts";

/* -------------------------------------------------------------------------- */
/* Design by Contract (DbC) Helpers                                          */
/* -------------------------------------------------------------------------- */

function assertPrecondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[PRECONDITION_FAILED] ${message}`);
  }
}

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function pureSha256(data: string | Uint8Array): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* Secp256k1 Curve Constants and Field Arithmetic (FR-1104)                   */
/* -------------------------------------------------------------------------- */

export const SECP256K1_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
export const SECP256K1_Q = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
export const SECP256K1_B = 7n;

export const SECP256K1_G: AffinePoint = deepFreeze({
  x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
});

export function secpMod(a: bigint, m: bigint): bigint {
  const result = a % m;
  return result >= 0n ? result : result + m;
}
const mod = secpMod;

export function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [mod(a, m), m];
  let [oldS, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }

  assertPrecondition(oldR === 1n, "Value is not invertible modulo m");
  return mod(oldS, m);
}

export function modSqrt(a: bigint, p: bigint): bigint {
  // secp256k1 prime p ≡ 3 (mod 4), so sqrt(a) = a^((p+1)/4) mod p
  return modExp(a, (p + 1n) / 4n, p);
}

export function modExp(base: bigint, exponent: bigint, m: bigint): bigint {
  let result = 1n;
  let b = mod(base, m);
  let e = exponent;

  while (e > 0n) {
    if ((e & 1n) === 1n) {
      result = mod(result * b, m);
    }
    b = mod(b * b, m);
    e >>= 1n;
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Elliptic Curve Point Operations                                            */
/* -------------------------------------------------------------------------- */

export function isOnCurve(point: AffinePoint): boolean {
  const lhs = mod(point.y * point.y, SECP256K1_P);
  const rhs = mod(point.x * point.x * point.x + SECP256K1_B, SECP256K1_P);
  return lhs === rhs;
}

export function pointAdd(p1: SecpPoint, p2: SecpPoint): SecpPoint {
  if (p1 === null) return p2;
  if (p2 === null) return p1;

  if (p1.x === p2.x) {
    if (p1.y !== p2.y || p1.y === 0n) {
      return null; // Point at infinity
    }
    return pointDouble(p1);
  }

  const slope = mod((p2.y - p1.y) * modInverse(p2.x - p1.x, SECP256K1_P), SECP256K1_P);
  const x3 = mod(slope * slope - p1.x - p2.x, SECP256K1_P);
  const y3 = mod(slope * (p1.x - x3) - p1.y, SECP256K1_P);

  return { x: x3, y: y3 };
}

export function pointDouble(point: AffinePoint): SecpPoint {
  if (point.y === 0n) return null;

  const slope = mod(3n * point.x * point.x * modInverse(2n * point.y, SECP256K1_P), SECP256K1_P);
  const x3 = mod(slope * slope - 2n * point.x, SECP256K1_P);
  const y3 = mod(slope * (point.x - x3) - point.y, SECP256K1_P);

  return { x: x3, y: y3 };
}

export function pointMultiply(scalar: bigint, point: SecpPoint): SecpPoint {
  if (point === null) return null;
  const k = mod(scalar, SECP256K1_Q);
  if (k === 0n) return null;

  let result: SecpPoint = null;
  let addend: SecpPoint = point;
  let s = k;

  while (s > 0n) {
    if ((s & 1n) === 1n) {
      result = pointAdd(result, addend);
    }
    if (addend !== null) {
      addend = pointDouble(addend);
    }
    s >>= 1n;
  }

  return result;
}

export function serializePoint(point: SecpPoint): string {
  if (point === null) return "00";
  const prefix = (point.y & 1n) === 0n ? "02" : "03";
  const xHex = point.x.toString(16).padStart(64, "0");
  return `${prefix}${xHex}`;
}

export function hashToCurve(alpha: string): AffinePoint {
  let counter = 0;
  while (counter < 1000) {
    const seed = `secp256k1_vrf_h2c:${alpha}:${counter}`;
    const xCandidate = BigInt(`0x${pureSha256(seed)}`) % SECP256K1_P;
    const ySquared = mod(xCandidate * xCandidate * xCandidate + SECP256K1_B, SECP256K1_P);
    const yCandidate = modSqrt(ySquared, SECP256K1_P);

    if (mod(yCandidate * yCandidate, SECP256K1_P) === ySquared) {
      const matchParity = (yCandidate & 1n) === (BigInt(counter) & 1n);
      const y = matchParity ? yCandidate : SECP256K1_P - yCandidate;
      return { x: xCandidate, y };
    }
    counter++;
  }
  throw new Error("Failed to find curve point in hashToCurve");
}

/* -------------------------------------------------------------------------- */
/* Layer-0 ECVRF Core Class (RFC 9381)                                        */
/* -------------------------------------------------------------------------- */

export class EosVerifiableRandomFunctionCore {
  /**
   * Generates a deterministic or random key pair for ECVRF.
   */
  public static generateKeyPair(seed?: string): VrfKeyPair {
    let secretKey: bigint;
    if (seed) {
      secretKey = mod(BigInt(`0x${pureSha256(`vrf-sk-seed:${seed}`)}`), SECP256K1_Q - 1n) + 1n;
    } else {
      const randBytes = crypto.randomBytes(32);
      secretKey = mod(BigInt(`0x${randBytes.toString("hex")}`), SECP256K1_Q - 1n) + 1n;
    }

    const pubPoint = pointMultiply(secretKey, SECP256K1_G);
    assertPrecondition(pubPoint !== null, "Public key point must not be at infinity");

    return deepFreeze({
      secretKey,
      secretKeyHex: secretKey.toString(16).padStart(64, "0"),
      publicKey: pubPoint,
      publicKeyHex: serializePoint(pubPoint),
    });
  }

  /**
   * Evaluates VRF on input alpha and generates non-interactive proof pi (FR-1105).
   */
  public evaluate(secretKey: bigint, alpha: string): VrfEvaluationResult {
    assertPrecondition(secretKey > 0n && secretKey < SECP256K1_Q, "Secret key out of valid scalar range");

    const H = hashToCurve(alpha);
    const gammaPoint = pointMultiply(secretKey, H);
    assertPrecondition(gammaPoint !== null, "Gamma point cannot be at infinity");

    const pubPoint = pointMultiply(secretKey, SECP256K1_G);
    assertPrecondition(pubPoint !== null, "Public key cannot be at infinity");

    // Deterministic nonce k derived via RFC 6979 principle
    const kSeed = pureSha256(
      `eos-vrf-nonce:${secretKey.toString(16)}:${H.x.toString(16)}:${H.y.toString(16)}:${alpha}`,
    );
    const k = mod(BigInt(`0x${kSeed}`), SECP256K1_Q - 1n) + 1n;

    const U = pointMultiply(k, SECP256K1_G);
    const V = pointMultiply(k, H);
    assertPrecondition(U !== null && V !== null, "Commitment points cannot be at infinity");

    // Fiat-Shamir challenge c
    const challengeDigest = pureSha256(
      `eos-vrf-challenge:${serializePoint(SECP256K1_G)}:${serializePoint(H)}:${serializePoint(pubPoint)}:${serializePoint(gammaPoint)}:${serializePoint(U)}:${serializePoint(V)}`,
    );
    const c = mod(BigInt(`0x${challengeDigest}`), SECP256K1_Q);

    // Schnorr response scalar s = (k + c * sk) mod q
    const s = mod(k + c * secretKey, SECP256K1_Q);

    const gammaHex = serializePoint(gammaPoint);
    const beta = pureSha256(`eos-vrf-beta:${gammaHex}`);

    const proof: VrfProof = {
      gamma: gammaPoint,
      gammaHex,
      c,
      cHex: c.toString(16).padStart(64, "0"),
      s,
      sHex: s.toString(16).padStart(64, "0"),
    };

    const receipt = this._createReceipt("evaluate", beta, `sk:${pubPoint.x.toString(16).slice(0, 16)}`);

    return deepFreeze({
      beta,
      proof,
      receipt,
    });
  }

  /**
   * Verifies an ECVRF proof against public key PK and input alpha (FR-1106).
   */
  public verify(publicKey: AffinePoint, alpha: string, proof: VrfProof): VrfVerificationResult {
    const startTime = performance.now();

    if (!isOnCurve(publicKey) || !isOnCurve(proof.gamma)) {
      const elapsedMs = performance.now() - startTime;
      return deepFreeze({
        valid: false,
        beta: "",
        verificationTimeMs: elapsedMs,
        receipt: this._createReceipt("verify", "INVALID_POINT", "INVALID"),
      });
    }

    const H = hashToCurve(alpha);

    // U' = s * G - c * PK = s * G + (-c mod q) * PK
    const sG = pointMultiply(proof.s, SECP256K1_G);
    const negC = mod(-proof.c, SECP256K1_Q);
    const negCPk = pointMultiply(negC, publicKey);
    const UPrime = pointAdd(sG, negCPk);

    // V' = s * H - c * Gamma = s * H + (-c mod q) * Gamma
    const sH = pointMultiply(proof.s, H);
    const negCGamma = pointMultiply(negC, proof.gamma);
    const VPrime = pointAdd(sH, negCGamma);

    if (UPrime === null || VPrime === null) {
      const elapsedMs = performance.now() - startTime;
      return deepFreeze({
        valid: false,
        beta: "",
        verificationTimeMs: elapsedMs,
        receipt: this._createReceipt("verify", "INFINITY_COMMITMENT", "INVALID"),
      });
    }

    const challengeDigest = pureSha256(
      `eos-vrf-challenge:${serializePoint(SECP256K1_G)}:${serializePoint(H)}:${serializePoint(publicKey)}:${serializePoint(proof.gamma)}:${serializePoint(UPrime)}:${serializePoint(VPrime)}`,
    );
    const cPrime = mod(BigInt(`0x${challengeDigest}`), SECP256K1_Q);

    const valid = cPrime === proof.c;
    const beta = valid ? pureSha256(`eos-vrf-beta:${serializePoint(proof.gamma)}`) : "";
    const elapsedMs = performance.now() - startTime;

    const receipt = this._createReceipt("verify", valid ? beta : "VERIFICATION_FAILED", valid ? "VALID" : "REJECTED");

    return deepFreeze({
      valid,
      beta,
      verificationTimeMs: elapsedMs,
      receipt,
    });
  }

  /**
   * Evaluates leader election against threshold fraction in [0.0, 1.0] (FR-1107).
   */
  public isElected(beta: string, thresholdFraction: number): VrfElectionResult {
    assertPrecondition(
      thresholdFraction >= 0 && thresholdFraction <= 1,
      "Threshold fraction must be in range [0.0, 1.0]",
    );

    const betaBigInt = BigInt(`0x${beta}`);
    const max256 = (1n << 256n) - 1n;
    // Score normalized to float [0.0, 1.0]
    const score = Number(betaBigInt >> 192n) / Number(1n << 64n);
    const isElected = score < thresholdFraction;

    const receipt = this._createReceipt("elect", beta, isElected ? "ELECTED" : "NOT_ELECTED");

    return deepFreeze({
      isElected,
      score,
      threshold: thresholdFraction,
      beta,
      receipt,
    });
  }

  private _createReceipt(operation: VrfOperationType, digest: string, outputTag?: string): VrfReceipt {
    const timestamp = new Date().toISOString();
    const receiptId = `eos-vrf-${operation}-${pureSha256(`${digest}:${timestamp}`).slice(0, 16)}`;
    const tag = outputTag ?? digest;
    const receiptSha256 = pureSha256(`${receiptId}:${digest}:${tag}:${timestamp}`);
    return deepFreeze({
      receiptId,
      operation,
      timestamp,
      digest,
      receiptSha256,
    });
  }
}
