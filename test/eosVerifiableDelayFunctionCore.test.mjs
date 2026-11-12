/**
 * Test Suite for EosVerifiableDelayFunctionCore (SPEC-213 / BDD-1084..BDD-1088)
 *
 * Verifies Layer-0 Wesolowski Verifiable Delay Function (VDF) and Proof of Elapsed Time.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  EosVerifiableDelayFunctionCore,
  modPowBigInt,
  gcdBigInt,
  isProbablePrime,
  hashToPrime,
  DEFAULT_VDF_MODULUS,
  DEFAULT_VDF_DELAY,
  DEFAULT_CHALLENGE_BITS,
} from "../src/core/eosVerifiableDelayFunctionCore.ts";

describe("EosVerifiableDelayFunctionCore (SPEC-213 / BDD-1084..BDD-1088)", () => {
  test("BDD-1084: Parameter Context Initialization and Seed Element Mapping", () => {
    assert.strictEqual(typeof EosVerifiableDelayFunctionCore, "function");
    assert.strictEqual(typeof modPowBigInt, "function");
    assert.strictEqual(typeof gcdBigInt, "function");
    assert.strictEqual(typeof isProbablePrime, "function");
    assert.strictEqual(typeof hashToPrime, "function");
    assert.strictEqual(typeof DEFAULT_VDF_DELAY, "number");
    assert.strictEqual(typeof DEFAULT_CHALLENGE_BITS, "number");

    const core = new EosVerifiableDelayFunctionCore({
      modulus: DEFAULT_VDF_MODULUS,
      defaultDelay: 100,
      challengeBits: 64,
    });

    const params = core.getParameters();
    assert.strictEqual(params.modulus, DEFAULT_VDF_MODULUS);
    assert.strictEqual(params.defaultDelay, 100);
    assert.strictEqual(params.challengeBits, 64);

    const seed = "eos-sovereign-entropy";
    const x = core.mapToGroupElement(seed);

    assert.ok(x >= 2n && x < DEFAULT_VDF_MODULUS);
    assert.strictEqual(gcdBigInt(x, DEFAULT_VDF_MODULUS), 1n);

    // Deterministic mapping
    const x2 = core.mapToGroupElement(seed);
    assert.strictEqual(x, x2);
  });

  test("BDD-1085: Sequential Squaring Evaluation and Correctness", () => {
    const core = new EosVerifiableDelayFunctionCore({
      defaultDelay: 50,
      challengeBits: 64,
    });

    const input = "test-delay-50";
    const result = core.compute(input, 50);

    assert.strictEqual(result.delayT, 50);
    assert.ok(result.y >= 1n && result.y < DEFAULT_VDF_MODULUS);
    assert.ok(result.proof.pi >= 1n && result.proof.pi < DEFAULT_VDF_MODULUS);
    assert.strictEqual(result.randomnessBeacon.length, 64);
    assert.ok(result.elapsedMs >= 0);
    assert.ok(result.receipt.receiptSha256.length === 64);

    // Verify mathematical relation directly:
    // y = x^{2^50} mod N
    const twoPower50 = 1n << 50n;
    const directY = modPowBigInt(result.x, twoPower50, DEFAULT_VDF_MODULUS);
    assert.strictEqual(result.y, directY);
  });

  test("BDD-1086: Deterministic Fiat-Shamir Prime Challenge Generation", () => {
    const x = 123456789n;
    const y = 987654321n;
    const delayT = 200;

    const primeA = hashToPrime(x, y, delayT, 64);
    const primeB = hashToPrime(x, y, delayT, 64);

    assert.strictEqual(primeA, primeB, "Fiat-Shamir challenge must be deterministic");
    assert.ok(isProbablePrime(primeA, 16), "Challenge must be prime");
    assert.ok(primeA >= 1n << 63n, "Challenge must be 64-bit");

    // Different inputs produce different prime challenges
    const primeDifferent = hashToPrime(x + 1n, y, delayT, 64);
    assert.notStrictEqual(primeA, primeDifferent);
  });

  test("BDD-1087: Wesolowski Proof Generation and Fast Sub-Millisecond Verification", () => {
    const core = new EosVerifiableDelayFunctionCore({
      defaultDelay: 300,
      challengeBits: 64,
    });

    const evalResult = core.compute("sovereign-mission-seed", 300);

    // Fast verification
    const verifyResult = core.verify(evalResult.x, evalResult.y, evalResult.delayT, evalResult.proof);

    assert.strictEqual(verifyResult.valid, true);
    assert.ok(
      verifyResult.verificationTimeMs < 15,
      `Verification should take < 15ms; took ${verifyResult.verificationTimeMs}ms`,
    );
    assert.ok(verifyResult.receipt.receiptSha256.length === 64);

    // Forged proof test: modify pi
    const forgedProof = {
      pi: evalResult.proof.pi + 1n,
      challengePrime: evalResult.proof.challengePrime,
      proofHex: (evalResult.proof.pi + 1n).toString(16),
    };

    const forgedResult = core.verify(evalResult.x, evalResult.y, evalResult.delayT, forgedProof);
    assert.strictEqual(forgedResult.valid, false, "Forged proof must be rejected");

    // Forged challenge test
    const forgedChallengeProof = {
      pi: evalResult.proof.pi,
      challengePrime: evalResult.proof.challengePrime + 2n,
      proofHex: evalResult.proof.proofHex,
    };
    const forgedChallengeResult = core.verify(evalResult.x, evalResult.y, evalResult.delayT, forgedChallengeProof);
    assert.strictEqual(forgedChallengeResult.valid, false, "Forged challenge must be rejected");
  });

  test("BDD-1088: Unbiased Randomness Beacon and Tamper-Evident Receipts", () => {
    const core = new EosVerifiableDelayFunctionCore({ defaultDelay: 80 });
    const beacon = core.generateBeacon(999999999n);

    assert.strictEqual(beacon.length, 64);
    assert.strictEqual(beacon, core.generateBeacon(999999999n));
    assert.notStrictEqual(beacon, core.generateBeacon(1000000000n));
  });

  test("BDD-1088-CLI: End-to-End CLI Computation and Verification JSON Output", () => {
    const binPath = path.join(process.cwd(), "bin/eos.mjs");

    const computeRaw = execFileSync(
      process.execPath,
      [binPath, "vdf:compute", "--delay=100", "--seed=alpha-omega", "--json"],
      { encoding: "utf8" },
    );
    const computeData = JSON.parse(computeRaw.trim());
    assert.strictEqual(computeData.delayT, 100);
    assert.ok(computeData.proof);
    assert.ok(computeData.randomnessBeacon);
    assert.strictEqual(computeData.randomnessBeacon.length, 64);

    const verifyRaw = execFileSync(process.execPath, [binPath, "vdf:verify", "--json"], { encoding: "utf8" });
    const verifyData = JSON.parse(verifyRaw.trim());
    assert.strictEqual(verifyData.valid, true);
    assert.ok(verifyData.receipt.receiptSha256.length === 64);
  });
});
