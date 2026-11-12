/**
 * EOS Layer-0 Bulletproofs NIZK Range Proofs Core (SPEC-222, CHANGE-107)
 * Zero-Knowledge Range Proofs without Trusted Setup (Bünz et al.)
 * Strict Zero Runtime Dependencies (EOS Law I & V), Node 24 Strip-Only TypeScript.
 */

import crypto from "node:crypto";
import {
  SECP256K1_P,
  SECP256K1_Q,
  SECP256K1_G,
  secpMod,
  modInverse,
  pointAdd,
  pointMultiply,
  isOnCurve,
  hashToCurve,
  serializePoint,
} from "./eosVerifiableRandomFunctionCore.ts";
import type { AffinePoint, SecpPoint } from "./eosVerifiableRandomFunctionCore.types.ts";
import type {
  BulletproofsGenerators,
  BulletproofsCommitment,
  InnerProductProof,
  BulletproofsRangeProof,
  BulletproofsVerificationResult,
  BulletproofsReceipt,
  BulletproofsBenchmarkResult,
} from "./eosBulletproofsRangeProofCore.types.ts";

export * from "./eosBulletproofsRangeProofCore.types.ts";

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

function sha256Hex(data: string | Uint8Array): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function sha256BigInt(...parts: (string | bigint | number | AffinePoint | null)[]): bigint {
  const hash = crypto.createHash("sha256");
  for (const p of parts) {
    if (p === null) {
      hash.update("null");
    } else if (typeof p === "object" && "x" in p && "y" in p) {
      hash.update(p.x.toString(16).padStart(64, "0"));
      hash.update(p.y.toString(16).padStart(64, "0"));
    } else {
      hash.update(String(p));
    }
  }
  return secpMod(BigInt("0x" + hash.digest("hex")), SECP256K1_Q);
}

function randomScalar(): bigint {
  while (true) {
    const buf = crypto.randomBytes(32);
    const n = BigInt("0x" + buf.toString("hex"));
    const s = secpMod(n, SECP256K1_Q);
    if (s > 0n && s < SECP256K1_Q) {
      return s;
    }
  }
}

function vectorInnerProduct(a: readonly bigint[], b: readonly bigint[]): bigint {
  let s = 0n;
  for (let i = 0; i < a.length; i++) {
    s = secpMod(s + a[i] * b[i], SECP256K1_Q);
  }
  return s;
}

function vectorAdd(a: readonly bigint[], b: readonly bigint[]): bigint[] {
  return a.map((val, idx) => secpMod(val + b[idx], SECP256K1_Q));
}

function vectorSub(a: readonly bigint[], b: readonly bigint[]): bigint[] {
  return a.map((val, idx) => secpMod(val - b[idx], SECP256K1_Q));
}

function vectorMul(a: readonly bigint[], b: readonly bigint[]): bigint[] {
  return a.map((val, idx) => secpMod(val * b[idx], SECP256K1_Q));
}

function vectorScale(a: readonly bigint[], scalar: bigint): bigint[] {
  return a.map((val) => secpMod(val * scalar, SECP256K1_Q));
}

function multiExp(points: readonly AffinePoint[], scalars: readonly bigint[]): SecpPoint {
  let acc: SecpPoint = null;
  for (let i = 0; i < points.length; i++) {
    if (scalars[i] === 0n) continue;
    const pt = pointMultiply(scalars[i], points[i]);
    acc = pointAdd(acc, pt);
  }
  return acc;
}

export class EosBulletproofsRangeProofCore {
  private static readonly generatorCache = new Map<number, BulletproofsGenerators>();
  private static readonly H_POINT: AffinePoint = hashToCurve("BULLETPROOFS_H_GENERATOR");
  private static readonly U_POINT: AffinePoint = hashToCurve("BULLETPROOFS_U_GENERATOR");

