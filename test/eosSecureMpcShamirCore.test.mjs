/**
 * Test Suite for EosSecureMpcShamirCore (SPEC-212 / BDD-1079..BDD-1083)
 *
 * Verifies Layer-0 Shamir Secret Sharing, Homomorphic Addition, and Beaver Triples.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  EosSecureMpcShamirCore,
  modBigInt,
  modInverseBigInt,
  computeShareCommitment,
  DEFAULT_MPC_PRIME,
  DEFAULT_MPC_THRESHOLD,
  DEFAULT_MPC_PARTIES,
} from "../src/core/eosSecureMpcShamirCore.ts";

describe("EosSecureMpcShamirCore (SPEC-212 / BDD-1079..BDD-1083)", () => {
  test("BDD-1079: Shamir Threshold Secret Splitting and Commitment Binding", () => {
    assert.strictEqual(typeof EosSecureMpcShamirCore, "function");
    assert.strictEqual(typeof modBigInt, "function");
    assert.strictEqual(typeof modInverseBigInt, "function");
    assert.strictEqual(typeof computeShareCommitment, "function");

    const core = new EosSecureMpcShamirCore({
      prime: 2147483647n,
      threshold: 3,
      totalParties: 5,
    });

    const params = core.getParameters();
    assert.strictEqual(params.prime, 2147483647n);
    assert.strictEqual(params.threshold, 3);
    assert.strictEqual(params.totalParties, 5);

    const secret = 424242n;
    const shares = core.split(secret, 1337);

    assert.strictEqual(shares.length, 5);
    for (let i = 0; i < 5; i++) {
      const share = shares[i];
      assert.strictEqual(share.x, BigInt(i + 1));
      assert.ok(share.y > 0n && share.y < 2147483647n);
      assert.strictEqual(share.commitment.length, 64);

      // Verify commitment validity
      const expectedCommitment = computeShareCommitment(share.x, share.y, 2147483647n);
      assert.strictEqual(share.commitment, expectedCommitment);
    }
  });

  test("BDD-1080: Threshold Reconstruction and Insufficient Shares Rejection", () => {
    const core = new EosSecureMpcShamirCore({
      prime: DEFAULT_MPC_PRIME,
      threshold: DEFAULT_MPC_THRESHOLD,
      totalParties: DEFAULT_MPC_PARTIES,
    });

    const secret = 987654321n;
    const shares = core.split(secret, 999);

    // Reconstruct using distinct 3-share subsets:
    // Subset A: shares [0, 1, 2] (x=1, x=2, x=3)
    const recA = core.combine([shares[0], shares[1], shares[2]]);
    assert.strictEqual(recA.secret, secret);
    assert.strictEqual(recA.sharesUsed, 3);
    assert.ok(recA.receipt.receiptSha256.length === 64);

    // Subset B: shares [1, 3, 4] (x=2, x=4, x=5)
    const recB = core.combine([shares[1], shares[3], shares[4]]);
    assert.strictEqual(recB.secret, secret);

    // Subset C: all 5 shares
    const recAll = core.combine(shares);
    assert.strictEqual(recAll.secret, secret);

    // Insufficient shares (2 shares when k=3)
    assert.throws(() => core.combine([shares[0], shares[1]]), /Insufficient shares for reconstruction/);
  });

  test("BDD-1081: Non-Interactive Homomorphic Addition and Scalar Scaling", () => {
    const core = new EosSecureMpcShamirCore({
      prime: 2147483647n,
      threshold: 3,
      totalParties: 5,
    });

    const secretA = 1500n;
    const secretB = 3500n;

    const sharesA = core.split(secretA, 101);
    const sharesB = core.split(secretB, 102);

    // Each party locally computes [a + b]_i = [a]_i + [b]_i
    const sharesSum = [];
    for (let i = 0; i < 5; i++) {
      sharesSum.push(core.addShares(sharesA[i], sharesB[i]));
    }

    // Combine any 3 sum shares
    const reconstructedSum = core.combine([sharesSum[0], sharesSum[2], sharesSum[4]]).secret;
    assert.strictEqual(reconstructedSum, 5000n);

    // Each party locally computes [a - b]_i = [a]_i - [b]_i
    const sharesDiff = [];
    for (let i = 0; i < 5; i++) {
      sharesDiff.push(core.subShares(sharesA[i], sharesB[i]));
    }
    const reconstructedDiff = core.combine([sharesDiff[1], sharesDiff[2], sharesDiff[3]]).secret;
    // (1500 - 3500) mod 2147483647 = -2000 mod 2147483647 = 2147481647
    assert.strictEqual(reconstructedDiff, 2147481647n);

    // Scalar scaling: 10 * [a]
    const sharesScaled = [];
    for (let i = 0; i < 5; i++) {
      sharesScaled.push(core.scaleShare(sharesA[i], 10n));
    }
    const reconstructedScaled = core.combine([sharesScaled[0], sharesScaled[1], sharesScaled[3]]).secret;
    assert.strictEqual(reconstructedScaled, 15000n);
  });

  test("BDD-1082: Interactive Multiplication via Beaver Triples", () => {
    const core = new EosSecureMpcShamirCore({
      prime: 2147483647n,
      threshold: 3,
      totalParties: 5,
    });

    const x = 120n;
    const y = 35n;

    const sharesX = core.split(x, 777);
    const sharesY = core.split(y, 888);

    // Generate Beaver triple (a, b, c = a * b mod p)
    const triple = core.generateBeaverTriple(555);
    assert.strictEqual(modBigInt(triple.a * triple.b, 2147483647n), triple.c);

    // Parties execute Beaver multiplication protocol
    const sharesProduct = core.multiplyShares(sharesX, sharesY, triple);
    assert.strictEqual(sharesProduct.length, 5);

    // Reconstruct product from any 3 parties
    const reconstructedProduct = core.combine([sharesProduct[0], sharesProduct[2], sharesProduct[4]]).secret;

    assert.strictEqual(reconstructedProduct, 4200n); // 120 * 35 = 4200
  });

  test("BDD-1083: Verifiable Secret Sharing Tamper Detection", () => {
    const core = new EosSecureMpcShamirCore();
    const shares = core.split(12345n);

    // Tamper with share 1
    const tamperedShare = {
      x: shares[0].x,
      y: shares[0].y + 1n, // modified value
      commitment: shares[0].commitment, // stale commitment
    };

    assert.throws(() => core.combine([tamperedShare, shares[1], shares[2]]), /Share integrity violation/);
  });

  test("BDD-1083-CLI: End-to-End CLI Secret Split and Combine JSON Output", () => {
    const binPath = path.join(process.cwd(), "bin/eos.mjs");

    const splitRaw = execFileSync(
      process.execPath,
      [binPath, "mpc:split", "--secret=9999", "--threshold=3", "--parties=5", "--json"],
      { encoding: "utf8" },
    );
    const splitData = JSON.parse(splitRaw.trim());
    assert.strictEqual(splitData.shares.length, 5);
    assert.strictEqual(splitData.threshold, 3);

    const combineRaw = execFileSync(process.execPath, [binPath, "mpc:combine", "--json"], { encoding: "utf8" });
    const combineData = JSON.parse(combineRaw.trim());
    assert.strictEqual(combineData.reconstruction.secret, "9999");
    assert.ok(combineData.reconstruction.receipt.receiptSha256.length === 64);
  });
});
