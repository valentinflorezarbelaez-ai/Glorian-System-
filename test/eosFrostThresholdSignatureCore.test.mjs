/**
 * EOS Layer-0 FROST Threshold Schnorr Signatures (RFC 9591) Core Test Suite
 * Governed by SPEC-219: FR-1114..FR-1118 and BDD-1114..BDD-1118.
 * Zero external runtime dependencies.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  EosFrostThresholdSignatureCore,
  computeLagrangeCoefficient,
} from "../src/core/eosFrostThresholdSignatureCore.ts";
import {
  SECP256K1_G,
  SECP256K1_Q,
  pointMultiply,
  serializePoint,
} from "../src/core/eosVerifiableRandomFunctionCore.ts";
import { dispatchPhase7FrontierActionExt } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts";

describe("EosFrostThresholdSignatureCore (SPEC-219 / BDD-1114..BDD-1118)", () => {
  test("BDD-1114: Verifiable (t, n) Distributed Key Setup and Group Key Derivation", () => {
    assert.strictEqual(typeof EosFrostThresholdSignatureCore, "function");
    assert.strictEqual(typeof computeLagrangeCoefficient, "function");

    const setup = EosFrostThresholdSignatureCore.setup(3, 5, "test-seed-1114");
    assert.strictEqual(setup.groupKey.threshold, 3);
    assert.strictEqual(setup.groupKey.totalSigners, 5);
    assert.strictEqual(setup.keyShares.length, 5);
    assert.strictEqual(setup.groupKey.participantVerificationKeys.length, 5);

    // Verify verification keys match secret shares
    for (const share of setup.keyShares) {
      const pubPoint = pointMultiply(share.secretShare, SECP256K1_G);
      assert.strictEqual(serializePoint(pubPoint), share.verificationKeyHex);
    }

    // Lagrange interpolation reconstruction of secret key from any 3 shares
    const subset = [setup.keyShares[0], setup.keyShares[2], setup.keyShares[4]];
    const subsetIds = subset.map((s) => s.participantId);
    let reconstructedSecret = 0n;
    for (const s of subset) {
      const lambda = computeLagrangeCoefficient(s.participantId, subsetIds);
      reconstructedSecret = (reconstructedSecret + s.secretShare * lambda) % SECP256K1_Q;
    }
    const reconstructedGroupPub = pointMultiply(reconstructedSecret, SECP256K1_G);
    assert.strictEqual(serializePoint(reconstructedGroupPub), setup.groupKey.groupPublicKeyHex);

    // Precondition boundaries
    assert.throws(() => EosFrostThresholdSignatureCore.setup(1, 5));
    assert.throws(() => EosFrostThresholdSignatureCore.setup(5, 3));
  });

  test("BDD-1115: Round 1 Nonce Commitments and Anti-ROS Binding Factors", () => {
    const nonces1 = EosFrostThresholdSignatureCore.generateNonces(1, "nonce-seed-1");
    assert.strictEqual(nonces1.participantId, 1);
    assert.ok(nonces1.hidingCommitmentHex.length === 66 || nonces1.hidingCommitmentHex.length === 130);
    assert.ok(nonces1.bindingCommitmentHex.length === 66 || nonces1.bindingCommitmentHex.length === 130);

    const nonces2 = EosFrostThresholdSignatureCore.generateNonces(2, "nonce-seed-2");
    const nonces3 = EosFrostThresholdSignatureCore.generateNonces(3, "nonce-seed-3");

    const commitments = [
      {
        participantId: 1,
        hidingCommitmentHex: nonces1.hidingCommitmentHex,
        bindingCommitmentHex: nonces1.bindingCommitmentHex,
      },
      {
        participantId: 2,
        hidingCommitmentHex: nonces2.hidingCommitmentHex,
        bindingCommitmentHex: nonces2.bindingCommitmentHex,
      },
      {
        participantId: 3,
        hidingCommitmentHex: nonces3.hidingCommitmentHex,
        bindingCommitmentHex: nonces3.bindingCommitmentHex,
      },
    ];

    const bfMsg1 = EosFrostThresholdSignatureCore.computeBindingFactors("tx-alpha", commitments);
    assert.strictEqual(bfMsg1.size, 3);
    assert.ok(bfMsg1.get(1) > 0n);

    // Anti-ROS property: changing message changes all binding factors
    const bfMsg2 = EosFrostThresholdSignatureCore.computeBindingFactors("tx-beta", commitments);
    assert.notStrictEqual(bfMsg1.get(1), bfMsg2.get(1));
    assert.notStrictEqual(bfMsg1.get(2), bfMsg2.get(2));
  });

  test("BDD-1116: Round 2 Threshold Signing and Lagrange Share Aggregation", () => {
    const core = new EosFrostThresholdSignatureCore();
    const setup = EosFrostThresholdSignatureCore.setup(3, 5, "threshold-seed-1116");

    const message = "transfer-1000-tokens-to-alice";

    // Subset A: {1, 2, 3}
    const subsetA = [setup.keyShares[0], setup.keyShares[1], setup.keyShares[2]];
    const signResultA = core.sign(setup.groupKey, subsetA, message, "session-a");

    assert.ok(signResultA.signatureHex.length > 64);
    assert.strictEqual(signResultA.message, message);
    assert.strictEqual(signResultA.groupPublicKeyHex, setup.groupKey.groupPublicKeyHex);
    assert.ok(signResultA.receipt.receiptSha256.length === 64);

    // Subset B: {2, 4, 5}
    const subsetB = [setup.keyShares[1], setup.keyShares[3], setup.keyShares[4]];
    const signResultB = core.sign(setup.groupKey, subsetB, message, "session-b");

    assert.ok(signResultB.signatureHex.length > 64);
    assert.notStrictEqual(signResultA.signatureHex, signResultB.signatureHex); // Different session nonces

    // Both distinct signatures verify under identical group public key
    const verifyA = core.verify(setup.groupKey.groupPublicKey, message, signResultA.signature);
    const verifyB = core.verify(setup.groupKey.groupPublicKey, message, signResultB.signature);

    assert.strictEqual(verifyA.valid, true);
    assert.strictEqual(verifyB.valid, true);
    assert.ok(verifyA.verificationTimeMs >= 0);
  });

  test("BDD-1117: Standard Single-Key Schnorr Verification Equivalence and Forgery Rejection", () => {
    const core = new EosFrostThresholdSignatureCore();
    const setup = EosFrostThresholdSignatureCore.setup(2, 3, "schnorr-seed-1117");
    const message = "immutable-governance-proposal-42";

    const subset = [setup.keyShares[0], setup.keyShares[1]];
    const signResult = core.sign(setup.groupKey, subset, message, "session-c");

    // Valid verification
    const validRes = core.verify(setup.groupKey.groupPublicKey, message, signResult.signature);
    assert.strictEqual(validRes.valid, true);

    // Tampered message
    const tamperedMsgRes = core.verify(setup.groupKey.groupPublicKey, "tampered-message", signResult.signature);
    assert.strictEqual(tamperedMsgRes.valid, false);

    // Tampered scalar z
    const tamperedSig = {
      ...signResult.signature,
      z: (signResult.signature.z + 1n) % SECP256K1_Q,
    };
    const tamperedSigRes = core.verify(setup.groupKey.groupPublicKey, message, tamperedSig);
    assert.strictEqual(tamperedSigRes.valid, false);

    // Insufficient signers (< threshold) throws precondition
    assert.throws(() => core.sign(setup.groupKey, [setup.keyShares[0]], message));
  });

  test("BDD-1118: Frontier CLI and MCP Dispatch", () => {
    const root = path.resolve(".");

    // 1. CLI frost:keygen
    const keygenOut = execFileSync("node", ["bin/eos.mjs", "frost:keygen", "--threshold=3", "--signers=5", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    const keygenJson = JSON.parse(keygenOut);
    assert.strictEqual(keygenJson.threshold, 3);
    assert.strictEqual(keygenJson.totalSigners, 5);
    assert.ok(keygenJson.groupPublicKeyHex.length > 0);

    // 2. CLI frost:sign
    const signOut = execFileSync("node", ["bin/eos.mjs", "frost:sign", "--message=cli-msg-1118", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    const signJson = JSON.parse(signOut);
    assert.strictEqual(signJson.message, "cli-msg-1118");
    assert.ok(signJson.signatureHex.length > 64);
    assert.strictEqual(signJson.receipt.operation, "sign");

    // 3. CLI frost:verify
    const verifyOut = execFileSync("node", ["bin/eos.mjs", "frost:verify", "--message=cli-msg-1118", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    const verifyJson = JSON.parse(verifyOut);
    assert.strictEqual(verifyJson.valid, true);
    assert.ok(verifyJson.receipt.receiptSha256.length === 64);

    // 4. MCP Dispatcher Integration
    const dummyDeps = { sovereignLedgerPath: ":memory:" };

    const mcpKeygen = dispatchPhase7FrontierActionExt("frost_keygen", { threshold: 2, signers: 4 }, dummyDeps);
    assert.strictEqual(mcpKeygen.action, "frost_keygen");
    assert.strictEqual(mcpKeygen.totalSigners, 4);

    const mcpSign = dispatchPhase7FrontierActionExt("frost_sign", { message: "mcp-tx" }, dummyDeps);
    assert.strictEqual(mcpSign.action, "frost_sign");
    assert.ok(mcpSign.signatureHex.length > 64);

    const mcpVerify = dispatchPhase7FrontierActionExt("frost_verify", { message: "mcp-tx" }, dummyDeps);
    assert.strictEqual(mcpVerify.action, "frost_verify");
    assert.strictEqual(mcpVerify.valid, true);
  });
});
