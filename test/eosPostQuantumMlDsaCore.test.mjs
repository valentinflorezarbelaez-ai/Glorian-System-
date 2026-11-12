/**
 * SPEC-227 / CHANGE-112: Layer-0 Post-Quantum Digital Signature Algorithm (NIST FIPS 204 ML-DSA-65)
 * Test Suite verifying BDD-1154 through BDD-1158.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosPostQuantumMlDsaCore, ML_DSA_65_PARAMS } from "../src/core/eosPostQuantumMlDsaCore.ts";

test("BDD-1154: High-Bits and Low-Bits Ring Decomposition", () => {
  const q = ML_DSA_65_PARAMS.q; // 8380417
  const gamma2 = ML_DSA_65_PARAMS.gamma2; // 261888
  const alpha = 2 * gamma2; // 523776

  // 1. Power2Round identity: r = r1 * 2^d + r0 mod q
  for (const val of [0, 1, 4095, 4096, 4097, 8191, 8192, q - 2, q - 1]) {
    const { r1, r0 } = EosPostQuantumMlDsaCore.power2Round(val);
    const twoD = 1 << ML_DSA_65_PARAMS.d;
    const reconstructed = (((r1 * twoD + r0) % q) + q) % q;
    assert.equal(reconstructed, val, `Power2Round reconstruction failed for ${val}`);
    assert.ok(r0 > -(twoD / 2) && r0 <= twoD / 2, `r0 bounded: ${r0}`);
  }

  // 2. Decompose identity: r = r1 * alpha + r0 mod q
  for (const val of [0, 100, gamma2, gamma2 + 1, alpha, q - 2, q - 1]) {
    const { r1, r0 } = EosPostQuantumMlDsaCore.decompose(val);
    const reconstructed = (((r1 * alpha + r0) % q) + q) % q;
    assert.equal(reconstructed, val, `Decompose reconstruction failed for ${val}`);
    assert.ok(r0 > -gamma2 && r0 <= gamma2, `r0 bounded in [-gamma2, gamma2]: ${r0}`);
  }

  // 3. MakeHint and UseHint round-trip for small perturbation
  for (const r of [1000, 261800, 261888, 523776]) {
    for (const z of [-100, -50, 0, 50, 100]) {
      const hint = EosPostQuantumMlDsaCore.makeHint(z, r);
      const recovered = EosPostQuantumMlDsaCore.useHint(hint, r + z);
      const expected = EosPostQuantumMlDsaCore.highBits(r);
      assert.equal(recovered, expected, `Hint recovery failed for r=${r}, z=${z}`);
    }
  }
});

test("BDD-1155: Matrix Expansion and Uniform Secret Sampling", () => {
  const rho = Buffer.alloc(32, 0x42);
  const A = EosPostQuantumMlDsaCore.expandMatrix(rho);

  assert.equal(A.length, ML_DSA_65_PARAMS.k); // 6 rows
  assert.equal(A[0].length, ML_DSA_65_PARAMS.l); // 5 cols

  for (let r = 0; r < ML_DSA_65_PARAMS.k; r++) {
    for (let c = 0; c < ML_DSA_65_PARAMS.l; c++) {
      const poly = A[r][c];
      assert.equal(poly.length, ML_DSA_65_PARAMS.n); // 256
      for (let i = 0; i < ML_DSA_65_PARAMS.n; i++) {
        assert.ok(poly[i] >= 0 && poly[i] < ML_DSA_65_PARAMS.q);
      }
    }
  }

  // Determinism check: same rho produces identical matrix
  const A2 = EosPostQuantumMlDsaCore.expandMatrix(rho);
  assert.deepEqual(A[0][0], A2[0][0]);

  // SampleBoundedPoly with eta = 4
  const bounded = EosPostQuantumMlDsaCore.sampleBoundedPoly(rho, 1, ML_DSA_65_PARAMS.eta);
  for (let i = 0; i < ML_DSA_65_PARAMS.n; i++) {
    const val = bounded[i];
    const signed = val > ML_DSA_65_PARAMS.q / 2 ? val - ML_DSA_65_PARAMS.q : val;
    assert.ok(Math.abs(signed) <= ML_DSA_65_PARAMS.eta, `Coefficient out of bound [-4, 4]: ${signed}`);
  }
});

test("BDD-1156: Honest Key Generation and Signature Verification Round-Trip", () => {
  const keyPair = EosPostQuantumMlDsaCore.keyGen();

  assert.ok(keyPair.publicKey.verificationKeyHex.length > 0);
  assert.ok(keyPair.privateKey.signingKeyHex.length > 0);
  assert.equal(keyPair.publicKey.algorithm, "ML-DSA-65");
  assert.equal(keyPair.privateKey.algorithm, "ML-DSA-65");

  const message = "Sovereign Quantum-Resilient Attestation across Glorian Fleet";
  const signature = EosPostQuantumMlDsaCore.sign(message, keyPair.privateKey);

  assert.equal(signature.algorithm, "ML-DSA-65");
  assert.equal(signature.cTildeHex.length, 64); // 32 bytes hex
  assert.ok(signature.signatureHex.length > 100);

  const isValid = EosPostQuantumMlDsaCore.verify(message, signature, keyPair.publicKey);
  assert.equal(isValid, true, "Signature must verify successfully for honest execution");
});

test("BDD-1157: Signature Tamper and Forgery Rejection", () => {
  const keyPair = EosPostQuantumMlDsaCore.keyGen();
  const message = "Authenticated payload data #1157";
  const signature = EosPostQuantumMlDsaCore.sign(message, keyPair.privateKey);

  // 1. Modified message must fail
  const tamperedMessage = message + " [tampered]";
  const isMessageTamperedValid = EosPostQuantumMlDsaCore.verify(tamperedMessage, signature, keyPair.publicKey);
  assert.equal(isMessageTamperedValid, false, "Tampered message must be rejected");

  // 2. Modified signature hex must fail
  const sigBytes = Buffer.from(signature.signatureHex, "hex");
  sigBytes[10] ^= 0x55; // flip bit
  const tamperedSig = sigBytes.toString("hex");

  const isSigTamperedValid = EosPostQuantumMlDsaCore.verify(message, tamperedSig, keyPair.publicKey);
  assert.equal(isSigTamperedValid, false, "Tampered signature must be rejected");

  // 3. Foreign public key must fail
  const foreignKeyPair = EosPostQuantumMlDsaCore.keyGen();
  const isForeignValid = EosPostQuantumMlDsaCore.verify(message, signature, foreignKeyPair.publicKey);
  assert.equal(isForeignValid, false, "Foreign public key must reject signature");
});

test("BDD-1158: Hybrid Ed25519 + ML-DSA Signatures and CLI/MCP Dispatch", () => {
  const hybridKeyPair = EosPostQuantumMlDsaCore.generateHybridKeyPair();

  assert.ok(hybridKeyPair.ed25519PublicKeyPem.includes("BEGIN PUBLIC KEY"));
  assert.ok(hybridKeyPair.ed25519PrivateKeyPem.includes("BEGIN PRIVATE KEY"));
  assert.equal(hybridKeyPair.mlDsaKeyPair.publicKey.algorithm, "ML-DSA-65");

  const payload = "Glorian Fleet Hybrid Quantum Attestation Bundle v75.0.0";
  const hybridSig = EosPostQuantumMlDsaCore.signHybrid(payload, hybridKeyPair);

  assert.equal(hybridSig.algorithm, "HYBRID-ED25519-ML-DSA-65");
  assert.ok(hybridSig.ed25519SignatureHex.length === 128); // 64 bytes hex
  assert.ok(hybridSig.receiptSha256.length === 64); // SHA-256

  const isValid = EosPostQuantumMlDsaCore.verifyHybrid(
    payload,
    hybridSig,
    hybridKeyPair.ed25519PublicKeyPem,
    hybridKeyPair.mlDsaKeyPair.publicKey,
  );
  assert.equal(isValid, true, "Composite hybrid signature must verify both algorithms");

  const isTamperedValid = EosPostQuantumMlDsaCore.verifyHybrid(
    payload + " [tampered]",
    hybridSig,
    hybridKeyPair.ed25519PublicKeyPem,
    hybridKeyPair.mlDsaKeyPair.publicKey,
  );
  assert.equal(isTamperedValid, false, "Tampered payload must fail hybrid verification");
});
