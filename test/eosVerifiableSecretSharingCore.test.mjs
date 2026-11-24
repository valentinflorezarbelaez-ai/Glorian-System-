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

  // BDD-1189: Explicit Experimental Perimeter & EOS_VSS_DISALLOW_EXPERIMENTAL Fail-Closed Guard
  it("BDD-1189: should stamp experimental security posture and fail closed when EOS_VSS_DISALLOW_EXPERIMENTAL=1", () => {
    assert.equal(EosVerifiableSecretSharingCore.SECURITY_POSTURE, "EXPERIMENTAL_NON_CONSTANT_TIME_BIGINT");
    assert.equal(EosVerifiableSecretSharingCore.APPROVED_FOR_PRODUCTION_SECRETS, false);

    const deal = EosVerifiableSecretSharingCore.splitSecret(Buffer.from("PerimTest", "utf8"), 2, 3, "feldman");
    assert.equal(deal.securityPosture, "EXPERIMENTAL_NON_CONSTANT_TIME_BIGINT");
    assert.equal(deal.approvedForProductionSecrets, false);

    const participantJson = EosVerifiableSecretSharingCore.serializeForParticipant(deal, 1);
    const participantPayload = JSON.parse(participantJson);
    assert.equal(participantPayload.securityPosture, "EXPERIMENTAL_NON_CONSTANT_TIME_BIGINT");
    assert.equal(participantPayload.approvedForProductionSecrets, false);

    const reconstructed = EosVerifiableSecretSharingCore.reconstruct(deal.shares.slice(0, 2), 2, deal.commitments);
    assert.equal(reconstructed.secretString, "PerimTest");
    assert.equal(reconstructed.securityPosture, "EXPERIMENTAL_NON_CONSTANT_TIME_BIGINT");
    assert.equal(reconstructed.approvedForProductionSecrets, false);

    // Legacy deals without explicit metadata stamp fail-safe posture on deserialize; forged approval fails closed
    const legacyPayload = JSON.parse(EosVerifiableSecretSharingCore.serialize(deal));
    delete legacyPayload.securityPosture;
    delete legacyPayload.approvedForProductionSecrets;
    const upgraded = EosVerifiableSecretSharingCore.deserialize(JSON.stringify(legacyPayload));
    assert.equal(upgraded.securityPosture, "EXPERIMENTAL_NON_CONSTANT_TIME_BIGINT");
    assert.equal(upgraded.approvedForProductionSecrets, false);

    assert.throws(
      () =>
        EosVerifiableSecretSharingCore.deserialize(
          JSON.stringify({ ...legacyPayload, approvedForProductionSecrets: true }),
        ),
      /cannot claim production secret approval/,
    );
    assert.throws(
      () =>
        EosVerifiableSecretSharingCore.deserialize(
          JSON.stringify({ ...legacyPayload, securityPosture: "FIPS_140_3_AUDITED" }),
        ),
      /invalid security posture/,
    );

    const previousEnv = process.env.EOS_VSS_DISALLOW_EXPERIMENTAL;
    process.env.EOS_VSS_DISALLOW_EXPERIMENTAL = "1";
    try {
      assert.throws(
        () => EosVerifiableSecretSharingCore.splitSecret("blocked", 2, 3, "pedersen"),
        /EOS_VSS_DISALLOW_EXPERIMENTAL=1/,
      );
      assert.throws(
        () => EosVerifiableSecretSharingCore.reconstruct(deal.shares.slice(0, 2), 2, deal.commitments),
        /EOS_VSS_DISALLOW_EXPERIMENTAL=1/,
      );
    } finally {
      if (previousEnv === undefined) {
        delete process.env.EOS_VSS_DISALLOW_EXPERIMENTAL;
      } else {
        process.env.EOS_VSS_DISALLOW_EXPERIMENTAL = previousEnv;
      }
    }
  });

  // BDD-1190: Fast Input-Validation & Boundary Error Paths (coverage without slow modPow loops)
  it("BDD-1190: should validate algebraic bounds, commitment packages, and serialization error paths", () => {
    assert.equal(EosVerifiableSecretSharingCore.modPow(4n, -1n, 11n), 3n);
    assert.throws(() => EosVerifiableSecretSharingCore.modInverse(4n, 8n), /not coprime/);
    assert.throws(() => EosVerifiableSecretSharingCore.randomScalar(1n), /greater than 1/);
    assert.throws(() => EosVerifiableSecretSharingCore.randomScalar(1n << 4000n), /exceeds the supported group size/);

    assert.equal(EosVerifiableSecretSharingCore.secretToScalar(7n), 7n);
    assert.throws(() => EosVerifiableSecretSharingCore.secretToScalar(0n), /range \[1, q - 1\]/);
    assert.throws(() => EosVerifiableSecretSharingCore.secretToScalar(123), /string, Buffer, or bigint/);
    assert.throws(() => EosVerifiableSecretSharingCore.secretToScalar(""), /between 1 and/);
    assert.throws(() => EosVerifiableSecretSharingCore.secretToScalar(Buffer.alloc(400, 1)), /between 1 and/);
    assert.throws(() => EosVerifiableSecretSharingCore.secretToScalar(Buffer.from([0])), /scalar in the range/);

    assert.equal(EosVerifiableSecretSharingCore.scalarToString(1n), undefined);
    assert.equal(EosVerifiableSecretSharingCore.scalarToString(0x41n), "A");

    assert.throws(() => EosVerifiableSecretSharingCore.splitSecret("ok", 1, 2), /2 <= k <= n/);
    assert.throws(() => EosVerifiableSecretSharingCore.splitSecret("ok", 2, 65), /exceeds the configured limit/);
    assert.throws(() => EosVerifiableSecretSharingCore.splitSecret("ok", 2.5, 3), /safe integers/);
    assert.throws(() => EosVerifiableSecretSharingCore.splitSecret("ok", 2, 3, "shamir"), /Unsupported VSS scheme/);

    const fastDeal = EosVerifiableSecretSharingCore.splitSecret(7n, 2, 2, "feldman");
    const c = fastDeal.commitments;

    assert.equal(EosVerifiableSecretSharingCore.verifyShare(null, c).valid, false);
    assert.equal(EosVerifiableSecretSharingCore.verifyShare({ id: 99, valueHex: "1" }, c).valid, false);
    assert.equal(EosVerifiableSecretSharingCore.verifyShare({ id: 1, valueHex: "1" }, null).valid, false);
    assert.equal(
      EosVerifiableSecretSharingCore.verifyShare(
        { id: 1, valueHex: "1" },
        { ...c, scheme: "pedersen", generatorHHex: "9" },
      ).valid,
      false,
    );
    assert.equal(
      EosVerifiableSecretSharingCore.verifyShare({ id: 1, valueHex: "1" }, { ...c, primePHex: "b" }).valid,
      false,
    );
    assert.equal(
      EosVerifiableSecretSharingCore.verifyShare(
        { id: 1, valueHex: "1" },
        { ...c, scheme: "pedersen", generatorHHex: "5" },
      ).valid,
      false,
    );
    assert.equal(
      EosVerifiableSecretSharingCore.verifyShare({ id: 1, valueHex: "1" }, { ...c, generatorHHex: "9" }).valid,
      false,
    );
    assert.equal(
      EosVerifiableSecretSharingCore.verifyShare(
        { id: 1, valueHex: "1" },
        { ...c, commitmentsHex: ["2", c.commitmentsHex[1]] },
      ).valid,
      false,
    );
    assert.equal(
      EosVerifiableSecretSharingCore.verifyShare(
        { id: 1, valueHex: "1" },
        { ...c, commitmentsHex: [c.commitmentsHex[0]] },
      ).valid,
      false,
    );

    assert.throws(() => EosVerifiableSecretSharingCore.reconstruct([], 1), /Threshold k must be/);
    assert.throws(() => EosVerifiableSecretSharingCore.reconstruct(null, 2), /Shares must be an array/);
    assert.throws(() => EosVerifiableSecretSharingCore.reconstruct(fastDeal.shares, 3, c), /must match the commitment/);
    assert.throws(
      () => EosVerifiableSecretSharingCore.reconstruct([{ id: 0, valueHex: "1" }, fastDeal.shares[1]], 2),
      /positive safe integers/,
    );
    assert.throws(
      () => EosVerifiableSecretSharingCore.reconstruct([fastDeal.shares[0], fastDeal.shares[0]], 2),
      /Duplicate participant share id/,
    );

    assert.throws(
      () => EosVerifiableSecretSharingCore.serializeForParticipant({ ...fastDeal, k: 3 }, 1),
      /2 <= k <= n|must match|Commitment count/,
    );
    assert.throws(
      () => EosVerifiableSecretSharingCore.serializeForParticipant({ ...fastDeal, scheme: "pedersen" }, 1),
      /must match/,
    );
    assert.throws(
      () => EosVerifiableSecretSharingCore.serializeForParticipant({ ...fastDeal, shares: [] }, 1),
      /exactly n shares/,
    );
    assert.throws(() => EosVerifiableSecretSharingCore.serializeForParticipant(fastDeal, 99), /outside the declared/);
    assert.throws(
      () =>
        EosVerifiableSecretSharingCore.serializeForParticipant(
          { ...fastDeal, shares: [{ id: 1, valueHex: "1" }, fastDeal.shares[1]] },
          1,
        ),
      /No valid share exists/,
    );

    assert.throws(() => EosVerifiableSecretSharingCore.deserialize(123), /no larger than 1 MiB/);
    assert.throws(() => EosVerifiableSecretSharingCore.deserialize("[]"), /Invalid VssDeal JSON object/);
    assert.throws(
      () => EosVerifiableSecretSharingCore.deserialize(JSON.stringify({ ...fastDeal, scheme: "bad" })),
      /Invalid VSS scheme/,
    );
    assert.throws(
      () => EosVerifiableSecretSharingCore.deserialize(JSON.stringify({ ...fastDeal, shares: [] })),
      /inconsistent/,
    );
    assert.throws(
      () =>
        EosVerifiableSecretSharingCore.deserialize(
          JSON.stringify({ ...fastDeal, shares: [fastDeal.shares[0], fastDeal.shares[0]] }),
        ),
      /invalid or duplicate participant id/,
    );
    assert.throws(
      () =>
        EosVerifiableSecretSharingCore.deserialize(
          JSON.stringify({
            ...fastDeal,
            shares: [{ ...fastDeal.shares[0], blindingHex: "1" }, fastDeal.shares[1]],
          }),
        ),
      /cannot contain a blinding scalar/,
    );
  });
});
