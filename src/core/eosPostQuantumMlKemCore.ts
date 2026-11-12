/**
 * EOS POST-QUANTUM ML-KEM CORE (SPEC-221 / NIST FIPS 203)
 *
 * Layer-0 Module-Lattice-Based Key-Encapsulation Mechanism Standard
 * Parameter Set ML-KEM-768 (Category 3 / AES-192 equivalent).
 *
 * Implements IND-CCA2 post-quantum key encapsulation with NTT polynomial
 * arithmetic over R_q = Z_q[X]/(X^256 + 1) where q = 3329, Centered Binomial
 * Distribution noise sampling, and Fujisaki-Okamoto transform with constant-time
 * implicit rejection.
 *
 * Zero external runtime dependencies. Node 24 strip-only TypeScript.
 */

import crypto from "node:crypto";
import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  MlKemBenchmarkResult,
  MlKemDecapsulationResult,
  MlKemEncapsulationResult,
  MlKemKeyPair,
  MlKemParams,
  MlKemReceipt,
} from "./eosPostQuantumMlKemCore.types.ts";

export const ML_KEM_768_PARAMS: MlKemParams = deepFreeze({
  q: 3329,
  n: 256,
  k: 3,
  eta1: 2,
  eta2: 2,
  du: 10,
  dv: 4,
  publicKeyBytes: 1184, // 3 * 384 + 32
  secretKeyBytes: 2400, // 3 * 384 + 1184 + 32 + 32
  ciphertextBytes: 1088, // 3 * 320 + 128
  sharedSecretBytes: 32,
});

const Q = 3329;
const ZETA = 17;
const INV_128 = 3303; // 128^-1 mod 3329

function modQ(x: number): number {
  return ((x % Q) + Q) % Q;
}

function bitrev7(num: number): number {
  let r = 0;
  for (let i = 0; i < 7; i++) r = (r << 1) | ((num >> i) & 1);
  return r;
}

function modPow(base: number, exp: number): number {
  let res = 1;
  let b = modQ(base);
  let e = exp;
  while (e > 0) {
    if (e % 2 === 1) res = modQ(res * b);
    b = modQ(b * b);
    e = Math.floor(e / 2);
  }
  return res;
}

// Precomputed twiddle factor tables for NTT / INTT (FIPS 203 Section 4.3)
const ZETAS = new Int16Array(128);
for (let i = 0; i < 128; i++) {
  ZETAS[i] = modPow(ZETA, bitrev7(i));
}

