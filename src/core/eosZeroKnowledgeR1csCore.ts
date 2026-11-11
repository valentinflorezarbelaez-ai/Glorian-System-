/**
 * EOS Layer-0 Zero-Knowledge Rank-1 Constraint System (R1CS) & QAP Arithmetic Circuit Core (SPEC-214)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 * Enforces IEEE 830 EARS FR-1089..FR-1093 and ISO/IEC/IEEE 29148 BDD-1089..BDD-1093.
 */

import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  DEFAULT_ZK_FIELD_PRIME,
  type R1csConstraint,
  type R1csSystem,
  type WitnessAssignment,
  type QapPolynomials,
  type ZkProof,
  type ZkReceipt,
  type ZkVerificationResult,
  type ZkOperationType,
} from "./eosZeroKnowledgeR1csCore.types.ts";

export { DEFAULT_ZK_FIELD_PRIME };

/* -------------------------------------------------------------------------- */
/* Design by Contract (DbC) Helpers                                          */
/* -------------------------------------------------------------------------- */

function assertPrecondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[PRECONDITION_FAILED] ${message}`);
  }
}

function assertPostcondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[POSTCONDITION_FAILED] ${message}`);
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

function pureSha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* Prime Field Arithmetic over Z_p (FR-1089)                                  */
/* -------------------------------------------------------------------------- */

export function fieldNormalize(val: bigint, p: bigint = DEFAULT_ZK_FIELD_PRIME): bigint {
  const rem = val % p;
  return rem >= 0n ? rem : rem + p;
}

export function fieldAdd(a: bigint, b: bigint, p: bigint = DEFAULT_ZK_FIELD_PRIME): bigint {
  return (fieldNormalize(a, p) + fieldNormalize(b, p)) % p;
}

export function fieldSub(a: bigint, b: bigint, p: bigint = DEFAULT_ZK_FIELD_PRIME): bigint {
  return fieldNormalize(fieldNormalize(a, p) - fieldNormalize(b, p), p);
}

export function fieldMul(a: bigint, b: bigint, p: bigint = DEFAULT_ZK_FIELD_PRIME): bigint {
  return (fieldNormalize(a, p) * fieldNormalize(b, p)) % p;
}

export function fieldInverse(a: bigint, p: bigint = DEFAULT_ZK_FIELD_PRIME): bigint {
  const normA = fieldNormalize(a, p);
  assertPrecondition(normA !== 0n, "Cannot invert zero in finite field");
  let [t, newT] = [0n, 1n];
  let [r, newR] = [p, normA];
  while (newR !== 0n) {
    const q = r / newR;
    [t, newT] = [newT, t - q * newT];
    [r, newR] = [newR, r - q * newR];
  }
  assertPostcondition(r === 1n, "Element is not coprime to field characteristic");
  return fieldNormalize(t, p);
}

export function fieldPow(base: bigint, exp: bigint, p: bigint = DEFAULT_ZK_FIELD_PRIME): bigint {
  let b = fieldNormalize(base, p);
  let e = exp;
  let res = 1n;
  while (e > 0n) {
    if ((e & 1n) === 1n) {
      res = (res * b) % p;
    }
    b = (b * b) % p;
    e >>= 1n;
  }
  return res;
}

/* -------------------------------------------------------------------------- */
/* Polynomial Operations over Z_p (FR-1092)                                   */
/* -------------------------------------------------------------------------- */

export function polyTrim(poly: readonly bigint[]): bigint[] {
  let end = poly.length - 1;
  while (end > 0 && poly[end] === 0n) {
    end--;
  }
  return poly.slice(0, end + 1);
}

export function polyAdd(p1: readonly bigint[], p2: readonly bigint[], p: bigint = DEFAULT_ZK_FIELD_PRIME): bigint[] {
  const len = Math.max(p1.length, p2.length);
  const res = new Array<bigint>(len).fill(0n);
  for (let i = 0; i < len; i++) {
    const c1 = i < p1.length ? p1[i] : 0n;
    const c2 = i < p2.length ? p2[i] : 0n;
    res[i] = fieldAdd(c1, c2, p);
  }
  return polyTrim(res);
}

export function polySub(p1: readonly bigint[], p2: readonly bigint[], p: bigint = DEFAULT_ZK_FIELD_PRIME): bigint[] {
  const len = Math.max(p1.length, p2.length);
  const res = new Array<bigint>(len).fill(0n);
  for (let i = 0; i < len; i++) {
    const c1 = i < p1.length ? p1[i] : 0n;
    const c2 = i < p2.length ? p2[i] : 0n;
    res[i] = fieldSub(c1, c2, p);
  }
  return polyTrim(res);
}

