import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { EosBulletproofsRangeProofCore } from "../src/core/eosBulletproofsRangeProofCore.ts";
import { isOnCurve, pointAdd, SECP256K1_G, SECP256K1_Q, secpMod } from "../src/core/eosVerifiableRandomFunctionCore.ts";
import { dispatchPhase7FrontierActionExt } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts";

test("BDD-1129: Transparent Generator Derivation and Pedersen Homomorphism", () => {
  const params16 = EosBulletproofsRangeProofCore.setupGenerators(16);
  assert.strictEqual(params16.bitLength, 16);
  assert.strictEqual(params16.g.length, 16);
  assert.strictEqual(params16.h.length, 16);
  assert.ok(isOnCurve(params16.H));
  assert.ok(isOnCurve(params16.U));

  for (let i = 0; i < 16; i++) {
    assert.ok(isOnCurve(params16.g[i]), `g[${i}] must be on curve`);
    assert.ok(isOnCurve(params16.h[i]), `h[${i}] must be on curve`);
  }

  // Pedersen homomorphic property: V(v1 + v2, gamma1 + gamma2) = V1 + V2
  const v1 = 1500n;
  const g1 = 777n;
  const v2 = 2500n;
  const g2 = 888n;

  const comm1 = EosBulletproofsRangeProofCore.commit(v1, g1);
  const comm2 = EosBulletproofsRangeProofCore.commit(v2, g2);
  const commSum = EosBulletproofsRangeProofCore.commit(v1 + v2, g1 + g2);

  const ptSum = pointAdd(comm1.point, comm2.point);
  assert.ok(ptSum !== null);
  assert.strictEqual(ptSum.x, commSum.point.x, "Pedersen X coordinate homomorphic equality");
  assert.strictEqual(ptSum.y, commSum.point.y, "Pedersen Y coordinate homomorphic equality");
});

test("BDD-1130: Valid Range Proof Generation and Logarithmic Verification", () => {
  // Range proof for v = 42000 in [0, 2^32 - 1]
  const v = 42000n;
  const proof = EosBulletproofsRangeProofCore.prove(v, 999999n, 32);

  assert.strictEqual(proof.bitLength, 32);
  assert.strictEqual(proof.ipProof.L.length, 5, "log2(32) == 5 inner product rounds");
  assert.strictEqual(proof.ipProof.R.length, 5);
  assert.ok(proof.proofSha256.length === 64);

  // Verification
  const result = EosBulletproofsRangeProofCore.verify(proof);
  assert.strictEqual(result.valid, true, "Verification of valid range proof must succeed");
  assert.strictEqual(result.bitLength, 32);
  assert.strictEqual(result.receipt.operation, "verify");
  assert.ok(result.verificationTimeMs >= 0);

  // Range proof for m = 16
  const proof16 = EosBulletproofsRangeProofCore.prove(1337n, undefined, 16);
  assert.strictEqual(proof16.bitLength, 16);
  assert.strictEqual(proof16.ipProof.L.length, 4, "log2(16) == 4 inner product rounds");
  const result16 = EosBulletproofsRangeProofCore.verify(proof16);
  assert.strictEqual(result16.valid, true, "16-bit proof must be verified successfully");
});

test("BDD-1131: Soundness and Out-of-Range Value Rejection", () => {
  // Values >= 2^16 rejected by prove() when claiming 16-bit range
  assert.throws(() => {
    EosBulletproofsRangeProofCore.prove(65536n, undefined, 16);
  }, /out of bounds/);

  assert.throws(() => {
    EosBulletproofsRangeProofCore.prove(-1n, undefined, 16);
  }, /out of bounds/);

  // Mismatched expected commitment in verify()
  const validProof = EosBulletproofsRangeProofCore.prove(100n, undefined, 16);
  const foreignComm = EosBulletproofsRangeProofCore.commit(200n);
  const res = EosBulletproofsRangeProofCore.verify(validProof, foreignComm.point);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.reason, "Commitment mismatch");
});

test("BDD-1132: Tampered Proof Rejection and Non-Malleability", () => {
  const proof = EosBulletproofsRangeProofCore.prove(500n, 12345n, 16);

  // 1. Tamper tauX
  const tamperedTauX = {
    ...proof,
    tauX: secpMod(proof.tauX + 1n, SECP256K1_Q),
  };
  assert.strictEqual(EosBulletproofsRangeProofCore.verify(tamperedTauX).valid, false);

  // 2. Tamper mu
  const tamperedMu = {
    ...proof,
    mu: secpMod(proof.mu + 1n, SECP256K1_Q),
  };
  assert.strictEqual(EosBulletproofsRangeProofCore.verify(tamperedMu).valid, false);

  // 3. Tamper tHat
  const tamperedTHat = {
    ...proof,
    tHat: secpMod(proof.tHat + 1n, SECP256K1_Q),
  };
  assert.strictEqual(EosBulletproofsRangeProofCore.verify(tamperedTHat).valid, false);

  // 4. Tamper inner product scalar a
  const tamperedA = {
    ...proof,
    ipProof: {
      ...proof.ipProof,
      a: secpMod(proof.ipProof.a + 1n, SECP256K1_Q),
    },
  };
  assert.strictEqual(EosBulletproofsRangeProofCore.verify(tamperedA).valid, false);

  // 5. Tamper inner product vector L[0]
  const tamperedL = {
    ...proof,
    ipProof: {
      ...proof.ipProof,
      L: [pointAdd(proof.ipProof.L[0], SECP256K1_G), ...proof.ipProof.L.slice(1)],
    },
  };
  assert.strictEqual(EosBulletproofsRangeProofCore.verify(tamperedL).valid, false);
});

test("BDD-1133: CLI Subcommands and MCP Dispatch", () => {
  // CLI bp:commit
  const commitOutput = execSync("node bin/eos.mjs bp:commit --value=7777 --json", {
    encoding: "utf-8",
  });
  const commitJson = JSON.parse(commitOutput);
  assert.strictEqual(commitJson.value, "7777");
  assert.ok(commitJson.pointHex.startsWith("02") || commitJson.pointHex.startsWith("03"));

  // CLI bp:verify
  const verifyOutput = execSync("node bin/eos.mjs bp:verify --value=5555 --m=16 --json", {
    encoding: "utf-8",
  });
  const verifyJson = JSON.parse(verifyOutput);
  assert.strictEqual(verifyJson.valid, true);
  assert.strictEqual(verifyJson.bitLength, 16);
  assert.ok(verifyJson.receipt.receiptSha256.length === 64);

  // MCP tool actions
  const fakeDeps = {};
  const mcpCommit = dispatchPhase7FrontierActionExt("bp_commit", { value: "3333" }, fakeDeps);
  assert.strictEqual(mcpCommit.action, "bp_commit");
  assert.strictEqual(mcpCommit.value, "3333");

  const mcpProve = dispatchPhase7FrontierActionExt("bp_prove", { value: "4444", m: 16 }, fakeDeps);
  assert.strictEqual(mcpProve.action, "bp_prove");
  assert.strictEqual(mcpProve.bitLength, 16);
  assert.strictEqual(mcpProve.innerProductRounds, 4);

  const mcpVerify = dispatchPhase7FrontierActionExt("bp_verify", { value: "4444", m: 16 }, fakeDeps);
  assert.strictEqual(mcpVerify.action, "bp_verify");
  assert.strictEqual(mcpVerify.valid, true);
  assert.strictEqual(mcpVerify.bitLength, 16);
});