function sha256Hex(data: Uint8Array | string): string {
  if (typeof data === "string") return pureSha256(data);
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function ntt(f: Int32Array): Int32Array {
  const fHat = new Int32Array(f);
  let k = 1;
  let len = 128;
  while (len >= 2) {
    let start = 0;
    while (start < 256) {
      const z = ZETAS[k++];
      for (let j = start; j < start + len; j++) {
        const t = modQ(z * fHat[j + len]);
        fHat[j + len] = modQ(fHat[j] - t);
        fHat[j] = modQ(fHat[j] + t);
      }
      start += 2 * len;
    }
    len = Math.floor(len / 2);
  }
  return fHat;
}

export function intt(fHat: Int32Array): Int32Array {
  const f = new Int32Array(fHat);
  let k = 127;
  let len = 2;
  while (len <= 128) {
    let start = 0;
    while (start < 256) {
      const z = ZETAS[k--];
      for (let j = start; j < start + len; j++) {
        const t = f[j];
        f[j] = modQ(t + f[j + len]);
        f[j + len] = modQ(z * (f[j + len] - t));
      }
      start += 2 * len;
    }
    len *= 2;
  }
  for (let j = 0; j < 256; j++) {
    f[j] = modQ(f[j] * INV_128);
  }
  return f;
}

export function multiplyNTTs(fHat: Int32Array, gHat: Int32Array): Int32Array {
  const hHat = new Int32Array(256);
  for (let i = 0; i < 128; i++) {
    const gamma = modPow(ZETA, 2 * bitrev7(i) + 1);
    const a0 = fHat[2 * i];
    const a1 = fHat[2 * i + 1];
    const b0 = gHat[2 * i];
    const b1 = gHat[2 * i + 1];
    hHat[2 * i] = modQ(a0 * b0 + a1 * b1 * gamma);
    hHat[2 * i + 1] = modQ(a0 * b1 + a1 * b0);
  }
  return hHat;
}

export function compressQ(x: number, d: number): number {
  const twoD = 1 << d;
  return Math.round((twoD / Q) * modQ(x)) % twoD;
}

export function decompressQ(y: number, d: number): number {
  const twoD = 1 << d;
  return Math.round((Q / twoD) * y);
}

export function encode12(coeffs: Int32Array): Uint8Array {
  const buf = new Uint8Array(384);
  for (let i = 0; i < 128; i++) {
    const c0 = coeffs[2 * i] & 0x0fff;
    const c1 = coeffs[2 * i + 1] & 0x0fff;
    buf[3 * i] = c0 & 0xff;
    buf[3 * i + 1] = (c0 >> 8) | ((c1 & 0x0f) << 4);
    buf[3 * i + 2] = (c1 >> 4) & 0xff;
  }
  return buf;
}

export function decode12(buf: Uint8Array): Int32Array {
  const coeffs = new Int32Array(256);
  for (let i = 0; i < 128; i++) {
    const b0 = buf[3 * i];
    const b1 = buf[3 * i + 1];
    const b2 = buf[3 * i + 2];
    coeffs[2 * i] = b0 | ((b1 & 0x0f) << 8);
    coeffs[2 * i + 1] = (b1 >> 4) | (b2 << 4);
  }
  return coeffs;
}

export function encode10(coeffs: Int32Array): Uint8Array {
  const buf = new Uint8Array(320);
  for (let i = 0; i < 64; i++) {
    const c0 = coeffs[4 * i] & 0x03ff;
    const c1 = coeffs[4 * i + 1] & 0x03ff;
    const c2 = coeffs[4 * i + 2] & 0x03ff;
    const c3 = coeffs[4 * i + 3] & 0x03ff;
    buf[5 * i] = c0 & 0xff;
    buf[5 * i + 1] = (c0 >> 8) | ((c1 & 0x3f) << 2);
    buf[5 * i + 2] = (c1 >> 6) | ((c2 & 0x0f) << 4);
    buf[5 * i + 3] = (c2 >> 4) | ((c3 & 0x03) << 6);
    buf[5 * i + 4] = (c3 >> 2) & 0xff;
  }
  return buf;
}

export function decode10(buf: Uint8Array): Int32Array {
  const coeffs = new Int32Array(256);
  for (let i = 0; i < 64; i++) {
    const b0 = buf[5 * i];
    const b1 = buf[5 * i + 1];
    const b2 = buf[5 * i + 2];
    const b3 = buf[5 * i + 3];
    const b4 = buf[5 * i + 4];
    coeffs[4 * i] = b0 | ((b1 & 0x03) << 8);
    coeffs[4 * i + 1] = (b1 >> 2) | ((b2 & 0x0f) << 6);
    coeffs[4 * i + 2] = (b2 >> 4) | ((b3 & 0x3f) << 4);
    coeffs[4 * i + 3] = (b3 >> 6) | (b4 << 2);
  }
  return coeffs;
}

export function encode4(coeffs: Int32Array): Uint8Array {
  const buf = new Uint8Array(128);
  for (let i = 0; i < 128; i++) {
    buf[i] = (coeffs[2 * i] & 0x0f) | ((coeffs[2 * i + 1] & 0x0f) << 4);
  }
  return buf;
}

export function decode4(buf: Uint8Array): Int32Array {
  const coeffs = new Int32Array(256);
  for (let i = 0; i < 128; i++) {
    coeffs[2 * i] = buf[i] & 0x0f;
    coeffs[2 * i + 1] = (buf[i] >> 4) & 0x0f;
  }
  return coeffs;
}

export function sampleNTTMatrixEntry(seed: Uint8Array, j: number, i: number): Int32Array {
  const xof = crypto.createHash("shake128", { outputLength: 840 });
  xof.update(seed);
  xof.update(Buffer.from([j, i]));
  const stream = xof.digest();
  const coeffs = new Int32Array(256);
  let pos = 0;
  let count = 0;
  while (count < 256 && pos + 2 < stream.length) {
    const b0 = stream[pos++];
    const b1 = stream[pos++];
    const b2 = stream[pos++];
    const d1 = b0 | ((b1 & 0x0f) << 8);
    const d2 = (b1 >> 4) | (b2 << 4);
    if (d1 < Q && count < 256) coeffs[count++] = d1;
    if (d2 < Q && count < 256) coeffs[count++] = d2;
  }
  return coeffs;
}

export function samplePolyCBD2(seed: Uint8Array, nonce: number): Int32Array {
  const hash = crypto.createHash("shake256", { outputLength: 128 });
  hash.update(seed);
  hash.update(Buffer.from([nonce]));
  const buf = hash.digest();
  const coeffs = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    const byteIdx = Math.floor(i / 2);
    const nibble = i % 2 === 0 ? buf[byteIdx] & 0x0f : buf[byteIdx] >> 4;
    const b0 = nibble & 1;
    const b1 = (nibble >> 1) & 1;
    const b2 = (nibble >> 2) & 1;
    const b3 = (nibble >> 3) & 1;
    const val = b0 + b1 - (b2 + b3);
    coeffs[i] = modQ(val);
  }
  return coeffs;
}