  /**
   * Deterministically setup and cache transparent vector generators g and h for bitLength m.
   */
  public static setupGenerators(bitLength: number = 32): BulletproofsGenerators {
    if (![4, 8, 16, 32, 64].includes(bitLength)) {
      throw new Error(`Unsupported Bulletproofs bit length ${bitLength}. Allowed: 4, 8, 16, 32, 64.`);
    }
    const cached = this.generatorCache.get(bitLength);
    if (cached) return cached;

    const g: AffinePoint[] = [];
    const h: AffinePoint[] = [];
    for (let i = 0; i < bitLength; i++) {
      g.push(hashToCurve(`BP_G_${i}`));
      h.push(hashToCurve(`BP_H_${i}`));
    }

    const params: BulletproofsGenerators = deepFreeze({
      bitLength,
      g,
      h,
      H: this.H_POINT,
      U: this.U_POINT,
    });
    this.generatorCache.set(bitLength, params);
    return params;
  }

  /**
   * Compute a Pedersen commitment V = v * G + gamma * H.
   */
  public static commit(value: bigint | number, gamma?: bigint): BulletproofsCommitment {
    const v = BigInt(value);
    if (v < 0n) {
      throw new Error(`Commitment value must be non-negative: ${v}`);
    }
    const blinding = gamma !== undefined ? secpMod(gamma, SECP256K1_Q) : randomScalar();
    const vG = pointMultiply(v, SECP256K1_G);
    const gammaH = pointMultiply(blinding, this.H_POINT);
    const V = pointAdd(vG, gammaH);
    if (!V || !isOnCurve(V)) {
      throw new Error("Failed to compute valid curve point for commitment");
    }

    return deepFreeze({
      value: v,
      gamma: blinding,
      point: V,
      pointHex: serializePoint(V),
    });
  }