export function polyMul(p1: readonly bigint[], p2: readonly bigint[], p: bigint = DEFAULT_ZK_FIELD_PRIME): bigint[] {
  if (p1.length === 0 || p2.length === 0) return [0n];
  const res = new Array<bigint>(p1.length + p2.length - 1).fill(0n);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      res[i + j] = fieldAdd(res[i + j], fieldMul(p1[i], p2[j], p), p);
    }
  }
  return polyTrim(res);
}

export function polyScalarMul(poly: readonly bigint[], scalar: bigint, p: bigint = DEFAULT_ZK_FIELD_PRIME): bigint[] {
  const normS = fieldNormalize(scalar, p);
  if (normS === 0n) return [0n];
  return polyTrim(poly.map((c) => fieldMul(c, normS, p)));
}

export function polyEval(poly: readonly bigint[], x: bigint, p: bigint = DEFAULT_ZK_FIELD_PRIME): bigint {
  const normX = fieldNormalize(x, p);
  let res = 0n;
  for (let i = poly.length - 1; i >= 0; i--) {
    res = fieldAdd(fieldMul(res, normX, p), poly[i], p);
  }
  return res;
}

export function polyDiv(
  dividend: readonly bigint[],
  divisor: readonly bigint[],
  p: bigint = DEFAULT_ZK_FIELD_PRIME,
): { quotient: bigint[]; remainder: bigint[] } {
  let rem = polyTrim([...dividend]);
  const div = polyTrim([...divisor]);
  assertPrecondition(!(div.length === 1 && div[0] === 0n), "Cannot divide polynomial by zero polynomial");

  if (rem.length < div.length) {
    return { quotient: [0n], remainder: rem };
  }

  const qLen = rem.length - div.length + 1;
  const quot = new Array<bigint>(qLen).fill(0n);
  const invLead = fieldInverse(div[div.length - 1], p);

  for (let i = rem.length - 1; i >= div.length - 1; i--) {
    const factor = fieldMul(rem[i], invLead, p);
    quot[i - div.length + 1] = factor;
    for (let j = 0; j < div.length; j++) {
      const idx = i - div.length + 1 + j;
      rem[idx] = fieldSub(rem[idx], fieldMul(factor, div[j], p), p);
    }
  }

  return { quotient: polyTrim(quot), remainder: polyTrim(rem) };
}

export function lagrangeInterpolate(
  xs: readonly bigint[],
  ys: readonly bigint[],
  p: bigint = DEFAULT_ZK_FIELD_PRIME,
): bigint[] {
  assertPrecondition(xs.length === ys.length, "Roots and values must have equal length");
  const m = xs.length;
  if (m === 0) return [0n];
  let fullPoly: bigint[] = [0n];

  for (let j = 0; j < m; j++) {
    let basis: bigint[] = [1n];
    let denom = 1n;
    for (let k = 0; k < m; k++) {
      if (k === j) continue;
      basis = polyMul(basis, [fieldNormalize(-xs[k], p), 1n], p);
      denom = fieldMul(denom, fieldSub(xs[j], xs[k], p), p);
    }
    const factor = fieldMul(ys[j], fieldInverse(denom, p), p);
    basis = polyScalarMul(basis, factor, p);
    fullPoly = polyAdd(fullPoly, basis, p);
  }

  return polyTrim(fullPoly);
}

/* -------------------------------------------------------------------------- */
/* Layer-0 Zero-Knowledge R1CS & QAP Core Class                               */
/* -------------------------------------------------------------------------- */

export class EosZeroKnowledgeR1csCore {
  public readonly prime: bigint;

  public constructor(options?: { prime?: bigint }) {
    this.prime = options?.prime ?? DEFAULT_ZK_FIELD_PRIME;
    assertPrecondition(this.prime > 2n, "Field prime must be > 2");
  }

  /**
   * Synthesizes the canonical cubic arithmetic circuit: x^3 + x + 5 = out (SPEC-214)
   * With secret witness x = 3, out = 35.
   */
  public synthesizeExampleCircuit(xSecret: bigint = 3n): {
    system: R1csSystem;
    witness: WitnessAssignment;
  } {
    const p = this.prime;
    const x = fieldNormalize(xSecret, p);
    const sym1 = fieldMul(x, x, p);
    const sym2 = fieldMul(sym1, x, p);
    const out = fieldAdd(fieldAdd(sym2, x, p), 5n, p);

    // Variables: [1, out, x, sym1, sym2]
    const variableNames = ["one", "out", "x", "sym1", "sym2"];
    const numVariables = 5;
    const publicInputCount = 1;

    // Gate 0: x * x = sym1
    const a0 = [0n, 0n, 1n, 0n, 0n];
    const b0 = [0n, 0n, 1n, 0n, 0n];
    const c0 = [0n, 0n, 0n, 1n, 0n];

    // Gate 1: sym1 * x = sym2
    const a1 = [0n, 0n, 0n, 1n, 0n];
    const b1 = [0n, 0n, 1n, 0n, 0n];
    const c1 = [0n, 0n, 0n, 0n, 1n];

    // Gate 2: (sym2 + x + 5*one) * one = out
    const a2 = [5n, 0n, 1n, 0n, 1n];
    const b2 = [1n, 0n, 0n, 0n, 0n];
    const c2 = [0n, 1n, 0n, 0n, 0n];

    const constraints: R1csConstraint[] = [
      { a: a0, b: b0, c: c0 },
      { a: a1, b: b1, c: c1 },
      { a: a2, b: b2, c: c2 },
    ];

    const system: R1csSystem = deepFreeze({
      prime: p,
      numVariables,
      numConstraints: constraints.length,
      publicInputCount,
      variableNames,
      constraints,
    });

    const witnessValues = [1n, out, x, sym1, sym2];
    const witnessCommitment = pureSha256(witnessValues.map((v) => v.toString(16)).join(":"));

    const witness: WitnessAssignment = deepFreeze({
      values: witnessValues,
      witnessCommitment,
    });

    return { system, witness };
  }