export class EosPostQuantumMlKemCore {
  public static readonly PARAMS = ML_KEM_768_PARAMS;

  /**
   * Generates an ML-KEM-768 keypair consisting of encapsulationKey (1184 B) and decapsulationKey (2400 B).
   */
  public generateKeyPair(seedZ?: Uint8Array, seedD?: Uint8Array): MlKemKeyPair {
    const z = seedZ ? Uint8Array.from(seedZ) : crypto.randomBytes(32);
    const d = seedD ? Uint8Array.from(seedD) : crypto.randomBytes(32);
    if (z.length !== 32 || d.length !== 32) {
      throw new Error("Seeds must be exactly 32 bytes in length.");
    }

    // K-PKE.KeyGen(d)
    const g = crypto.createHash("sha3-512").update(d).digest();
    const rho = g.subarray(0, 32);
    const sigma = g.subarray(32, 64);

    const sHat: Int32Array[] = [];
    const sPoly: Int32Array[] = [];
    for (let i = 0; i < 3; i++) {
      const s = samplePolyCBD2(sigma, i);
      sPoly.push(s);
      sHat.push(ntt(s));
    }

    const ePoly: Int32Array[] = [];
    for (let i = 0; i < 3; i++) {
      ePoly.push(samplePolyCBD2(sigma, 3 + i));
    }

    const AHat: Int32Array[][] = [];
    for (let i = 0; i < 3; i++) {
      AHat[i] = [];
      for (let j = 0; j < 3; j++) {
        AHat[i][j] = sampleNTTMatrixEntry(rho, j, i);
      }
    }

    const tHat: Int32Array[] = [];
    for (let i = 0; i < 3; i++) {
      const acc = new Int32Array(256);
      for (let j = 0; j < 3; j++) {
        const prod = multiplyNTTs(AHat[i][j], sHat[j]);
        for (let c = 0; c < 256; c++) acc[c] = modQ(acc[c] + prod[c]);
      }
      const eHat = ntt(ePoly[i]);
      for (let c = 0; c < 256; c++) acc[c] = modQ(acc[c] + eHat[c]);
      tHat.push(acc);
    }

    // Encapsulation key ek = ByteEncode12(tHat) || rho (1184 bytes)
    const ek = new Uint8Array(1184);
    for (let i = 0; i < 3; i++) {
      ek.set(encode12(tHat[i]), i * 384);
    }
    ek.set(rho, 3 * 384);

    // Decapsulation key dk = ByteEncode12(sHat) || ek || H(ek) || z (2400 bytes)
    const hEk = crypto.createHash("sha3-256").update(ek).digest();
    const dk = new Uint8Array(2400);
    for (let i = 0; i < 3; i++) {
      dk.set(encode12(sHat[i]), i * 384);
    }
    dk.set(ek, 1152);
    dk.set(hEk, 1152 + 1184);
    dk.set(z, 1152 + 1184 + 32);

    const receiptSha256 = pureSha256(`ML_KEM_KEYGEN:${sha256Hex(ek)}:${sha256Hex(dk)}`);

    return deepFreeze({
      encapsulationKey: ek,
      decapsulationKey: dk,
      receiptSha256,
    });
  }

  /**
   * Encapsulates a fresh 32-byte shared secret against the target encapsulation key.
   */
  public encapsulate(encapsulationKey: Uint8Array, messageSeed?: Uint8Array): MlKemEncapsulationResult {
    if (!encapsulationKey || encapsulationKey.length !== 1184) {
      throw new Error("Invalid encapsulation key: must be exactly 1184 bytes.");
    }
    const m = messageSeed ? Uint8Array.from(messageSeed) : crypto.randomBytes(32);
    if (m.length !== 32) {
      throw new Error("Message seed must be exactly 32 bytes.");
    }

    const hEk = crypto.createHash("sha3-256").update(encapsulationKey).digest();
    const kr = crypto.createHash("sha3-512").update(m).update(hEk).digest();
    const sharedSecret = Uint8Array.from(kr.subarray(0, 32));
    const rSeed = kr.subarray(32, 64);

    const ciphertext = this.kPkeEncrypt(encapsulationKey, m, rSeed);
    const receiptSha256 = pureSha256(`ML_KEM_ENCAPS:${sha256Hex(ciphertext)}:${sha256Hex(sharedSecret)}`);

    return deepFreeze({
      sharedSecret,
      ciphertext,
      receiptSha256,
    });
  }