  /**
   * Generate a Bulletproofs NIZK range proof that v in [0, 2^bitLength - 1].
   */
  public static prove(value: bigint | number, gamma?: bigint, bitLength: number = 32): BulletproofsRangeProof {
    const v = BigInt(value);
    const maxBound = 1n << BigInt(bitLength);
    if (v < 0n || v >= maxBound) {
      throw new Error(`Value ${v} out of bounds for range [0, 2^${bitLength} - 1]`);
    }

    const blinding = gamma !== undefined ? secpMod(gamma, SECP256K1_Q) : randomScalar();
    const comm = this.commit(v, blinding);
    const V = comm.point;

    const params = this.setupGenerators(bitLength);
    const { g, h, H, U } = params;

    // Bit decomposition of v
    const aL: bigint[] = [];
    let temp = v;
    for (let i = 0; i < bitLength; i++) {
      aL.push(temp & 1n);
      temp >>= 1n;
    }
    const aR: bigint[] = aL.map((b) => secpMod(b - 1n, SECP256K1_Q));

    // Blinding vectors and scalars
    const alpha = randomScalar();
    const rho = randomScalar();
    const sL: bigint[] = Array.from({ length: bitLength }, () => randomScalar());
    const sR: bigint[] = Array.from({ length: bitLength }, () => randomScalar());

    // Vector commitments A and S
    const A = pointAdd(pointMultiply(alpha, H), pointAdd(multiExp(g, aL), multiExp(h, aR)));
    const S = pointAdd(pointMultiply(rho, H), pointAdd(multiExp(g, sL), multiExp(h, sR)));
    if (!A || !S) throw new Error("Failed to compute vector commitments A or S");

    // Fiat-Shamir challenges y and z
    const y = sha256BigInt("BP_CHALLENGE_Y", V, A, S);
    const z = sha256BigInt("BP_CHALLENGE_Z", y);

    // Vector powers
    const yPowers: bigint[] = [];
    const yInvPowers: bigint[] = [];
    let yp = 1n;
    const yInv = modInverse(y, SECP256K1_Q);
    let yip = 1n;
    for (let i = 0; i < bitLength; i++) {
      yPowers.push(yp);
      yInvPowers.push(yip);
      yp = secpMod(yp * y, SECP256K1_Q);
      yip = secpMod(yip * yInv, SECP256K1_Q);
    }

    // Scaled generators h' = y^-i * h_i
    const hPrime: AffinePoint[] = h.map((pt, i) => {
      const res = pointMultiply(yInvPowers[i], pt);
      if (!res) throw new Error("Point multiplication yielded null");
      return res;
    });

    const twoPowers: bigint[] = [];
    let tp = 1n;
    for (let i = 0; i < bitLength; i++) {
      twoPowers.push(tp);
      tp = secpMod(tp * 2n, SECP256K1_Q);
    }

    // Polynomial construction l(X) and r(X)
    const zOnes = new Array(bitLength).fill(z);
    const l0 = vectorSub(aL, zOnes);
    const l1 = sL;

    const z2 = secpMod(z * z, SECP256K1_Q);
    const r0 = vectorAdd(vectorMul(yPowers, vectorAdd(aR, zOnes)), vectorScale(twoPowers, z2));
    const r1 = vectorMul(yPowers, sR);

    // Quadratic polynomial coefficients
    const t1 = secpMod(vectorInnerProduct(l0, r1) + vectorInnerProduct(l1, r0), SECP256K1_Q);
    const t2 = vectorInnerProduct(l1, r1);

    const tau1 = randomScalar();
    const tau2 = randomScalar();
    const T1 = pointAdd(pointMultiply(t1, SECP256K1_G), pointMultiply(tau1, H));
    const T2 = pointAdd(pointMultiply(t2, SECP256K1_G), pointMultiply(tau2, H));
    if (!T1 || !T2) throw new Error("Failed to compute polynomial commitments T1 or T2");

    // Fiat-Shamir challenge x
    const x = sha256BigInt("BP_CHALLENGE_X", z, T1, T2);
    const x2 = secpMod(x * x, SECP256K1_Q);

    // Polynomial evaluations at challenge x
    const lEval = vectorAdd(l0, vectorScale(l1, x));
    const rEval = vectorAdd(r0, vectorScale(r1, x));
    const tHat = vectorInnerProduct(lEval, rEval);

    const tauX = secpMod(secpMod(tau2 * x2 + tau1 * x, SECP256K1_Q) + z2 * blinding, SECP256K1_Q);
    const mu = secpMod(alpha + rho * x, SECP256K1_Q);

    // Recursive Inner Product Argument Folding
    let gCurr = [...g];
    let hCurr = [...hPrime];
    let aCurr = [...lEval];
    let bCurr = [...rEval];

    const LVec: AffinePoint[] = [];
    const RVec: AffinePoint[] = [];
    const rounds = Math.log2(bitLength);
    let transcript = String(x);

    for (let r = 0; r < rounds; r++) {
      const k = aCurr.length / 2;
      const aLo = aCurr.slice(0, k);
      const aHi = aCurr.slice(k);
      const bLo = bCurr.slice(0, k);
      const bHi = bCurr.slice(k);

      const gLo = gCurr.slice(0, k);
      const gHi = gCurr.slice(k);
      const hLo = hCurr.slice(0, k);
      const hHi = hCurr.slice(k);

      const cL = vectorInnerProduct(aLo, bHi);
      const cR = vectorInnerProduct(aHi, bLo);

      const L = pointAdd(pointAdd(multiExp(gHi, aLo), multiExp(hLo, bHi)), pointMultiply(cL, U));
      const R = pointAdd(pointAdd(multiExp(gLo, aHi), multiExp(hHi, bLo)), pointMultiply(cR, U));
      if (!L || !R) throw new Error("Inner product round folding produced invalid point");

      LVec.push(L);
      RVec.push(R);

      const uK = sha256BigInt(transcript, L, R);
      transcript = uK.toString();
      const uKInv = modInverse(uK, SECP256K1_Q);

      const nextG: AffinePoint[] = [];
      const nextH: AffinePoint[] = [];
      for (let i = 0; i < k; i++) {
        const foldedG = pointAdd(pointMultiply(uKInv, gLo[i]), pointMultiply(uK, gHi[i]));
        const foldedH = pointAdd(pointMultiply(uK, hLo[i]), pointMultiply(uKInv, hHi[i]));
        if (!foldedG || !foldedH) throw new Error("Folded generator yielded null");
        nextG.push(foldedG);
        nextH.push(foldedH);
      }
      gCurr = nextG;
      hCurr = nextH;

      const nextA: bigint[] = [];
      const nextB: bigint[] = [];
      for (let i = 0; i < k; i++) {
        nextA.push(secpMod(uK * aLo[i] + uKInv * aHi[i], SECP256K1_Q));
        nextB.push(secpMod(uKInv * bLo[i] + uK * bHi[i], SECP256K1_Q));
      }
      aCurr = nextA;
      bCurr = nextB;
    }

    const proofDigest = sha256Hex(
      JSON.stringify({
        comm: comm.pointHex,
        A: serializePoint(A),
        S: serializePoint(S),
        T1: serializePoint(T1),
        T2: serializePoint(T2),
        tauX: tauX.toString(16),
        mu: mu.toString(16),
        tHat: tHat.toString(16),
        a: aCurr[0].toString(16),
        b: bCurr[0].toString(16),
      }),
    );

    return deepFreeze({
      commitment: V,
      commitmentHex: comm.pointHex,
      bitLength,
      A,
      S,
      T1,
      T2,
      tauX,
      mu,
      tHat,
      ipProof: {
        L: LVec,
        R: RVec,
        a: aCurr[0],
        b: bCurr[0],
      },
      proofSha256: proofDigest,
    });
  }

