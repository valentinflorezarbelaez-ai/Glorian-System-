/**
 * @file eosPostQuantumThresholdMpc.test.mjs
 * @description BDD test suite for SPEC-335 / CHANGE-197: Threshold Secret Sharing &
 * Ring-LWE Homomorphic Secure Aggregation Engine (BDD-1785..1790).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  EosPostQuantumThresholdMpcCore,
  PQMPC_FIELD_MODULUS,
  PQMPC_SECURITY_NOTICE,
  PqmpcError,
} from "../src/core/eosPostQuantumThresholdMpc.ts";

const RECEIPT_PATH = path.join(os.tmpdir(), `eos-test-PQMPC_RECEIPT-${process.pid}.json`);

test("SPEC-335 / CHANGE-197: Threshold Secret Sharing & Ring-LWE Homomorphic Secure Aggregation (PQ-MPC)", async (t) => {
  await t.test("BDD-1785: Shamir T-of-N Secret Splitting and Lagrange Reconstruction Across All Quorums", () => {
    const engine = new EosPostQuantumThresholdMpcCore({
      parties: 5,
      threshold: 3,
      seed: "bdd-1785-seed",
    });
    const secret = 987654321012345n;
    const shares = engine.shamirSplit(secret);

    assert.strictEqual(shares.length, 5);
    for (let i = 0; i < shares.length; i++) {
      assert.strictEqual(shares[i].x, BigInt(i + 1));
      assert.strictEqual(shares[i].commitment.length, 64);
    }

    // Every 3-of-5 subset (10 combinations) must reconstruct the exact secret
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        for (let k = j + 1; k < 5; k++) {
          const reconstructed = engine.shamirReconstruct([shares[i], shares[j], shares[k]]);
          assert.strictEqual(reconstructed, secret);
        }
      }
    }

    // Reconstructing with fewer than T shares must fail with PQMPC_BELOW_THRESHOLD
    assert.throws(
      () => engine.shamirReconstruct([shares[0], shares[1]]),
      (err) => err instanceof PqmpcError && err.code === "PQMPC_BELOW_THRESHOLD",
    );
  });

  await t.test("BDD-1786: Tampered Share Commitments & Duplicate Abscissa Rejection", () => {
    const engine = new EosPostQuantumThresholdMpcCore({
      parties: 5,
      threshold: 3,
      seed: "bdd-1786-seed",
    });
    const shares = engine.shamirSplit(123456789n);

    // Mutate ordinate y without updating commitment
    const tampered = [{ ...shares[0], y: (shares[0].y + 1n) % PQMPC_FIELD_MODULUS }, shares[1], shares[2]];
    assert.throws(
      () => engine.shamirReconstruct(tampered),
      (err) => err instanceof PqmpcError && err.code === "PQMPC_COMMITMENT_MISMATCH",
    );

    // Duplicate abscissa x must be rejected with PQMPC_DUPLICATE_SHARE
    assert.throws(
      () => engine.shamirReconstruct([shares[0], shares[0], shares[1]]),
      (err) => err instanceof PqmpcError && err.code === "PQMPC_DUPLICATE_SHARE",
    );

    // Reserved abscissa x = 0 must be rejected
    assert.throws(
      () => engine.lagrangeCoefficientsAtZero([0n, 1n, 2n]),
      (err) => err instanceof PqmpcError && err.code === "PQMPC_INVALID_PARAMETERS",
    );
  });

  await t.test("BDD-1787: Randomized Ring-LWE Encryption and Exact Threshold Decryption", () => {
    const engine = new EosPostQuantumThresholdMpcCore({
      ringDegree: 64,
      plaintextModulus: 65537n,
      parties: 5,
      threshold: 3,
      seed: "bdd-1787-seed",
    });
    const keys = engine.generateThresholdKeys();
    const message = [100n, 2500n, 65000n, 0n, 42n];

    const ct1 = engine.encryptVector(keys.publicKey, message);
    const ct2 = engine.encryptVector(keys.publicKey, message);

    // Randomized encryption produces distinct ciphertexts for identical plaintexts
    assert.ok(ct1.c0.some((v, idx) => v !== ct2.c0[idx]));
    assert.ok(ct1.c1.some((v, idx) => v !== ct2.c1[idx]));

    // Both ciphertexts decrypt to the original vector
    const partials1 = keys.keyShares.slice(0, 3).map((ks) => engine.partialDecrypt(ct1, ks));
    const partials2 = keys.keyShares.slice(2, 5).map((ks) => engine.partialDecrypt(ct2, ks));

    assert.deepStrictEqual(engine.combinePartialDecryptions(ct1, partials1), message);
    assert.deepStrictEqual(engine.combinePartialDecryptions(ct2, partials2), message);
  });

  await t.test("BDD-1788: Additive Homomorphic Aggregation & Public Scalar Multiplication", () => {
    const engine = new EosPostQuantumThresholdMpcCore({
      ringDegree: 64,
      plaintextModulus: 65537n,
      parties: 5,
      threshold: 3,
      seed: "bdd-1788-seed",
    });
    const keys = engine.generateThresholdKeys();

    const inputs = [
      [10, 200, 3000, 4],
      [25, 300, 1500, 8],
      [40, 500, 2500, 12],
      [5, 100, 500, 16],
      [20, 400, 1000, 20],
    ];
    const cts = inputs.map((vec) => engine.encryptVector(keys.publicKey, vec));
    const sumCt = engine.aggregateCiphertexts(cts);
    const scaledCt = engine.scalarMultiply(sumCt, 3);

    const partials = keys.keyShares.slice(0, 3).map((ks) => engine.partialDecrypt(scaledCt, ks));
    const result = engine.combinePartialDecryptions(scaledCt, partials);

    // Sum = [100, 1500, 8500, 60]; times 3 = [300, 4500, 25500, 180]
    assert.deepStrictEqual(result, [300n, 4500n, 25500n, 180n]);
  });

  await t.test("BDD-1789: Threshold Decryption With Custodian Dropout Tolerance & Tamper Guards", () => {
    const engine = new EosPostQuantumThresholdMpcCore({
      parties: 5,
      threshold: 3,
      seed: "bdd-1789-seed",
    });
    const keys = engine.generateThresholdKeys();
    const contributions = [
      [7, 14, 21],
      [3, 6, 9],
      [10, 20, 30],
    ];

    const resA = engine.secureAggregate(keys, contributions, ["custodian-1", "custodian-2", "custodian-3"]);
    const resB = engine.secureAggregate(keys, contributions, ["custodian-2", "custodian-4", "custodian-5"]);
    const resC = engine.secureAggregate(keys, contributions, ["custodian-1", "custodian-3", "custodian-5"]);

    assert.deepStrictEqual(resA.sum, [20n, 40n, 60n]);
    assert.deepStrictEqual(resB.sum, [20n, 40n, 60n]);
    assert.deepStrictEqual(resC.sum, [20n, 40n, 60n]);

    // Below threshold (only 2 custodians) must be rejected
    assert.throws(
      () => engine.secureAggregate(keys, contributions, ["custodian-1", "custodian-2"]),
      (err) => err instanceof PqmpcError && err.code === "PQMPC_BELOW_THRESHOLD",
    );

    // Corrupted custodian key share must be rejected by commitment check
    const ct = engine.encryptVector(keys.publicKey, [1, 2, 3]);
    const badKeyShare = {
      ...keys.keyShares[0],
      secretShare: keys.keyShares[0].secretShare.map((v, i) => (i === 0 ? v + 1n : v)),
    };
    assert.throws(
      () => engine.partialDecrypt(ct, badKeyShare),
      (err) => err instanceof PqmpcError && err.code === "PQMPC_COMMITMENT_MISMATCH",
    );
  });

  await t.test("BDD-1790: Deterministic Audit Receipt, Parameter Validation & Security Notice", () => {
    const engineA = new EosPostQuantumThresholdMpcCore({ seed: "bdd-1790-audit-seed" });
    const engineB = new EosPostQuantumThresholdMpcCore({ seed: "bdd-1790-audit-seed" });

    const receiptA = engineA.audit();
    const receiptB = engineB.audit();

    assert.strictEqual(receiptA.specRef, "SPEC-335");
    assert.strictEqual(receiptA.shamirRoundTrip, true);
    assert.strictEqual(receiptA.belowThresholdRejected, true);
    assert.strictEqual(receiptA.tamperDetected, true);
    assert.strictEqual(receiptA.encryptionRandomized, true);
    assert.strictEqual(receiptA.homomorphicAggregation, true);
    assert.strictEqual(receiptA.thresholdDecryption, true);
    assert.strictEqual(receiptA.allPassed, true);
    assert.strictEqual(receiptA.securityNotice, PQMPC_SECURITY_NOTICE);
    assert.strictEqual(receiptA.sha256Digest.length, 64);
    assert.strictEqual(receiptA.sha256Digest, receiptB.sha256Digest);

    // Invalid parameter guards
    assert.throws(
      () => new EosPostQuantumThresholdMpcCore({ ringDegree: 30 }),
      (err) => err instanceof PqmpcError && err.code === "PQMPC_INVALID_PARAMETERS",
    );
    assert.throws(
      () => new EosPostQuantumThresholdMpcCore({ parties: 3, threshold: 4 }),
      (err) => err instanceof PqmpcError && err.code === "PQMPC_INVALID_PARAMETERS",
    );
    assert.throws(
      () => new EosPostQuantumThresholdMpcCore({ parties: 3, threshold: 1 }),
      (err) => err instanceof PqmpcError && err.code === "PQMPC_INVALID_PARAMETERS",
    );

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receiptA, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });
});