  /**
   * Decapsulates ciphertext using the decapsulation key, executing constant-time implicit rejection if forged.
   */
  public decapsulate(decapsulationKey: Uint8Array, ciphertext: Uint8Array): MlKemDecapsulationResult {
    if (!decapsulationKey || decapsulationKey.length !== 2400) {
      throw new Error("Invalid decapsulation key: must be exactly 2400 bytes.");
    }
    if (!ciphertext || ciphertext.length !== 1088) {
      throw new Error("Invalid ciphertext: must be exactly 1088 bytes.");
    }

    const dkPke = decapsulationKey.subarray(0, 1152);
    const ek = decapsulationKey.subarray(1152, 1152 + 1184);
    const hEk = decapsulationKey.subarray(1152 + 1184, 1152 + 1184 + 32);
    const z = decapsulationKey.subarray(1152 + 1184 + 32, 2400);

    const mPrime = this.kPkeDecrypt(dkPke, ciphertext);
    const krPrime = crypto.createHash("sha3-512").update(mPrime).update(hEk).digest();
    const kPrime = Uint8Array.from(krPrime.subarray(0, 32));
    const rPrime = krPrime.subarray(32, 64);

    const cPrime = this.kPkeEncrypt(ek, mPrime, rPrime);

    // Constant-time comparison between c and cPrime
    let diff = 0;
    for (let i = 0; i < 1088; i++) {
      diff |= ciphertext[i] ^ cPrime[i];
    }
    const valid = diff === 0;

    let sharedSecret: Uint8Array;
    if (valid) {
      sharedSecret = kPrime;
    } else {
      // Implicit rejection: J(z || c)
      const xof = crypto.createHash("shake256", { outputLength: 32 });
      xof.update(z);
      xof.update(ciphertext);
      sharedSecret = Uint8Array.from(xof.digest());
    }

    const receiptSha256 = pureSha256(`ML_KEM_DECAPS:${valid}:${sha256Hex(sharedSecret)}`);

    return deepFreeze({
      sharedSecret,
      valid,
      receiptSha256,
    });
  }

  /**
   * Internal K-PKE encryption routine.
   */
  private kPkeEncrypt(ek: Uint8Array, m: Uint8Array, rSeed: Uint8Array): Uint8Array {
    const tHat: Int32Array[] = [];
    for (let i = 0; i < 3; i++) {
      tHat.push(decode12(ek.subarray(i * 384, (i + 1) * 384)));
    }
    const rho = ek.subarray(3 * 384, 3 * 384 + 32);

    const AHat: Int32Array[][] = [];
    for (let i = 0; i < 3; i++) {
      AHat[i] = [];
      for (let j = 0; j < 3; j++) {
        AHat[i][j] = sampleNTTMatrixEntry(rho, j, i);
      }
    }

    const rPoly: Int32Array[] = [];
    const rHat: Int32Array[] = [];
    const e1Poly: Int32Array[] = [];
    for (let i = 0; i < 3; i++) {
      const r = samplePolyCBD2(rSeed, i);
      rPoly.push(r);
      rHat.push(ntt(r));
      e1Poly.push(samplePolyCBD2(rSeed, 3 + i));
    }
    const e2Poly = samplePolyCBD2(rSeed, 6);

    // u = INTT(A^T * r_hat) + e1
    const u: Int32Array[] = [];
    for (let j = 0; j < 3; j++) {
      const acc = new Int32Array(256);
      for (let i = 0; i < 3; i++) {
        const prod = multiplyNTTs(AHat[i][j], rHat[i]);
        for (let c = 0; c < 256; c++) acc[c] = modQ(acc[c] + prod[c]);
      }
      const uPoly = intt(acc);
      for (let c = 0; c < 256; c++) uPoly[c] = modQ(uPoly[c] + e1Poly[j][c]);
      u.push(uPoly);
    }

    // v = INTT(t_hat^T * r_hat) + e2 + Decompress_1(m)
    const vAcc = new Int32Array(256);
    for (let i = 0; i < 3; i++) {
      const prod = multiplyNTTs(tHat[i], rHat[i]);
      for (let c = 0; c < 256; c++) vAcc[c] = modQ(vAcc[c] + prod[c]);
    }
    const v = intt(vAcc);
    for (let c = 0; c < 256; c++) {
      const byteIdx = Math.floor(c / 8);
      const bit = (m[byteIdx] >> (c % 8)) & 1;
      const mCoeff = bit ? decompressQ(1, 1) : 0;
      v[c] = modQ(v[c] + e2Poly[c] + mCoeff);
    }

    // Ciphertext c = ByteEncode10(Compress10(u)) || ByteEncode4(Compress4(v))
    const cBuf = new Uint8Array(1088);
    for (let i = 0; i < 3; i++) {
      const compU = new Int32Array(256);
      for (let idx = 0; idx < 256; idx++) compU[idx] = compressQ(u[i][idx], 10);
      cBuf.set(encode10(compU), i * 320);
    }
    const compV = new Int32Array(256);
    for (let idx = 0; idx < 256; idx++) compV[idx] = compressQ(v[idx], 4);
    cBuf.set(encode4(compV), 3 * 320);

    return cBuf;
  }