  /**
   * Verify a Bulletproofs NIZK range proof.
   */
  public static verify(
    proof: BulletproofsRangeProof,
    expectedCommitment?: AffinePoint,
  ): BulletproofsVerificationResult {
    const startTime = performance.now();
    const { commitment, bitLength, A, S, T1, T2, tauX, mu, tHat, ipProof } = proof;

    const V = commitment;
    if (expectedCommitment) {
      if (V.x !== expectedCommitment.x || V.y !== expectedCommitment.y) {
        return this.makeVerificationResult(false, bitLength, startTime, "Commitment mismatch");
      }
    }

    // Basic curve validation
    const pointsToCheck = [V, A, S, T1, T2, ...ipProof.L, ...ipProof.R];
    for (const pt of pointsToCheck) {
      if (!pt || !isOnCurve(pt)) {
        return this.makeVerificationResult(false, bitLength, startTime, "Invalid point on curve");
      }
    }

    const params = this.setupGenerators(bitLength);
    const { g, h, H, U } = params;

    const rounds = Math.log2(bitLength);
    if (ipProof.L.length !== rounds || ipProof.R.length !== rounds) {
      return this.makeVerificationResult(false, bitLength, startTime, "Invalid inner product proof length");
    }

    // Transcript replay for y, z
    const y = sha256BigInt("BP_CHALLENGE_Y", V, A, S);
    const z = sha256BigInt("BP_CHALLENGE_Z", y);

    const yPowers: bigint[] = [];
    const yInvPowers: bigint[] = [];
    let yp = 1n;
    const yInv = modInverse(y, SECP256K1_Q);
    let yip = 1n;
    for (let i = 0; i < bitLength; i++) {
      yPowers.push(yp);
      yInvPowers.push(yip);
      yp = secpMod(yp * y, SECP256K1_Q);
      yip = secpMod(yip * yInv, SECP256K1_Q);
    }

    const hPrime: AffinePoint[] = h.map((pt, i) => {
      const p = pointMultiply(yInvPowers[i], pt);
      if (!p) throw new Error("Invalid point multiplication");
      return p;
    });

    const twoPowers: bigint[] = [];
    let tp = 1n;
    for (let i = 0; i < bitLength; i++) {
      twoPowers.push(tp);
      tp = secpMod(tp * 2n, SECP256K1_Q);
    }

    const z2 = secpMod(z * z, SECP256K1_Q);

    // Delta(y, z)
    let sumY = 0n;
    for (const val of yPowers) sumY = secpMod(sumY + val, SECP256K1_Q);
    const sumTwo = secpMod((1n << BigInt(bitLength)) - 1n, SECP256K1_Q);
    const delta = secpMod(
      secpMod(z - z2, SECP256K1_Q) * sumY - secpMod(secpMod(z2 * z, SECP256K1_Q) * sumTwo, SECP256K1_Q),
      SECP256K1_Q,
    );

    // Transcript replay for x
    const x = sha256BigInt("BP_CHALLENGE_X", z, T1, T2);
    const x2 = secpMod(x * x, SECP256K1_Q);

    // Check Polynomial Identity:
    // tHat * G + tauX * H == z^2 * V + delta * G + x * T1 + x^2 * T2
    const polyLhs = pointAdd(pointMultiply(tHat, SECP256K1_G), pointMultiply(tauX, H));
    const polyRhs = pointAdd(
      pointAdd(pointMultiply(z2, V), pointMultiply(delta, SECP256K1_G)),
      pointAdd(pointMultiply(x, T1), pointMultiply(x2, T2)),
    );

    if (!polyLhs || !polyRhs || polyLhs.x !== polyRhs.x || polyLhs.y !== polyRhs.y) {
      return this.makeVerificationResult(false, bitLength, startTime, "Polynomial identity failed");
    }

    // Construct commitment to inner product P_comm
    let pComm: SecpPoint = pointAdd(A, pointMultiply(x, S));
    pComm = pointAdd(pComm, pointMultiply(secpMod(-mu, SECP256K1_Q), H));
    for (let i = 0; i < bitLength; i++) {
      pComm = pointAdd(pComm, pointMultiply(secpMod(-z, SECP256K1_Q), g[i]));
      const coeffHPrime = secpMod(z * yPowers[i] + z2 * twoPowers[i], SECP256K1_Q);
      pComm = pointAdd(pComm, pointMultiply(coeffHPrime, hPrime[i]));
    }
    const pPrime = pointAdd(pComm, pointMultiply(tHat, U));

    // Replay inner product argument challenges
    let transcript = String(x);
    const uChallenges: bigint[] = [];
    for (let r = 0; r < rounds; r++) {
      const uK = sha256BigInt(transcript, ipProof.L[r], ipProof.R[r]);
      transcript = uK.toString();
      uChallenges.push(uK);
    }

    // Fold P_prime with L and R
    let foldedP = pPrime;
    for (let r = 0; r < rounds; r++) {
      const uK = uChallenges[r];
      const uKInv = modInverse(uK, SECP256K1_Q);
      const u2 = secpMod(uK * uK, SECP256K1_Q);
      const uInv2 = secpMod(uKInv * uKInv, SECP256K1_Q);
      foldedP = pointAdd(foldedP, pointAdd(pointMultiply(u2, ipProof.L[r]), pointMultiply(uInv2, ipProof.R[r])));
    }

    // Fold generators
    let gCurr = [...g];
    let hCurr = [...hPrime];
    for (const uK of uChallenges) {
      const k = gCurr.length / 2;
      const uKInv = modInverse(uK, SECP256K1_Q);
      const nextG: AffinePoint[] = [];
      const nextH: AffinePoint[] = [];
      for (let i = 0; i < k; i++) {
        const foldedG = pointAdd(pointMultiply(uKInv, gCurr[i]), pointMultiply(uK, gCurr[k + i]));
        const foldedH = pointAdd(pointMultiply(uK, hCurr[i]), pointMultiply(uKInv, hCurr[k + i]));
        if (!foldedG || !foldedH) {
          return this.makeVerificationResult(false, bitLength, startTime, "Generator folding failed");
        }
        nextG.push(foldedG);
        nextH.push(foldedH);
      }
      gCurr = nextG;
      hCurr = nextH;
    }

    const gFinal = gCurr[0];
    const hFinal = hCurr[0];

    // Final target check:
    // foldedP == a * gFinal + b * hFinal + (a * b) * U
    const finalTarget = pointAdd(
      pointAdd(pointMultiply(ipProof.a, gFinal), pointMultiply(ipProof.b, hFinal)),
      pointMultiply(secpMod(ipProof.a * ipProof.b, SECP256K1_Q), U),
    );

    if (!foldedP || !finalTarget || foldedP.x !== finalTarget.x || foldedP.y !== finalTarget.y) {
      return this.makeVerificationResult(false, bitLength, startTime, "Inner product verification failed");
    }

    return this.makeVerificationResult(true, bitLength, startTime);
  }

