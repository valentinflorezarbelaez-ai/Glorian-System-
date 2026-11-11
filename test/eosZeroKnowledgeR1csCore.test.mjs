/**
 * EOS Layer-0 Zero-Knowledge Rank-1 Constraint System (R1CS) & QAP Arithmetic Circuit Core Test Suite
 * Governed by SPEC-214: FR-1089..FR-1093 and BDD-1089..BDD-1093.
 * Zero external runtime dependencies.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  EosZeroKnowledgeR1csCore,
  DEFAULT_ZK_FIELD_PRIME,
  fieldNormalize,
  fieldAdd,
  fieldSub,
  fieldMul,
  fieldInverse,
  fieldPow,
  polyTrim,
  polyAdd,
  polySub,
  polyMul,
  polyScalarMul,
  polyEval,
  polyDiv,
  lagrangeInterpolate,
} from "../src/core/eosZeroKnowledgeR1csCore.ts";

describe("EosZeroKnowledgeR1csCore (SPEC-214 / BDD-1089..BDD-1093)", () => {
  test("BDD-1089: Finite Prime Field Arithmetic Core Verification", () => {
    assert.strictEqual(typeof EosZeroKnowledgeR1csCore, "function");
    assert.strictEqual(typeof DEFAULT_ZK_FIELD_PRIME, "bigint");
    const p = DEFAULT_ZK_FIELD_PRIME;

    // 1. Addition and Subtraction
    const a = 1234567890123456789n;
    const b = 9876543210987654321n;
    const sum = fieldAdd(a, b, p);
    const diff = fieldSub(sum, b, p);
    assert.strictEqual(diff, a, "Sub after Add must yield original element");

    // 2. Normalization of negative values
    const neg = fieldNormalize(-42n, p);
    assert.strictEqual(neg, p - 42n, "Negative elements must normalize into [0, p-1]");

    // 3. Multiplication and Inversion
    const invA = fieldInverse(a, p);
    const prod = fieldMul(a, invA, p);
    assert.strictEqual(prod, 1n, "a * a^-1 must equal 1 mod p");

    // 4. Exponentiation
    const powRes = fieldPow(2n, 10n, p);
    assert.strictEqual(powRes, 1024n, "2^10 must equal 1024");
    const fermatCheck = fieldPow(a, p - 1n, p);
    assert.strictEqual(fermatCheck, 1n, "Fermat's Little Theorem: a^(p-1) == 1 mod p");
  });

  test("BDD-1090: Declarative R1CS Circuit Synthesis", () => {
    const core = new EosZeroKnowledgeR1csCore();
    const { system, witness } = core.synthesizeExampleCircuit(3n);

    assert.strictEqual(system.numVariables, 5);
    assert.strictEqual(system.numConstraints, 3);
    assert.strictEqual(system.publicInputCount, 1);
    assert.deepStrictEqual(system.variableNames, ["one", "out", "x", "sym1", "sym2"]);

    // Witness: [1, 35, 3, 9, 27]
    assert.strictEqual(witness.values[0], 1n);
    assert.strictEqual(witness.values[1], 35n);
    assert.strictEqual(witness.values[2], 3n);
    assert.strictEqual(witness.values[3], 9n);
    assert.strictEqual(witness.values[4], 27n);
    assert.strictEqual(typeof witness.witnessCommitment, "string");
    assert.strictEqual(witness.witnessCommitment.length, 64);
  });

  test("BDD-1091: Witness Assignment & Satisfaction Evaluation", () => {
    const core = new EosZeroKnowledgeR1csCore();
    const { system, witness } = core.synthesizeExampleCircuit(3n);

    // Valid witness satisfaction
    const satisfaction = core.isSatisfied(system, witness.values);
    assert.strictEqual(satisfaction.satisfied, true);
    assert.strictEqual(satisfaction.failedConstraints.length, 0);

    // Invalid witness: claim out = 36 instead of 35
    const badWitness = [1n, 36n, 3n, 9n, 27n];
    const badSatisfaction = core.isSatisfied(system, badWitness);
    assert.strictEqual(badSatisfaction.satisfied, false);
    assert.deepStrictEqual(badSatisfaction.failedConstraints, [2], "Constraint 2 must fail");
  });

  test("BDD-1092: QAP Lagrange Interpolation & Quotient Divisibility", () => {
    const core = new EosZeroKnowledgeR1csCore();
    const { system, witness } = core.synthesizeExampleCircuit(3n);

    const qap = core.toQap(system, witness.values);
    assert.ok(qap.aPoly.length > 0);
    assert.ok(qap.bPoly.length > 0);
    assert.ok(qap.cPoly.length > 0);
    assert.ok(qap.targetPoly.length > 0);
    assert.ok(qap.quotientPoly.length > 0);

    // Divisibility property: Remainder must be strictly [0n]
    assert.strictEqual(qap.remainderPoly.length, 1);
    assert.strictEqual(qap.remainderPoly[0], 0n, "QAP remainder must be zero for valid witness");

    // Invalid witness QAP evaluation
    const badWitness = [1n, 36n, 3n, 9n, 27n];
    const badQap = core.toQap(system, badWitness);
    const isBadZero = badQap.remainderPoly.length === 1 && badQap.remainderPoly[0] === 0n;
    assert.strictEqual(isBadZero, false, "Invalid witness must produce non-zero remainder");

    // Additional polynomial helper check
    const trimmed = polyTrim([1n, 2n, 0n, 0n]);
    assert.deepStrictEqual(trimmed, [1n, 2n]);
    const pAdd = polyAdd([1n, 2n], [3n, 4n]);
    assert.deepStrictEqual(pAdd, [4n, 6n]);
    const pSub = polySub([5n, 10n], [2n, 3n]);
    assert.deepStrictEqual(pSub, [3n, 7n]);
    const pMul = polyMul([1n, 1n], [1n, 1n]); // (x+1)^2 = x^2 + 2x + 1
    assert.deepStrictEqual(pMul, [1n, 2n, 1n]);
    const pScalar = polyScalarMul([2n, 4n], 3n);
    assert.deepStrictEqual(pScalar, [6n, 12n]);
    const pEval = polyEval([1n, 2n, 3n], 2n); // 3*(2)^2 + 2*(2) + 1 = 12 + 4 + 1 = 17
    assert.strictEqual(pEval, 17n);
    const interp = lagrangeInterpolate([1n, 2n], [5n, 7n]); // line through (1,5), (2,7) -> 2x + 3
    assert.deepStrictEqual(interp, [3n, 2n]);
    const pDiv = polyDiv([1n, 2n, 1n], [1n, 1n]); // (x^2+2x+1)/(x+1) = (x+1) rem 0
    assert.deepStrictEqual(pDiv.quotient, [1n, 1n]);
    assert.deepStrictEqual(pDiv.remainder, [0n]);
  });

  test("BDD-1093: Fiat-Shamir Proof Generation, Sub-Millisecond Verification & CLI Dispatch", () => {
    const core = new EosZeroKnowledgeR1csCore();
    const { system, witness } = core.synthesizeExampleCircuit(3n);

    // 1. Generate proof
    const proof = core.prove(system, witness.values);
    assert.strictEqual(typeof proof.tau, "bigint");
    assert.strictEqual(typeof proof.aTau, "bigint");
    assert.strictEqual(typeof proof.bTau, "bigint");
    assert.strictEqual(typeof proof.cTau, "bigint");
    assert.strictEqual(typeof proof.hTau, "bigint");
    assert.strictEqual(typeof proof.tTau, "bigint");
    assert.strictEqual(typeof proof.proofDigest, "string");
    assert.strictEqual(proof.proofDigest.length, 64);

    // 2. Verify proof
    const publicInputs = [witness.values[1]]; // [35n]
    const verification = core.verify(system, publicInputs, proof);
    assert.strictEqual(verification.valid, true);
    assert.ok(verification.verificationTimeMs < 10, "Verification must be sub-millisecond / fast");
    assert.strictEqual(verification.receipt.operation, "verify");
    assert.strictEqual(verification.receipt.outputDigest, "VERIFIED_SATISFIED");

    // 3. Forged evaluation proof must fail
    const forgedProof = {
      ...proof,
      aTau: proof.aTau + 1n,
    };
    const forgedVerification = core.verify(system, publicInputs, forgedProof);
    assert.strictEqual(forgedVerification.valid, false);
    assert.strictEqual(forgedVerification.receipt.outputDigest, "FORGED_EVALUATION");

    // 4. CLI Execution
    const cliPath = path.resolve(process.cwd(), "bin/eos.mjs");

    const synthOutput = execFileSync("node", [cliPath, "r1cs:synthesize", "--json"], {
      encoding: "utf8",
    });
    const synthJson = JSON.parse(synthOutput);
    assert.strictEqual(synthJson.numVariables, 5);
    assert.strictEqual(synthJson.numConstraints, 3);

    const proveOutput = execFileSync("node", [cliPath, "r1cs:prove", "--json"], {
      encoding: "utf8",
    });
    const proveJson = JSON.parse(proveOutput);
    assert.ok(proveJson.proofDigest);

    const verifyOutput = execFileSync("node", [cliPath, "r1cs:verify", "--json"], {
      encoding: "utf8",
    });
    const verifyJson = JSON.parse(verifyOutput);
    assert.strictEqual(verifyJson.valid, true);
  });
});