  /**
   * Internal K-PKE decryption routine.
   */
  private kPkeDecrypt(dkPke: Uint8Array, ciphertext: Uint8Array): Uint8Array {
    const sHat: Int32Array[] = [];
    for (let i = 0; i < 3; i++) {
      sHat.push(decode12(dkPke.subarray(i * 384, (i + 1) * 384)));
    }

    const u: Int32Array[] = [];
    for (let i = 0; i < 3; i++) {
      const rawU = decode10(ciphertext.subarray(i * 320, (i + 1) * 320));
      const decompU = new Int32Array(256);
      for (let idx = 0; idx < 256; idx++) decompU[idx] = decompressQ(rawU[idx], 10);
      u.push(decompU);
    }

    const rawV = decode4(ciphertext.subarray(3 * 320, 3 * 320 + 128));
    const v = new Int32Array(256);
    for (let idx = 0; idx < 256; idx++) v[idx] = decompressQ(rawV[idx], 4);

    const sTuAcc = new Int32Array(256);
    for (let i = 0; i < 3; i++) {
      const uHat = ntt(u[i]);
      const prod = multiplyNTTs(sHat[i], uHat);
      for (let c = 0; c < 256; c++) sTuAcc[c] = modQ(sTuAcc[c] + prod[c]);
    }
    const sTu = intt(sTuAcc);

    const mRecovered = new Uint8Array(32);
    for (let c = 0; c < 256; c++) {
      const diff = modQ(v[c] - sTu[c]);
      const bit = compressQ(diff, 1);
      if (bit) {
        const byteIdx = Math.floor(c / 8);
        mRecovered[byteIdx] |= 1 << (c % 8);
      }
    }

    return mRecovered;
  }

  /**
   * Executes a high-precision performance benchmark across KeyGen, Encaps, and Decaps.
   */
  public benchmark(iterations: number = 20): MlKemBenchmarkResult {
    const start = performance.now();
    let keyGenTime = 0;
    let encapsTime = 0;
    let decapsTime = 0;

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const kp = this.generateKeyPair();
      keyGenTime += performance.now() - t0;

      const t1 = performance.now();
      const enc = this.encapsulate(kp.encapsulationKey);
      encapsTime += performance.now() - t1;

      const t2 = performance.now();
      this.decapsulate(kp.decapsulationKey, enc.ciphertext);
      decapsTime += performance.now() - t2;
    }

    const totalDurationMs = performance.now() - start;
    const keyGenOpsPerSec = Math.round((iterations / (keyGenTime / 1000)) * 10) / 10;
    const encapsOpsPerSec = Math.round((iterations / (encapsTime / 1000)) * 10) / 10;
    const decapsOpsPerSec = Math.round((iterations / (decapsTime / 1000)) * 10) / 10;

    const receiptSha256 = pureSha256(`ML_KEM_BENCHMARK:${iterations}:${totalDurationMs}`);

    return deepFreeze({
      keyGenOpsPerSec,
      encapsOpsPerSec,
      decapsOpsPerSec,
      totalDurationMs,
      receiptSha256,
    });
  }

  // Static ergonomics
  public static generateKeyPair(seedZ?: Uint8Array, seedD?: Uint8Array): MlKemKeyPair {
    return new EosPostQuantumMlKemCore().generateKeyPair(seedZ, seedD);
  }

  public static encapsulate(encapsulationKey: Uint8Array, messageSeed?: Uint8Array): MlKemEncapsulationResult {
    return new EosPostQuantumMlKemCore().encapsulate(encapsulationKey, messageSeed);
  }

  public static decapsulate(decapsulationKey: Uint8Array, ciphertext: Uint8Array): MlKemDecapsulationResult {
    return new EosPostQuantumMlKemCore().decapsulate(decapsulationKey, ciphertext);
  }
}
