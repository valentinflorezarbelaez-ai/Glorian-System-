/**
 * @file eosVerifiableSecretSharingCore.test.mjs
 * @description BDD test suite for Layer-0 Verifiable Secret Sharing (Feldman & Pedersen VSS).
 * BDD-1184..BDD-1188 / SPEC-233 / CHANGE-118
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EosVerifiableSecretSharingCore,
  VSS_SAFE_PRIME_P,
  VSS_GENERATOR_G,
} from "../src/core/eosVerifiableSecretSharingCore.ts";

describe("EosVerifiableSecretSharingCore (SPEC-233 / CHANGE-118)", () => {
  const testSecret = "Sovereign-Ledger-Secret-2027";

  // BDD-1184: Feldman VSS Share Generation and Homomorphic Commitments
  it("BDD-1184: should generate (k, n) verifiable shares with C0 = g^s mod p", () => {
    const k = 3;
    const n = 5;
    const deal = EosVerifiableSecretSharingCore.splitSecret(testSecret, k, n, "feldman");

    assert.equal(deal.shares.length, 5);
    assert.equal(deal.commitments.commitmentsHex.length, 3);
    assert.equal(deal.scheme, "feldman");

    // Verify C0 === g^s mod p
    const secretScalar = EosVerifiableSecretSharingCore.secretToScalar(testSecret);
    const expectedC0 = EosVerifiableSecretSharingCore.modPow(VSS_GENERATOR_G, secretScalar, VSS_SAFE_PRIME_P);
    assert.equal(deal.commitments.commitmentsHex[0], expectedC0.toString(16));
  });

  // BDD-1185: Independent Share Verification and Tamper Detection
  it("BDD-1185: should verify all honest shares and immediately reject tampered shares", () => {
    const deal = EosVerifiableSecretSharingCore.splitSecret(testSecret, 3, 5, "feldman");

    // All 5 honest shares must pass verification
    for (const share of deal.shares) {
      const res = EosVerifiableSecretSharingCore.verifyShare(share, deal.commitments);
      assert.equal(res.valid, true, `Share ${share.id} must verify against public commitments`);
    }

    // Tampered share must be rejected
    const tamperedShare = {
      id: 3,
      valueHex: (BigInt("0x" + deal.shares[2].valueHex) + 1n).toString(16),
    };
    const tamperedCheck = EosVerifiableSecretSharingCore.verifyShare(tamperedShare, deal.commitments);
    assert.equal(tamperedCheck.valid, false, "Tampered share must fail verification");
    assert.ok(tamperedCheck.reason?.includes("Homomorphic"));
  });

  // BDD-1186: Threshold Reconstruction from Any k Valid Shares
  it("BDD-1186: should reconstruct exact original secret from any k distinct shares", () => {
    const deal = EosVerifiableSecretSharingCore.splitSecret(testSecret, 3, 5, "feldman");

    // Subset 1: shares {1, 3, 5}
    const subset1 = [deal.shares[0], deal.shares[2], deal.shares[4]];
    const res1 = EosVerifiableSecretSharingCore.reconstruct(subset1, 3);
    assert.equal(res1.secretString, testSecret);

    // Subset 2: shares {2, 3, 4}
    const subset2 = [deal.shares[1], deal.shares[2], deal.shares[3]];
    const res2 = EosVerifiableSecretSharingCore.reconstruct(subset2, 3);
    assert.equal(res2.secretString, testSecret);

    // Subset 3: shares {1, 4, 5}
    const subset3 = [deal.shares[0], deal.shares[3], deal.shares[4]];
    const res3 = EosVerifiableSecretSharingCore.reconstruct(subset3, 3);
    assert.equal(res3.secretString, testSecret);

    // Providing fewer than k shares must fail
    assert.throws(
      () => EosVerifiableSecretSharingCore.reconstruct([deal.shares[0], deal.shares[1]], 3),
      /Insufficient valid shares/,
    );
  });

  // BDD-1187: Cheater Detection and Malicious Participant Isolation
  it("BDD-1187: should detect cheaters, isolate invalid shares, and reconstruct from valid shares", () => {
    const deal = EosVerifiableSecretSharingCore.splitSecret(testSecret, 3, 5, "feldman");

    // Create a pool of 4 shares where participant #2 is a cheater
    const forgedShare2 = {
      id: 2,
      valueHex: "deadbeefcafebabe12345678",
    };
    const pool = [deal.shares[0], forgedShare2, deal.shares[2], deal.shares[4]];

    const res = EosVerifiableSecretSharingCore.reconstruct(pool, 3, deal.commitments);

    assert.equal(res.secretString, testSecret);
    assert.deepEqual(res.cheatersIdentified, [2], "Participant 2 must be isolated as cheater");
    assert.equal(res.validShareCount, 3);
  });

  // BDD-1188: Pedersen Dual-Generator VSS and Serialization Roundtrip
  it("BDD-1188: should split via Pedersen VSS with dual generators and survive serialization roundtrip", () => {
    const deal = EosVerifiableSecretSharingCore.splitSecret(testSecret, 3, 5, "pedersen");
    assert.equal(deal.scheme, "pedersen");
    assert.ok(deal.commitments.generatorHHex);

    // All shares must verify against Pedersen commitments
    for (const share of deal.shares) {
      assert.ok(share.blindingHex, "Pedersen share must include blinding scalar");
      const check = EosVerifiableSecretSharingCore.verifyShare(share, deal.commitments);
      assert.equal(check.valid, true, `Pedersen share ${share.id} must be valid`);
    }

    // Serialization roundtrip
    const json = EosVerifiableSecretSharingCore.serialize(deal);
    const restored = EosVerifiableSecretSharingCore.deserialize(json);

    assert.equal(restored.scheme, "pedersen");
    assert.equal(restored.shares.length, 5);

    // Reconstruct from restored shares
    const subset = [restored.shares[0], restored.shares[1], restored.shares[3]];
    const reconstructed = EosVerifiableSecretSharingCore.reconstruct(subset, 3, restored.commitments);
    assert.equal(reconstructed.secretString, testSecret);
  });
});
