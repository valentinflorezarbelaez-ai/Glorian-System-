/**
 * EOS Layer-0 Verifiable Random Functions (ECVRF RFC 9381) Core Test Suite
 * Governed by SPEC-217: FR-1104..FR-1108 and BDD-1104..BDD-1108.
 * Zero external runtime dependencies.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  EosVerifiableRandomFunctionCore,
  SECP256K1_G,
  SECP256K1_Q,
  isOnCurve,
  pointMultiply,
  pointAdd,
  pointDouble,
  hashToCurve,
  serializePoint,
} from "../src/core/eosVerifiableRandomFunctionCore.ts";

describe("EosVerifiableRandomFunctionCore (SPEC-217 / BDD-1104..BDD-1108)", () => {
  test("BDD-1104: Secp256k1 Point Group Invariants and Hash-to-Curve", () => {
    assert.strictEqual(typeof EosVerifiableRandomFunctionCore, "function");
    assert.strictEqual(typeof hashToCurve, "function");

    // 1. Generator point G is on curve
    assert.strictEqual(isOnCurve(SECP256K1_G), true);

    // 2. Point doubling is on curve
    const twoG = pointDouble(SECP256K1_G);
    assert.ok(twoG !== null);
    assert.strictEqual(isOnCurve(twoG), true);

    // 3. 2*G matches G + G
    const gPlusG = pointAdd(SECP256K1_G, SECP256K1_G);
    assert.deepStrictEqual(twoG, gPlusG);

    // 4. Scalar multiplication with group order q yields point at infinity (null)
    const qG = pointMultiply(SECP256K1_Q, SECP256K1_G);
    assert.strictEqual(qG, null);

    // 5. Deterministic hash-to-curve generates valid curve points
    const h1 = hashToCurve("block-header-2026");
    const h2 = hashToCurve("block-header-2026");
    assert.deepStrictEqual(h1, h2, "Hash-to-curve must be deterministic");
    assert.strictEqual(isOnCurve(h1), true);

    const serializedH = serializePoint(h1);
    assert.strictEqual(serializedH.length, 66); // 2-char prefix + 64-char hex
  });

  test("BDD-1105: Deterministic VRF Proof Generation and Pseudorandom Output", () => {
    const keyPair = EosVerifiableRandomFunctionCore.generateKeyPair("sovereign-seed-test-1");
    assert.ok(keyPair.secretKey > 0n);
    assert.strictEqual(isOnCurve(keyPair.publicKey), true);

    const vrf = new EosVerifiableRandomFunctionCore();
    const alpha = "consensus-slot-42";

    // 1. Double evaluation on identical input yields byte-identical result
    const eval1 = vrf.evaluate(keyPair.secretKey, alpha);
    const eval2 = vrf.evaluate(keyPair.secretKey, alpha);

    assert.strictEqual(eval1.beta, eval2.beta);
    assert.strictEqual(eval1.proof.gammaHex, eval2.proof.gammaHex);
    assert.strictEqual(eval1.proof.cHex, eval2.proof.cHex);
    assert.strictEqual(eval1.proof.sHex, eval2.proof.sHex);

    // 2. Beta has 256 uniform bits (64 hex characters)
    assert.strictEqual(eval1.beta.length, 64);
    assert.strictEqual(eval1.receipt.operation, "evaluate");
    assert.strictEqual(eval1.receipt.receiptSha256.length, 64);

    // 3. Divergent alpha yields completely different beta
    const evalDivergent = vrf.evaluate(keyPair.secretKey, "consensus-slot-43");
    assert.notStrictEqual(eval1.beta, evalDivergent.beta);
  });

  test("BDD-1106: Fast Verification and Forgery Rejection", () => {
    const keyPair = EosVerifiableRandomFunctionCore.generateKeyPair("sovereign-seed-test-2");
    const vrf = new EosVerifiableRandomFunctionCore();
    const alpha = "epoch-validation-payload";

    const evalRes = vrf.evaluate(keyPair.secretKey, alpha);

    // 1. Authentic proof verifies successfully
    const verifyRes = vrf.verify(keyPair.publicKey, alpha, evalRes.proof);
    assert.strictEqual(verifyRes.valid, true);
    assert.strictEqual(verifyRes.beta, evalRes.beta);
    assert.ok(verifyRes.verificationTimeMs < 50, "Verification should be fast");
    assert.strictEqual(verifyRes.receipt.operation, "verify");
    assert.strictEqual(verifyRes.receipt.receiptSha256.length, 64);

    // 2. Tampered alpha rejects proof
    const tamperedAlphaRes = vrf.verify(keyPair.publicKey, "tampered-payload", evalRes.proof);
    assert.strictEqual(tamperedAlphaRes.valid, false);

    // 3. Perturbed response scalar s rejects proof
    const forgedProof = {
      ...evalRes.proof,
      s: evalRes.proof.s + 1n,
    };
    const forgedRes = vrf.verify(keyPair.publicKey, alpha, forgedProof);
    assert.strictEqual(forgedRes.valid, false);

    // 4. Incorrect public key rejects proof
    const wrongKeyPair = EosVerifiableRandomFunctionCore.generateKeyPair("other-seed");
    const wrongPkRes = vrf.verify(wrongKeyPair.publicKey, alpha, evalRes.proof);
    assert.strictEqual(wrongPkRes.valid, false);
  });

  test("BDD-1107: Unbiasable Consensus Leader Selection and Threshold Allocation", () => {
    const vrf = new EosVerifiableRandomFunctionCore();

    // 1. Extreme thresholds
    const resZero = vrf.isElected("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 0.0);
    assert.strictEqual(resZero.isElected, false);

    const resOne = vrf.isElected("0000000000000000000000000000000000000000000000000000000000000001", 1.0);
    assert.strictEqual(resOne.isElected, true);

    // 2. Statistical uniformity across distinct seed evaluations
    const threshold = 0.3;
    let electedCount = 0;
    const trials = 100;

    for (let i = 0; i < trials; i++) {
      const kp = EosVerifiableRandomFunctionCore.generateKeyPair(`sim-node-${i}`);
      const evalRes = vrf.evaluate(kp.secretKey, "global-slot-epoch-102");
      const electRes = vrf.isElected(evalRes.beta, threshold);
      if (electRes.isElected) {
        electedCount++;
      }
    }

    // With 100 trials and threshold 0.3, electedCount should fall within [15, 45] with overwhelming probability
    assert.ok(
      electedCount >= 15 && electedCount <= 45,
      `Elected count ${electedCount} out of ${trials} should be close to 30%`,
    );
  });

  test("BDD-1108: Frontier CLI and MCP Dispatch", () => {
    const cliPath = path.resolve(process.cwd(), "bin/eos.mjs");

    const evalOutput = execFileSync("node", [cliPath, "vrf:eval", "--alpha=frontier-slot-99", "--json"], {
      encoding: "utf8",
    });
    const evalJson = JSON.parse(evalOutput);
    assert.strictEqual(evalJson.alpha, "frontier-slot-99");
    assert.ok(evalJson.publicKeyHex);
    assert.ok(evalJson.beta);
    assert.ok(evalJson.receipt.receiptSha256);

    const verifyOutput = execFileSync("node", [cliPath, "vrf:verify", "--alpha=frontier-slot-99", "--json"], {
      encoding: "utf8",
    });
    const verifyJson = JSON.parse(verifyOutput);
    assert.strictEqual(verifyJson.valid, true);
    assert.ok(verifyJson.beta);
    assert.ok(verifyJson.receipt.receiptSha256);

    const electOutput = execFileSync(
      "node",
      [cliPath, "vrf:elect", "--alpha=frontier-slot-99", "--threshold=0.9", "--json"],
      { encoding: "utf8" },
    );
    const electJson = JSON.parse(electOutput);
    assert.strictEqual(typeof electJson.isElected, "boolean");
    assert.strictEqual(electJson.threshold, 0.9);
    assert.ok(electJson.receipt.receiptSha256);
  });
});