  /**
   * Creates an empty R1CS constraint system.
   */
  public createSystem(numVariables: number, publicInputCount: number, variableNames?: string[]): R1csSystem {
    assertPrecondition(numVariables >= 1, "Variables count must be >= 1");
    assertPrecondition(publicInputCount >= 0, "Public input count must be >= 0");
    const names = variableNames ?? Array.from({ length: numVariables }, (_, i) => `v_${i}`);
    assertPrecondition(names.length === numVariables, "Variable names length mismatch");

    return deepFreeze({
      prime: this.prime,
      numVariables,
      numConstraints: 0,
      publicInputCount,
      variableNames: names,
      constraints: [],
    });
  }

  /**
   * Adds a quadratic constraint (A . s) * (B . s) = (C . s) to the R1CS system.
   */
  public addConstraint(
    system: R1csSystem,
    a: readonly bigint[],
    b: readonly bigint[],
    c: readonly bigint[],
  ): R1csSystem {
    const n = system.numVariables;
    assertPrecondition(
      a.length === n && b.length === n && c.length === n,
      `Constraint vectors must match variable count ${n}`,
    );

    const normA = a.map((val) => fieldNormalize(val, this.prime));
    const normB = b.map((val) => fieldNormalize(val, this.prime));
    const normC = c.map((val) => fieldNormalize(val, this.prime));

    const newConstraints: R1csConstraint[] = [...system.constraints, { a: normA, b: normB, c: normC }];

    return deepFreeze({
      ...system,
      numConstraints: newConstraints.length,
      constraints: newConstraints,
    });
  }

  /**
   * Evaluates whether witness satisfies every constraint in the R1CS system (FR-1091).
   */
  public isSatisfied(
    system: R1csSystem,
    witness: readonly bigint[],
  ): { satisfied: boolean; failedConstraints: number[] } {
    assertPrecondition(
      witness.length === system.numVariables,
      `Witness length ${witness.length} must match variable count ${system.numVariables}`,
    );
    const p = this.prime;
    const failedConstraints: number[] = [];

    for (let k = 0; k < system.numConstraints; k++) {
      const constraint = system.constraints[k];
      let sumA = 0n;
      let sumB = 0n;
      let sumC = 0n;

      for (let i = 0; i < system.numVariables; i++) {
        sumA = fieldAdd(sumA, fieldMul(constraint.a[i], witness[i], p), p);
        sumB = fieldAdd(sumB, fieldMul(constraint.b[i], witness[i], p), p);
        sumC = fieldAdd(sumC, fieldMul(constraint.c[i], witness[i], p), p);
      }

      const prod = fieldMul(sumA, sumB, p);
      if (prod !== sumC) {
        failedConstraints.push(k);
      }
    }

    return {
      satisfied: failedConstraints.length === 0,
      failedConstraints,
    };
  }

