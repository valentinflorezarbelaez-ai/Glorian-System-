/**
 * EosKernelPrimitives (Layer 0 — Pure Domain Primitives & Design by Contract)
 * SPEC-041: Autonomous Continuous Refactoring Engine & Code Diet Optimizer
 *
 * Centralized, zero-dependency kernel primitives for Design by Contract (DbC),
 * cryptographic integrity, deterministic pseudo-random number generation,
 * and immutable data structures.
 *
 * ZERO external dependencies — strictly pure TypeScript.
 */

// ============================================================================
// 1. DESIGN BY CONTRACT (DbC — Meyer 1988)
// ============================================================================

export class ContractError extends Error {
  public readonly contractType: "PRECONDITION" | "POSTCONDITION" | "INVARIANT";

  constructor(type: "PRECONDITION" | "POSTCONDITION" | "INVARIANT", message: string) {
    super(`[${type}_FAILED] ${message}`);
    this.name = "ContractError";
    this.contractType = type;
  }
}

/**
 * Asserts that a method's precondition is satisfied prior to execution.
 * Throws ContractError("PRECONDITION_FAILED") if false.
 */
export function assertPrecondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new ContractError("PRECONDITION", message);
  }
}

/**
 * Asserts that a method's postcondition is satisfied prior to returning.
 * Throws ContractError("POSTCONDITION_FAILED") if false.
 */
export function assertPostcondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new ContractError("POSTCONDITION", message);
  }
}

/**
 * Asserts that a class or system invariant is preserved after state transition.
 * Throws ContractError("INVARIANT_FAILED") if false.
 */
export function assertInvariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new ContractError("INVARIANT", message);
  }
}

/**
 * Recursively freezes an object and all nested properties to guarantee complete immutability.
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Skip typed arrays (Uint8Array etc.) — cannot freeze ArrayBuffer views
  if (ArrayBuffer.isView(obj)) {
    return obj;
  }

  // Freeze standard objects/arrays
  Object.freeze(obj);

  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = (obj as any)[key];
    if (val !== null && (typeof val === "object" || typeof val === "function") && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }

  return obj as Readonly<T>;
}

// ============================================================================
// 2. CRYPTOGRAPHIC & HASHING DETERMINISM (FIPS 180-4 SHA-256)
// ============================================================================

export function pureSha256(asciiOrUtf8: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < asciiOrUtf8.length; i++) {
    let code = asciiOrUtf8.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (asciiOrUtf8.charCodeAt(i) & 0x3ff));
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length + 8) % 64 !== 0) bytes.push(0x00);

  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  for (let i = 3; i >= 0; i--) bytes.push((highBits >>> (i * 8)) & 0xff);
  for (let i = 3; i >= 0; i--) bytes.push((lowBits >>> (i * 8)) & 0xff);

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
    0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
    0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
    0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ];

  let h0 = 0x6a09e667 >>> 0;
  let h1 = 0xbb67ae85 >>> 0;
  let h2 = 0x3c6ef372 >>> 0;
  let h3 = 0xa54ff53a >>> 0;
  let h4 = 0x510e527f >>> 0;
  let h5 = 0x9b05688c >>> 0;
  let h6 = 0x1f83d9ab >>> 0;
  let h7 = 0x5be0cd19 >>> 0;

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const idx = offset + i * 4;
      const b0 = bytes[idx] ?? 0;
      const b1 = bytes[idx + 1] ?? 0;
      const b2 = bytes[idx + 2] ?? 0;
      const b3 = bytes[idx + 3] ?? 0;
      w[i] = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10)) >>> 0;
      w[i] = (((w[i - 16]! + s0) >>> 0) + ((w[i - 7]! + s1) >>> 0)) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (((h + S1) >>> 0) + ((ch + (K[i] ?? 0)) >>> 0) + w[i]!) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const toHex = (n: number): string => n.toString(16).padStart(8, "0");
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

// ============================================================================
// 3. DETERMINISTIC PRNG (Mulberry32)
// ============================================================================

export function createMulberry32(seed: number = 1337): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// 4. RESULT CONTAINER (Functional Error Handling)
// ============================================================================

export type Result<T, E = Error> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function Ok<T>(value: T): Result<T, never> {
  return Object.freeze({ ok: true, value });
}

export function Err<E>(error: E): Result<never, E> {
  return Object.freeze({ ok: false, error });
}
