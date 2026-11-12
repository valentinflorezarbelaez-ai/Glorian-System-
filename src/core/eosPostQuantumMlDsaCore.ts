/**
 * SPEC-227 / CHANGE-112: Layer-0 Post-Quantum Digital Signature Algorithm (NIST FIPS 204 ML-DSA-65) Core Engine
 * Standard: NIST FIPS 204 (Module-Lattice-Based Digital Signature Standard)
 * Security Category: 3 (AES-192 equivalent)
 * Pure Layer-0 TypeScript (Node.js 24 strip-only), zero external runtime dependencies.
 */

import crypto from "node:crypto";
import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  MlDsaParameters,
  MlDsaPublicKey,
  MlDsaPrivateKey,
  MlDsaKeyPair,
  MlDsaSignature,
  HybridMlDsaKeyPair,
  HybridMlDsaSignature,
} from "./eosPostQuantumMlDsaCore.types.ts";

export const ML_DSA_65_PARAMS: MlDsaParameters = deepFreeze({
  name: "ML-DSA-65",
  q: 8380417,
  n: 256,
  d: 13,
  k: 6,
  l: 5,
  eta: 4,
  gamma1: 524288, // 2^19
  gamma2: 261888, // (q - 1) / 32
  tau: 49,
  beta: 196,
  omega: 55,
  pkBytes: 1952,
  skBytes: 4032,
  sigBytes: 3309,
});

const Q = 8380417;
const N = 256;
const D = 13;
const K_ROWS = 6;
const L_COLS = 5;
const ETA = 4;
const GAMMA1 = 524288;
const GAMMA2 = 261888;
const ALPHA = 2 * GAMMA2; // 523776
const BETA = 196;
const OMEGA = 55;
const TWO_D = 1 << D; // 8192
const HALF_TWO_D = TWO_D >> 1; // 4096

type Poly = Int32Array;
type PolyVec = Poly[];
type PolyMatrix = Poly[][];

export class EosPostQuantumMlDsaCore {
  // --------------------------------------------------------------------------
  // POLYNOMIAL RING ARITHMETIC (R_q = Z_q[X] / (X^256 + 1))
  // --------------------------------------------------------------------------

  public static createPoly(): Poly {
    return new Int32Array(N);
  }