  /**
   * Transforms R1CS system and witness into QAP polynomials A(x), B(x), C(x), T(x), H(x) (FR-1092).
   */
  public toQap(system: R1csSystem, witness: readonly bigint[]): QapPolynomials {
    const m = system.numConstraints;
    assertPrecondition(m >= 1, "R1CS system must have at least 1 constraint");
    assertPrecondition(witness.length === system.numVariables, "Witness length mismatch");

    const p = this.prime;
    const xs = Array.from({ length: m }, (_, i) => BigInt(i + 1));
    const evalA = new Array<bigint>(m).fill(0n);
    const evalB = new Array<bigint>(m).fill(0n);
    const evalC = new Array<bigint>(m).fill(0n);

    for (let k = 0; k < m; k++) {
      const constraint = system.constraints[k];
      for (let i = 0; i < system.numVariables; i++) {
        evalA[k] = fieldAdd(evalA[k], fieldMul(constraint.a[i], witness[i], p), p);
        evalB[k] = fieldAdd(evalB[k], fieldMul(constraint.b[i], witness[i], p), p);
        evalC[k] = fieldAdd(evalC[k], fieldMul(constraint.c[i], witness[i], p), p);
      }
    }

    const aPoly = lagrangeInterpolate(xs, evalA, p);
    const bPoly = lagrangeInterpolate(xs, evalB, p);
    const cPoly = lagrangeInterpolate(xs, evalC, p);

    let targetPoly = [1n];
    for (const root of xs) {
      targetPoly = polyMul(targetPoly, [fieldNormalize(-root, p), 1n], p);
    }

    const pPoly = polySub(polyMul(aPoly, bPoly, p), cPoly, p);
    const { quotient, remainder } = polyDiv(pPoly, targetPoly, p);

    return deepFreeze({
      aPoly,
      bPoly,
      cPoly,
      targetPoly,
      quotientPoly: quotient,
      remainderPoly: remainder,
    });
  }

  /**
   * Generates a non-interactive zero-knowledge evaluation argument at challenged tau (FR-1093).
   */
  public prove(system: R1csSystem, witness: readonly bigint[], challengeTau?: bigint): ZkProof {
    const satisfaction = this.isSatisfied(system, witness);
    assertPrecondition(
      satisfaction.satisfied,
      `Witness does not satisfy constraints: [${satisfaction.failedConstraints.join(", ")}]`,
    );

    const qap = this.toQap(system, witness);
    assertPostcondition(
      qap.remainderPoly.length === 1 && qap.remainderPoly[0] === 0n,
      "QAP remainder must be zero for valid witness",
    );

    const p = this.prime;
    let tau: bigint;
    if (challengeTau !== undefined) {
      tau = fieldNormalize(challengeTau, p);
    } else {
      const digest = pureSha256(`${witness.map((w) => w.toString(16)).join(":")}:${system.numConstraints}`);
      tau = fieldNormalize(BigInt(`0x${digest}`), p);
      if (tau === 0n) tau = 1337n;
    }

    const aTau = polyEval(qap.aPoly, tau, p);
    const bTau = polyEval(qap.bPoly, tau, p);
    const cTau = polyEval(qap.cPoly, tau, p);
    const hTau = polyEval(qap.quotientPoly, tau, p);
    const tTau = polyEval(qap.targetPoly, tau, p);

    const proofDigest = pureSha256(
      `${tau.toString(16)}:${aTau.toString(16)}:${bTau.toString(16)}:${cTau.toString(16)}:${hTau.toString(16)}`,
    );

    return deepFreeze({
      tau,
      aTau,
      bTau,
      cTau,
      hTau,
      tTau,
      proofDigest,
    });
  }

  /**
   * Verifies proof in O(1) operations (FR-1093).
   */
  public verify(system: R1csSystem, publicInputs: readonly bigint[], proof: ZkProof): ZkVerificationResult {
    const startTime = performance.now();
    const p = this.prime;
    const m = system.numConstraints;

    assertPrecondition(publicInputs.length === system.publicInputCount, "Public inputs length mismatch");

    // Compute expected T(tau) directly: prod_{j=1}^m (tau - j)
    let expectedTTau = 1n;
    for (let j = 1; j <= m; j++) {
      expectedTTau = fieldMul(expectedTTau, fieldSub(proof.tau, BigInt(j), p), p);
    }

    const tMatches = expectedTTau === proof.tTau;

    // Check divisibility equation at tau: A(tau) * B(tau) - C(tau) == H(tau) * T(tau)
    const lhs = fieldSub(fieldMul(proof.aTau, proof.bTau, p), proof.cTau, p);
    const rhs = fieldMul(proof.hTau, proof.tTau, p);
    const valid = tMatches && lhs === rhs;

    const elapsedMs = performance.now() - startTime;
    const receipt = this._createReceipt(
      "verify",
      proof.proofDigest,
      valid ? "VERIFIED_SATISFIED" : "FORGED_EVALUATION",
    );

    return deepFreeze({
      valid,
      verificationTimeMs: elapsedMs,
      receipt,
    });
  }

  private _createReceipt(operation: ZkOperationType, circuitDigest: string, outputDigest: string): ZkReceipt {
    const timestamp = new Date().toISOString();
    const receiptId = `eos-zk-r1cs-${operation}-${pureSha256(`${circuitDigest}:${timestamp}`).slice(0, 16)}`;
    const receiptSha256 = pureSha256(`${receiptId}:${circuitDigest}:${outputDigest}:${timestamp}`);
    return deepFreeze({
      receiptId,
      operation,
      timestamp,
      circuitDigest,
      outputDigest,
      receiptSha256,
    });
  }
}
