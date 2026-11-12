/**
 * Test Suite for EosHomomorphicLatticeCore (SPEC-211 / BDD-1074..BDD-1078)
 *
 * Verifies Layer-0 RLWE/BFV-style somewhat homomorphic encryption over cyclotomic rings.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  EosHomomorphicLatticeCore,
  polyMultiply,
  polyAdd,
  polySub,
  polyScalarMultiply,
  mod,
  sampleUniformPoly,
  sampleTernaryPoly,
  sampleErrorPoly,
  DEFAULT_HOMOMORPHIC_PARAMS,
} from "../src/core/eosHomomorphicLatticeCore.ts";

describe("EosHomomorphicLatticeCore (SPEC-211 / BDD-1074..BDD-1078)", () => {
  test("BDD-1074: Ring Parameter Configuration and Cryptographic Keypair Generation", () => {
    // Verify direct export of constructors and helper arithmetic functions
    assert.strictEqual(typeof EosHomomorphicLatticeCore, "function");
    assert.strictEqual(typeof polyMultiply, "function");
    assert.strictEqual(typeof polyAdd, "function");
    assert.strictEqual(typeof polySub, "function");
    assert.strictEqual(typeof polyScalarMultiply, "function");
    assert.strictEqual(typeof sampleUniformPoly, "function");
    assert.strictEqual(typeof sampleTernaryPoly, "function");
    assert.strictEqual(typeof sampleErrorPoly, "function");
    assert.strictEqual(typeof mod, "function");

    const core = new EosHomomorphicLatticeCore({
      polyDegree: 32,
      ciphertextModulus: 65537,
      plaintextModulus: 257,
      errorBound: 2,
    });

    const params = core.getParameters();
    assert.strictEqual(params.polyDegree, 32);
    assert.strictEqual(params.ciphertextModulus, 65537);
    assert.strictEqual(params.plaintextModulus, 257);
    assert.strictEqual(params.errorBound, 2);

    const keypair = core.generateKeypair(42);
    assert.ok(keypair.secretKey);
    assert.ok(keypair.publicKey);
    assert.strictEqual(keypair.secretKey.s.length, 32);
    assert.strictEqual(keypair.publicKey.pk0.length, 32);
    assert.strictEqual(keypair.publicKey.pk1.length, 32);

    // Verify secret key coefficients are strictly ternary in {-1, 0, 1}
    for (const coeff of keypair.secretKey.s) {
      assert.ok(coeff === -1 || coeff === 0 || coeff === 1, `Invalid sk coeff: ${coeff}`);
    }

    // Verify public key coefficients are within [0, q - 1]
    for (const c of keypair.publicKey.pk0) {
      assert.ok(c >= 0 && c < 65537, `Invalid pk0 coeff: ${c}`);
    }
    for (const c of keypair.publicKey.pk1) {
      assert.ok(c >= 0 && c < 65537, `Invalid pk1 coeff: ${c}`);
    }

    assert.ok(keypair.publicKey.keyFingerprint.length === 64);
    assert.ok(keypair.createdAt);
  });

  test("BDD-1075: Plaintext Vector Encoding and Blind Public-Key Encryption", () => {
    const core = new EosHomomorphicLatticeCore(DEFAULT_HOMOMORPHIC_PARAMS);
    const keypair = core.generateKeypair(1337);

    const message = [42, 100, 7, 250, 0, 1, 99];
    const ct = core.encrypt(keypair.publicKey, message, 2026);

    assert.strictEqual(ct.c0.length, DEFAULT_HOMOMORPHIC_PARAMS.polyDegree);
    assert.strictEqual(ct.c1.length, DEFAULT_HOMOMORPHIC_PARAMS.polyDegree);
    assert.strictEqual(ct.scaleDelta, Math.floor(65537 / 257));
    assert.ok(ct.noiseBudgetBits > 0, "Noise budget should be positive");
    assert.strictEqual(ct.ciphertextDigest.length, 64);

    // Verify non-trivial entropy in ciphertext coefficients
    const nonZeroC0 = ct.c0.filter((x) => x !== 0).length;
    const nonZeroC1 = ct.c1.filter((x) => x !== 0).length;
    assert.ok(nonZeroC0 > 25, "c0 should have high coefficient entropy");
    assert.ok(nonZeroC1 > 25, "c1 should have high coefficient entropy");
  });

  test("BDD-1076: Homomorphic Blind Addition and Subtraction Verification", () => {
    const core = new EosHomomorphicLatticeCore({
      polyDegree: 32,
      ciphertextModulus: 65537,
      plaintextModulus: 257,
      errorBound: 1,
    });
    const keypair = core.generateKeypair(999);

    const msgA = [10, 20, 30, 40, 50];
    const msgB = [5, 15, 25, 35, 45];

    const ctA = core.encrypt(keypair.publicKey, msgA, 101);
    const ctB = core.encrypt(keypair.publicKey, msgB, 102);

    // Blind addition: ctA + ctB
    const ctSum = core.add(ctA, ctB);
    const decSum = core.decrypt(keypair.secretKey, ctSum);

    assert.strictEqual(decSum.plaintext[0], 15);
    assert.strictEqual(decSum.plaintext[1], 35);
    assert.strictEqual(decSum.plaintext[2], 55);
    assert.strictEqual(decSum.plaintext[3], 75);
    assert.strictEqual(decSum.plaintext[4], 95);
    assert.ok(decSum.noiseBudgetBits > 0);
    assert.strictEqual(decSum.receipt.operation, "decrypt");

    // Blind subtraction: ctA - ctB
    const ctDiff = core.sub(ctA, ctB);
    const decDiff = core.decrypt(keypair.secretKey, ctDiff);

    assert.strictEqual(decDiff.plaintext[0], 5);
    assert.strictEqual(decDiff.plaintext[1], 5);
    assert.strictEqual(decDiff.plaintext[2], 5);
    assert.strictEqual(decDiff.plaintext[3], 5);
    assert.strictEqual(decDiff.plaintext[4], 5);
  });

  test("BDD-1077: Homomorphic Scalar Multiplication and Noise Budget Tracking", () => {
    const core = new EosHomomorphicLatticeCore({
      polyDegree: 32,
      ciphertextModulus: 65537,
      plaintextModulus: 257,
      errorBound: 1,
    });
    const keypair = core.generateKeypair(555);

    const msg = [7, 14, 21, 28];
    const ct = core.encrypt(keypair.publicKey, msg, 777);

    // Scalar multiply by 3
    const ctMul = core.scalarMultiply(ct, 3);
    const decMul = core.decrypt(keypair.secretKey, ctMul);

    assert.strictEqual(decMul.plaintext[0], 21);
    assert.strictEqual(decMul.plaintext[1], 42);
    assert.strictEqual(decMul.plaintext[2], 63);
    assert.strictEqual(decMul.plaintext[3], 84);

    // Verify noise budget degradation
    assert.ok(ctMul.noiseBudgetBits <= ct.noiseBudgetBits);
  });

  test("BDD-1078: Decryption Invariants, Boundary Cases, and Tamper-Evident Receipts", () => {
    const core = new EosHomomorphicLatticeCore({
      polyDegree: 16,
      ciphertextModulus: 12289,
      plaintextModulus: 17,
      errorBound: 1,
    });
    const keypair = core.generateKeypair(12345);

    // Wrap-around modulo t test: 12 + 10 = 22 = 5 mod 17
    const msgA = [12];
    const msgB = [10];

    const ctA = core.encrypt(keypair.publicKey, msgA, 1);
    const ctB = core.encrypt(keypair.publicKey, msgB, 2);

    const ctSum = core.add(ctA, ctB);
    const result = core.decrypt(keypair.secretKey, ctSum);

    assert.strictEqual(result.plaintext[0], 5, "Modular addition wrap-around violated");
    assert.ok(result.receipt.receiptSha256.length === 64);
    assert.ok(result.receipt.receiptId.startsWith("eos-he-decrypt-"));
  });

  test("BDD-1078-CLI: End-to-End CLI Keygen and Computation JSON Output", () => {
    const binPath = path.join(process.cwd(), "bin/eos.mjs");

    const keygenRaw = execFileSync(process.execPath, [binPath, "homomorphic:keygen", "--degree=32", "--json"], {
      encoding: "utf8",
    });
    const keygenData = JSON.parse(keygenRaw.trim());
    assert.ok(keygenData.publicKey);
    assert.ok(keygenData.secretKey);
    assert.strictEqual(keygenData.publicKey.params.polyDegree, 32);

    const encryptRaw = execFileSync(
      process.execPath,
      [binPath, "homomorphic:encrypt", "--degree=32", "--message=42,100,7", "--json"],
      { encoding: "utf8" },
    );
    const encryptData = JSON.parse(encryptRaw.trim());
    assert.strictEqual(encryptData.c0.length, 32);
    assert.ok(encryptData.noiseBudgetBits > 0);

    const addRaw = execFileSync(process.execPath, [binPath, "homomorphic:add", "--degree=32", "--json"], {
      encoding: "utf8",
    });
    const addData = JSON.parse(addRaw.trim());
    assert.ok(addData.ciphertext);
    assert.ok(addData.decryption);
    assert.strictEqual(addData.decryption.plaintext[0], 52); // 42 + 10
    assert.strictEqual(addData.decryption.plaintext[1], 120); // 100 + 20
    assert.strictEqual(addData.decryption.plaintext[2], 37); // 7 + 30
    assert.strictEqual(addData.decryption.plaintext[3], 65); // 25 + 40
  });
});
