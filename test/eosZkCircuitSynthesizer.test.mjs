/**
 * @file eosZkCircuitSynthesizer.test.mjs
 * @description Automated test suite for SPEC-350 / CHANGE-212: Autonomous Zero-Knowledge Circuit Synthesizer.
 *
 * Verifies BDD-1879 through BDD-1884:
 * - BDD-1879: Finite field arithmetic invariants over BN254.
 * - BDD-1880: R1CS constraint compilation & sparse matrix representation.
 * - BDD-1881: Boolean enforcement constraint ($x \cdot (1 - x) = 0$).
 * - BDD-1882: Conditional multiplexer arithmetization ($sel \cdot (b - a) = out - a$).
 * - BDD-1883: Automated witness synthesis and fail-closed tamper detection.
 * - BDD-1884: Cryptographic proof receipt generation and self-audit.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import {
  BN254_SCALAR_FIELD,
  EosFiniteFieldCore,
  EosZkCircuitSynthesizerCore,
} from "../src/core/eosZkCircuitSynthesizer.ts";

test("BDD-1879: Finite Field Arithmetic Invariants", () => {
  const field = new EosFiniteFieldCore(BN254_SCALAR_FIELD);

  // Field element properties
  const x = 42n;
  const y = 1337n;

  // Additive inverse
  const negX = field.sub(0n, x);
  assert.equal(field.add(x, negX), 0n);

  // Multiplicative inverse via Fermat's Little Theorem
  const invY = field.inv(y);
  assert.equal(field.mul(y, invY), 1n);

  // Distributivity: x * (y + z) == x * y + x * z
  const z = 99999999999999999n;
  const left = field.mul(x, field.add(y, z));
  const right = field.add(field.mul(x, y), field.mul(x, z));
  assert.equal(left, right);
});

test("BDD-1880: R1CS Constraint Synthesis", () => {
  const circ = new EosZkCircuitSynthesizerCore();
  const a = circ.allocatePublicInput("a");
  const b = circ.allocatePrivateInput("b");
  const c = circ.allocatePublicInput("c");

  circ.enforceMul(a, b, c, "a * b == c");
  const compiled = circ.compile();

  assert.equal(compiled.variables.length, 4);
  assert.equal(compiled.constraints.length, 1);
  assert.equal(compiled.publicInputsCount, 2);
  assert.equal(compiled.privateInputsCount, 1);

  // Verify sparse representation of A, B, C
  const r0 = compiled.constraints[0];
  assert.equal(r0.A[a], "1");
  assert.equal(r0.B[b], "1");
  assert.equal(r0.C[c], "1");
});

test("BDD-1881: Boolean Enforcement Constraint", () => {
  const circ = new EosZkCircuitSynthesizerCore();
  const flag = circ.allocatePrivateInput("flag");
  circ.enforceBoolean(flag);

  // Valid witness: flag = 0
  const witness0 = [1n, 0n];
  assert.equal(circ.verifyWitness(witness0).satisfied, true);

  // Valid witness: flag = 1
  const witness1 = [1n, 1n];
  assert.equal(circ.verifyWitness(witness1).satisfied, true);

  // Invalid witness: flag = 2
  const witness2 = [1n, 2n];
  const res2 = circ.verifyWitness(witness2);
  assert.equal(res2.satisfied, false);
  assert.equal(res2.failedConstraintIndex, 0);
});

test("BDD-1882: Conditional Multiplexer Arithmetization", () => {
  const circ = new EosZkCircuitSynthesizerCore();
  const sel = circ.allocatePrivateInput("sel");
  const ifTrue = circ.allocatePublicInput("ifTrue");
  const ifFalse = circ.allocatePublicInput("ifFalse");
  const out = circ.allocatePublicInput("out");

  circ.enforceBoolean(sel);
  circ.enforceMux(sel, ifTrue, ifFalse, out);

  // Branch 1: sel = 1 => out = ifTrue (100)
  // witness = [ONE=1, sel=1, ifTrue=100, ifFalse=200, out=100]
  const witnessTrue = [1n, 1n, 100n, 200n, 100n];
  assert.equal(circ.verifyWitness(witnessTrue).satisfied, true);

  // Branch 2: sel = 0 => out = ifFalse (200)
  // witness = [ONE=1, sel=0, ifTrue=100, ifFalse=200, out=200]
  const witnessFalse = [1n, 0n, 100n, 200n, 200n];
  assert.equal(circ.verifyWitness(witnessFalse).satisfied, true);

  // Invalid: sel = 0 but out forged as 100
  const witnessForged = [1n, 0n, 100n, 200n, 100n];
  assert.equal(circ.verifyWitness(witnessForged).satisfied, false);
});

test("BDD-1883: Automated Witness Synthesis & Full Verification", () => {
  const circ = new EosZkCircuitSynthesizerCore();
  const x = circ.allocatePrivateInput("x");
  const xSquared = circ.allocateIntermediate("xSquared");
  const y = circ.allocatePublicInput("y");

  // x * x == xSquared
  circ.enforceMul(x, x, xSquared);
  // (xSquared + 10) * 1 == y
  circ.addConstraint(
    new Map([
      [xSquared, 1n],
      [0, 10n],
    ]),
    new Map([[0, 1n]]),
    new Map([[y, 1n]]),
  );

  // For x = 9: xSquared = 81, y = 91
  // witness = [ONE=1, x=9, xSquared=81, y=91]
  const validWitness = [1n, 9n, 81n, 91n];
  assert.equal(circ.verifyWitness(validWitness).satisfied, true);

  // Mutated witness: x = 9 but xSquared claimed as 80
  const corruptWitness = [1n, 9n, 80n, 91n];
  assert.equal(circ.verifyWitness(corruptWitness).satisfied, false);
});

test("BDD-1884: Cryptographic Receipt & Self-Auditing Harness", () => {
  const receipt = EosZkCircuitSynthesizerCore.audit();
  assert.equal(receipt.status, "VERIFIED");
  assert.equal(receipt.fieldArithmeticVerified, true);
  assert.equal(receipt.r1csSynthesisVerified, true);
  assert.equal(receipt.booleanEnforcementVerified, true);
  assert.equal(receipt.multiplexerVerified, true);
  assert.equal(receipt.witnessSatisfied, true);
  assert.equal(receipt.specId, "SPEC-350");
  assert.equal(receipt.proofCertificateSha256.length, 64);

  const receiptPath = resolveEvidencePath("ZK_CIRCUIT_SYNTHESIZER_RECEIPT.json");
  assert.ok(fs.existsSync(receiptPath));
});