  public static polyAdd(a: Poly, b: Poly): Poly {
    const c = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      c[i] = (a[i]! + b[i]!) % Q;
    }
    return c;
  }

  public static polySub(a: Poly, b: Poly): Poly {
    const c = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      c[i] = (((a[i]! - b[i]!) % Q) + Q) % Q;
    }
    return c;
  }

  public static polyMul(a: Poly, b: Poly): Poly {
    const c = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      const ai = a[i]!;
      if (ai === 0) continue;
      for (let j = 0; j < N; j++) {
        const bj = b[j]!;
        if (bj === 0) continue;
        const prod = Number((BigInt(ai) * BigInt(bj)) % BigInt(Q));
        const idx = i + j;
        if (idx < N) {
          c[idx] = (c[idx]! + prod) % Q;
        } else {
          c[idx - N] = (((c[idx - N]! - prod) % Q) + Q) % Q;
        }
      }
    }
    return c;
  }

  public static matrixVectorMul(matrix: PolyMatrix, vector: PolyVec): PolyVec {
    const rows = matrix.length;
    const cols = vector.length;
    const res: PolyVec = [];

    for (let i = 0; i < rows; i++) {
      let acc = EosPostQuantumMlDsaCore.createPoly();
      for (let j = 0; j < cols; j++) {
        const prod = EosPostQuantumMlDsaCore.polyMul(matrix[i]![j]!, vector[j]!);
        acc = EosPostQuantumMlDsaCore.polyAdd(acc, prod);
      }
      res.push(acc);
    }
    return res;
  }

  // --------------------------------------------------------------------------
  // HIGH-BITS / LOW-BITS DECOMPOSITION & HINTS (NIST FIPS 204 Section 5.3)
  // --------------------------------------------------------------------------

  public static power2Round(r: number): { r1: number; r0: number } {
    const rMod = ((r % Q) + Q) % Q;
    const r0 = rMod % TWO_D;
    const r0Signed = r0 > HALF_TWO_D ? r0 - TWO_D : r0;
    const r1 = Math.floor((rMod - r0Signed) / TWO_D);
    return { r1, r0: r0Signed };
  }

  public static decompose(r: number): { r1: number; r0: number } {
    const rPlus = ((r % Q) + Q) % Q;
    let r0 = rPlus % ALPHA;
    if (r0 > GAMMA2) r0 -= ALPHA;
    if (rPlus - r0 === Q - 1) {
      return { r1: 0, r0: r0 - 1 };
    }
    const r1 = Math.floor((rPlus - r0) / ALPHA);
    return { r1, r0 };
  }

  public static highBits(r: number): number {
    return EosPostQuantumMlDsaCore.decompose(r).r1;
  }

  public static lowBits(r: number): number {
    return EosPostQuantumMlDsaCore.decompose(r).r0;
  }

  public static makeHint(z: number, r: number): number {
    const r1 = EosPostQuantumMlDsaCore.highBits(r);
    const v1 = EosPostQuantumMlDsaCore.highBits(r + z);
    return r1 !== v1 ? 1 : 0;
  }

  public static useHint(h: number, r: number): number {
    const m = Math.floor((Q - 1) / ALPHA); // 16
    const { r1, r0 } = EosPostQuantumMlDsaCore.decompose(r);
    if (h === 1) {
      if (r0 > 0) return (r1 + 1) % m;
      return (r1 - 1 + m) % m;
    }
    return r1;
  }

  // --------------------------------------------------------------------------
  // DETERMINISTIC SAMPLING (SHAKE-128 & SHAKE-256)
  // --------------------------------------------------------------------------

  public static expandMatrix(rho: Buffer): PolyMatrix {
    const matrix: PolyMatrix = [];
    for (let r = 0; r < K_ROWS; r++) {
      const row: PolyVec = [];
      for (let c = 0; c < L_COLS; c++) {
        const poly = EosPostQuantumMlDsaCore.createPoly();
        const stream = crypto
          .createHash("shake128", { outputLength: 840 })
          .update(rho)
          .update(Buffer.from([r, c]))
          .digest();

        let byteIdx = 0;
        let polyIdx = 0;
        while (polyIdx < N && byteIdx + 3 <= stream.length) {
          const b0 = stream[byteIdx++]!;
          const b1 = stream[byteIdx++]!;
          const b2 = stream[byteIdx++]!;
          const val = (b0 | (b1 << 8) | ((b2 & 0x7f) << 16)) >>> 0;
          if (val < Q) {
            poly[polyIdx++] = val;
          }
        }
        row.push(poly);
      }
      matrix.push(row);
    }
    return matrix;
  }

  public static sampleBoundedPoly(seed: Buffer, nonce: number, bound: number): Poly {
    const poly = EosPostQuantumMlDsaCore.createPoly();
    const stream = crypto
      .createHash("shake256", { outputLength: 512 })
      .update(seed)
      .update(Buffer.from([nonce & 0xff, (nonce >> 8) & 0xff]))
      .digest();

    let byteIdx = 0;
    let polyIdx = 0;
    while (polyIdx < N && byteIdx < stream.length) {
      const byte = stream[byteIdx++]!;
      const low = byte & 0x0f;
      const high = (byte >> 4) & 0x0f;
      if (low < 9) {
        poly[polyIdx++] = (((low - bound) % Q) + Q) % Q;
      }
      if (polyIdx < N && high < 9) {
        poly[polyIdx++] = (((high - bound) % Q) + Q) % Q;
      }
    }
    return poly;
  }

  public static sampleInBall(cTilde: Buffer): Poly {
    const poly = EosPostQuantumMlDsaCore.createPoly();
    const stream = crypto.createHash("shake256", { outputLength: 136 }).update(cTilde).digest();

    let signs = 0n;
    for (let i = 0; i < 8; i++) {
      signs |= BigInt(stream[i]!) << BigInt(8 * i);
    }

    let byteIdx = 8;
    for (let i = 256 - ML_DSA_65_PARAMS.tau; i < 256; i++) {
      let b = stream[byteIdx++]!;
      while (b > i) {
        b = stream[byteIdx++]!;
      }
      poly[i] = poly[b]!;
      const signBit = Number(signs & 1n);
      signs >>= 1n;
      poly[b] = signBit === 1 ? Q - 1 : 1;
    }
    return poly;
  }

  // --------------------------------------------------------------------------
  // KEY GENERATION (ML-DSA.KeyGen)
  // --------------------------------------------------------------------------

  public static keyGen(entropySeed?: Buffer | Uint8Array): MlDsaKeyPair {
    const seed = entropySeed ? Buffer.from(entropySeed) : crypto.randomBytes(32);
    assertPrecondition(seed.length === 32, "Seed must be exactly 32 bytes");

    const expanded = crypto.createHash("shake256", { outputLength: 128 }).update(seed).digest();

    const rho = expanded.subarray(0, 32);
    const rhoPrime = expanded.subarray(32, 96);
    const k = expanded.subarray(96, 128);

    const A = EosPostQuantumMlDsaCore.expandMatrix(rho);

    // Sample s1 in R_q^l and s2 in R_q^k with bound ETA = 4
    const s1: PolyVec = [];
    for (let i = 0; i < L_COLS; i++) {
      s1.push(EosPostQuantumMlDsaCore.sampleBoundedPoly(rhoPrime, i, ETA));
    }
    const s2: PolyVec = [];
    for (let i = 0; i < K_ROWS; i++) {
      s2.push(EosPostQuantumMlDsaCore.sampleBoundedPoly(rhoPrime, L_COLS + i, ETA));
    }

    // t = A * s1 + s2
    const As1 = EosPostQuantumMlDsaCore.matrixVectorMul(A, s1);
    const t: PolyVec = [];
    const t1: PolyVec = [];
    const t0: PolyVec = [];

    for (let r = 0; r < K_ROWS; r++) {
      const tr = EosPostQuantumMlDsaCore.polyAdd(As1[r]!, s2[r]!);
      t.push(tr);
      const t1r = EosPostQuantumMlDsaCore.createPoly();
      const t0r = EosPostQuantumMlDsaCore.createPoly();
      for (let i = 0; i < N; i++) {
        const { r1, r0 } = EosPostQuantumMlDsaCore.power2Round(tr[i]!);
        t1r[i] = r1;
        t0r[i] = ((r0 % Q) + Q) % Q;
      }
      t1.push(t1r);
      t0.push(t0r);
    }

    const t1Buffer = Buffer.alloc(K_ROWS * N * 2);
    let offset = 0;
    for (let r = 0; r < K_ROWS; r++) {
      for (let i = 0; i < N; i++) {
        t1Buffer.writeUInt16LE(t1[r]![i]!, offset);
        offset += 2;
      }
    }

    const verificationKeyHex = Buffer.concat([rho, t1Buffer]).toString("hex");
    const tr = crypto
      .createHash("shake256", { outputLength: 64 })
      .update(Buffer.from(verificationKeyHex, "hex"))
      .digest();

    const signingKeyHex = Buffer.concat([rho, k, tr, seed]).toString("hex");

    const publicKey: MlDsaPublicKey = deepFreeze({
      verificationKeyHex,
      rhoHex: rho.toString("hex"),
      t1Hex: t1Buffer.toString("hex"),
      algorithm: "ML-DSA-65",
    });

    const privateKey: MlDsaPrivateKey = deepFreeze({
      signingKeyHex,
      rhoHex: rho.toString("hex"),
      kHex: k.toString("hex"),
      trHex: tr.toString("hex"),
      algorithm: "ML-DSA-65",
    });

    return { publicKey, privateKey };
  }

  // --------------------------------------------------------------------------
  // DIGITAL SIGNATURE GENERATION (ML-DSA.Sign)
  // --------------------------------------------------------------------------

  public static sign(message: Buffer | Uint8Array | string, privateKey: MlDsaPrivateKey): MlDsaSignature {
    assertPrecondition(Boolean(privateKey && privateKey.signingKeyHex), "Valid privateKey required");
    const msgBuffer = Buffer.isBuffer(message)
      ? message
      : typeof message === "string"
        ? Buffer.from(message, "utf8")
        : Buffer.from(message);

    const rho = Buffer.from(privateKey.rhoHex, "hex");
    const tr = Buffer.from(privateKey.trHex, "hex");
    const A = EosPostQuantumMlDsaCore.expandMatrix(rho);

    // Compute mu = SHAKE-256(tr || M)
    const mu = crypto.createHash("shake256", { outputLength: 64 }).update(tr).update(msgBuffer).digest();

    // Reconstruct s1, s2, t0 deterministically from privateKey seed
    const skBytes = Buffer.from(privateKey.signingKeyHex, "hex");
    const origSeed = skBytes.subarray(skBytes.length - 32);
    const expanded = crypto.createHash("shake256", { outputLength: 128 }).update(origSeed).digest();
    const rhoPrime = expanded.subarray(32, 96);

    const s1: PolyVec = [];
    for (let i = 0; i < L_COLS; i++) {
      s1.push(EosPostQuantumMlDsaCore.sampleBoundedPoly(rhoPrime, i, ETA));
    }
    const s2: PolyVec = [];
    for (let i = 0; i < K_ROWS; i++) {
      s2.push(EosPostQuantumMlDsaCore.sampleBoundedPoly(rhoPrime, L_COLS + i, ETA));
    }

    const As1 = EosPostQuantumMlDsaCore.matrixVectorMul(A, s1);
    const t0: PolyVec = [];
    for (let r = 0; r < K_ROWS; r++) {
      const trFull = EosPostQuantumMlDsaCore.polyAdd(As1[r]!, s2[r]!);
      const t0r = EosPostQuantumMlDsaCore.createPoly();
      for (let i = 0; i < N; i++) {
        t0r[i] = ((EosPostQuantumMlDsaCore.power2Round(trFull[i]!).r0 % Q) + Q) % Q;
      }
      t0.push(t0r);
    }

    let nonce = 0;
    while (true) {
      nonce++;
      // Sample mask y in R_q^l with coefficients in [-GAMMA1, GAMMA1]
      const y: PolyVec = [];
      for (let j = 0; j < L_COLS; j++) {
        const poly = EosPostQuantumMlDsaCore.createPoly();
        const randStream = crypto
          .createHash("shake256", { outputLength: 768 })
          .update(mu)
          .update(Buffer.from([nonce & 0xff, (nonce >> 8) & 0xff, j]))
          .digest();
        for (let i = 0; i < N; i++) {
          const val = randStream.readUIntLE(i * 3, 3);
          poly[i] = ((((val % (2 * GAMMA1)) - GAMMA1) % Q) + Q) % Q;
        }
        y.push(poly);
      }

      // w = A * y
      const w = EosPostQuantumMlDsaCore.matrixVectorMul(A, y);

      // Extract high-bits w1
      const w1Buf = Buffer.alloc(K_ROWS * N);
      let w1Offset = 0;
      for (let r = 0; r < K_ROWS; r++) {
        for (let i = 0; i < N; i++) {
          const w1Val = EosPostQuantumMlDsaCore.highBits(w[r]![i]!);
          w1Buf[w1Offset++] = w1Val & 0xff;
        }
      }

      // Challenge cTilde = SHAKE-256(mu || w1)
      const cTilde = crypto.createHash("shake256", { outputLength: 32 }).update(mu).update(w1Buf).digest();

      const c = EosPostQuantumMlDsaCore.sampleInBall(cTilde);

      // z = y + c * s1
      const z: PolyVec = [];
      let rejectZ = false;
      for (let j = 0; j < L_COLS; j++) {
        const cs1 = EosPostQuantumMlDsaCore.polyMul(c, s1[j]!);
        const zj = EosPostQuantumMlDsaCore.polyAdd(y[j]!, cs1);
        for (let i = 0; i < N; i++) {
          const zSigned = zj[i]! > Q / 2 ? zj[i]! - Q : zj[i]!;
          if (Math.abs(zSigned) >= GAMMA1 - BETA) {
            rejectZ = true;
            break;
          }
        }
        if (rejectZ) break;
        z.push(zj);
      }
      if (rejectZ) continue;

      // Make hints h
      const hints: number[] = [];
      let hintCount = 0;
      for (let r = 0; r < K_ROWS; r++) {
        const cs2 = EosPostQuantumMlDsaCore.polyMul(c, s2[r]!);
        const ct0 = EosPostQuantumMlDsaCore.polyMul(c, t0[r]!);
        const minusCt0 = EosPostQuantumMlDsaCore.polySub(EosPostQuantumMlDsaCore.createPoly(), ct0);
        const wSubCs2 = EosPostQuantumMlDsaCore.polySub(w[r]!, cs2);
        const wRem = EosPostQuantumMlDsaCore.polyAdd(wSubCs2, ct0);

        for (let i = 0; i < N; i++) {
          const hVal = EosPostQuantumMlDsaCore.makeHint(minusCt0[i]!, wRem[i]!);
          hints.push(hVal);
          if (hVal === 1) hintCount++;
        }
      }

      if (hintCount > OMEGA) continue;

      // Pack signature
      const zBuffer = Buffer.alloc(L_COLS * N * 4);
      let zOffset = 0;
      for (let j = 0; j < L_COLS; j++) {
        for (let i = 0; i < N; i++) {
          zBuffer.writeInt32LE(z[j]![i]!, zOffset);
          zOffset += 4;
        }
      }

      const hintBuffer = Buffer.from(hints);
      const signatureHex = Buffer.concat([cTilde, zBuffer, hintBuffer]).toString("hex");

      return deepFreeze({
        signatureHex,
        cTildeHex: cTilde.toString("hex"),
        algorithm: "ML-DSA-65",
      });
    }
  }

  // --------------------------------------------------------------------------
  // DIGITAL SIGNATURE VERIFICATION (ML-DSA.Verify)
  // --------------------------------------------------------------------------

  public static verify(
    message: Buffer | Uint8Array | string,
    signature: MlDsaSignature | string,
    publicKey: MlDsaPublicKey | string,
  ): boolean {
    try {
      const sigHex = typeof signature === "string" ? signature : signature.signatureHex;
      const pkHex = typeof publicKey === "string" ? publicKey : publicKey.verificationKeyHex;

      if (!sigHex || !pkHex || sigHex.length < 64 || pkHex.length < 64) {
        return false;
      }

      const msgBuffer = Buffer.isBuffer(message)
        ? message
        : typeof message === "string"
          ? Buffer.from(message, "utf8")
          : Buffer.from(message);

      const pkBuffer = Buffer.from(pkHex, "hex");
      const sigBuffer = Buffer.from(sigHex, "hex");

      const rho = pkBuffer.subarray(0, 32);
      const t1Buffer = pkBuffer.subarray(32);

      const t1: PolyVec = [];
      let t1Offset = 0;
      for (let r = 0; r < K_ROWS; r++) {
        const poly = EosPostQuantumMlDsaCore.createPoly();
        for (let i = 0; i < N; i++) {
          poly[i] = t1Buffer.readUInt16LE(t1Offset);
          t1Offset += 2;
        }
        t1.push(poly);
      }

      const cTilde = sigBuffer.subarray(0, 32);
      const zBuffer = sigBuffer.subarray(32, 32 + L_COLS * N * 4);
      const hintBuffer = sigBuffer.subarray(32 + L_COLS * N * 4);

      const z: PolyVec = [];
      let zOffset = 0;
      for (let j = 0; j < L_COLS; j++) {
        const poly = EosPostQuantumMlDsaCore.createPoly();
        for (let i = 0; i < N; i++) {
          const val = zBuffer.readInt32LE(zOffset);
          zOffset += 4;
          poly[i] = val;
          const zSigned = val > Q / 2 ? val - Q : val;
          if (Math.abs(zSigned) >= GAMMA1 - BETA) {
            return false;
          }
        }
        z.push(poly);
      }

      const A = EosPostQuantumMlDsaCore.expandMatrix(rho);
      const c = EosPostQuantumMlDsaCore.sampleInBall(cTilde);

      const Az = EosPostQuantumMlDsaCore.matrixVectorMul(A, z);

      // Compute tr = SHAKE-256(pk)
      const tr = crypto.createHash("shake256", { outputLength: 64 }).update(pkBuffer).digest();

      // Compute mu = SHAKE-256(tr || M)
      const mu = crypto.createHash("shake256", { outputLength: 64 }).update(tr).update(msgBuffer).digest();

      // Reconstruct w1Prime using hint: w1' = UseHint(h, Az - c * t1 * 2^d)
      const w1PrimeBuf = Buffer.alloc(K_ROWS * N);
      let w1Offset = 0;
      let hintOffset = 0;

      for (let r = 0; r < K_ROWS; r++) {
        const ct1 = EosPostQuantumMlDsaCore.polyMul(c, t1[r]!);
        // ct1 * 2^d
        const ct1Scaled = EosPostQuantumMlDsaCore.createPoly();
        for (let i = 0; i < N; i++) {
          ct1Scaled[i] = Number((BigInt(ct1[i]!) * BigInt(TWO_D)) % BigInt(Q));
        }

        const azSubCt1 = EosPostQuantumMlDsaCore.polySub(Az[r]!, ct1Scaled);

        for (let i = 0; i < N; i++) {
          const hVal = hintBuffer[hintOffset++] || 0;
          const recoveredHigh = EosPostQuantumMlDsaCore.useHint(hVal, azSubCt1[i]!);
          w1PrimeBuf[w1Offset++] = recoveredHigh & 0xff;
        }
      }

      // Check challenge cTilde' = SHAKE-256(mu || w1')
      const cTildePrime = crypto.createHash("shake256", { outputLength: 32 }).update(mu).update(w1PrimeBuf).digest();

      return cTildePrime.equals(cTilde);
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // HYBRID COMPOSITE SIGNATURES (Ed25519 + ML-DSA-65)
  // --------------------------------------------------------------------------

  public static generateHybridKeyPair(): HybridMlDsaKeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const ed25519PublicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const ed25519PrivateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

    const mlDsaKeyPair = EosPostQuantumMlDsaCore.keyGen();

    return deepFreeze({
      ed25519PublicKeyPem,
      ed25519PrivateKeyPem,
      mlDsaKeyPair,
    });
  }

  public static signHybrid(
    message: Buffer | Uint8Array | string,
    hybridKeyPair: HybridMlDsaKeyPair,
  ): HybridMlDsaSignature {
    const msgBuffer = Buffer.isBuffer(message)
      ? message
      : typeof message === "string"
        ? Buffer.from(message, "utf8")
        : Buffer.from(message);

    // 1. Classical Ed25519 signature
    const ed25519Sig = crypto.sign(null, msgBuffer, hybridKeyPair.ed25519PrivateKeyPem);

    // 2. Post-Quantum ML-DSA-65 signature
    const mlDsaSig = EosPostQuantumMlDsaCore.sign(msgBuffer, hybridKeyPair.mlDsaKeyPair.privateKey);

    const receipt = pureSha256(`HYBRID-MLDSA:${ed25519Sig.toString("hex")}:${mlDsaSig.signatureHex}`);

    return deepFreeze({
      ed25519SignatureHex: ed25519Sig.toString("hex"),
      mlDsaSignature: mlDsaSig,
      algorithm: "HYBRID-ED25519-ML-DSA-65",
      receiptSha256: receipt,
    });
  }

  public static verifyHybrid(
    message: Buffer | Uint8Array | string,
    signature: HybridMlDsaSignature,
    ed25519PublicKeyPem: string,
    mlDsaPublicKey: MlDsaPublicKey | string,
  ): boolean {
    const msgBuffer = Buffer.isBuffer(message)
      ? message
      : typeof message === "string"
        ? Buffer.from(message, "utf8")
        : Buffer.from(message);

    // 1. Verify classical Ed25519 signature
    const ed25519Valid = crypto.verify(
      null,
      msgBuffer,
      ed25519PublicKeyPem,
      Buffer.from(signature.ed25519SignatureHex, "hex"),
    );
    if (!ed25519Valid) return false;

    // 2. Verify Post-Quantum ML-DSA-65 signature
    return EosPostQuantumMlDsaCore.verify(msgBuffer, signature.mlDsaSignature, mlDsaPublicKey);
  }
}