  /**
   * Run performance benchmarks for Bulletproofs operations.
   */
  public static benchmark(iterations: number = 5, bitLength: number = 16): BulletproofsBenchmarkResult {
    const iters = Math.max(1, iterations);
    this.setupGenerators(bitLength);

    // Benchmark commitments
    const t0Commit = performance.now();
    for (let i = 0; i < iters; i++) {
      this.commit(100n + BigInt(i));
    }
    const commitTimeMs = performance.now() - t0Commit;
    const commitOpsPerSec = Math.round((iters / (commitTimeMs / 1000)) * 100) / 100;

    // Benchmark proves
    const proofs: BulletproofsRangeProof[] = [];
    const t0Prove = performance.now();
    for (let i = 0; i < iters; i++) {
      proofs.push(this.prove(250n + BigInt(i), undefined, bitLength));
    }
    const proveTimeMs = performance.now() - t0Prove;
    const proveOpsPerSec = Math.round((iters / (proveTimeMs / 1000)) * 100) / 100;
    const averageProveTimeMs = Math.round((proveTimeMs / iters) * 100) / 100;

    // Benchmark verifies
    const t0Verify = performance.now();
    for (let i = 0; i < iters; i++) {
      this.verify(proofs[i]);
    }
    const verifyTimeMs = performance.now() - t0Verify;
    const verifyOpsPerSec = Math.round((iters / (verifyTimeMs / 1000)) * 100) / 100;
    const averageVerifyTimeMs = Math.round((verifyTimeMs / iters) * 100) / 100;

    const receipt: BulletproofsReceipt = deepFreeze({
      receiptId: `rcpt-bp-bench-${Date.now()}`,
      operation: "benchmark",
      bitLength,
      timestamp: new Date().toISOString(),
      digest: sha256Hex(`bench:${bitLength}:${iters}:${proveOpsPerSec}:${verifyOpsPerSec}`),
      receiptSha256: sha256Hex(JSON.stringify({ bitLength, iters, proveOpsPerSec, verifyOpsPerSec })),
    });

    return deepFreeze({
      bitLength,
      iterations: iters,
      commitOpsPerSec,
      proveOpsPerSec,
      verifyOpsPerSec,
      averageProveTimeMs,
      averageVerifyTimeMs,
      receipt,
    });
  }

  private static makeVerificationResult(
    valid: boolean,
    bitLength: number,
    startTime: number,
    reason?: string,
  ): BulletproofsVerificationResult {
    const elapsed = Math.round((performance.now() - startTime) * 100) / 100;
    const receipt: BulletproofsReceipt = deepFreeze({
      receiptId: `rcpt-bp-verify-${Date.now()}`,
      operation: "verify",
      bitLength,
      timestamp: new Date().toISOString(),
      digest: sha256Hex(`verify:${bitLength}:${valid}:${reason || "ok"}`),
      receiptSha256: sha256Hex(JSON.stringify({ valid, bitLength, elapsed, reason })),
    });

    return deepFreeze({
      valid,
      bitLength,
      verificationTimeMs: elapsed,
      reason,
      receipt,
    });
  }
}
