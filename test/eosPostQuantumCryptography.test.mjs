/**
 * EOS SYSTEM — POST-QUANTUM CRYPTOGRAPHY TEST SUITE
 * Governed by SPEC-199, CHANGE-084, ADR-084, BDD-1014..BDD-1018 (v69.0.0)
 *
 * Validates NIST FIPS 203 (ML-KEM) and NIST FIPS 204 (ML-DSA) module-lattice
 * key encapsulation and digital signatures with hybrid X25519/Ed25519 support.
 * Pure JavaScript for native Node.js test runner (zero external dependencies).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EosPostQuantumCryptography } from "../src/core/eosPostQuantumCryptography.ts";
import { EosSlsaSupplyChainAttestation } from "../src/core/eosSlsaSupplyChainAttestation.ts";

describe("EosPostQuantumCryptography (SPEC-199 / BDD-1014..BDD-1018)", () => {
  it("BDD-1014: ML-KEM key generation, encapsulation, and decapsulation", () => {
    // 1. Generate keypair for ML-KEM-768
    const keypair = EosPostQuantumCryptography.generateMlKemKeyPair("ML-KEM-768");
    assert.equal(keypair.level, "ML-KEM-768");
    assert.equal(keypair.nistSecurityCategory, 3);
    assert.ok(keypair.publicKeyHex.length > 0);
    assert.ok(keypair.privateKeyHex.length > 0);

    // 2. Encapsulate
    const enc = EosPostQuantumCryptography.encapsulateMlKem(keypair.publicKeyHex, "ML-KEM-768");
    assert.ok(enc.ciphertextHex.length > 0);
    assert.equal(enc.sharedSecretHex.length, 64); // 256 bits
    assert.equal(enc.sha256Receipt.length, 64);

    // 3. Decapsulate
    const dec = EosPostQuantumCryptography.decapsulateMlKem(enc.ciphertextHex, keypair.privateKeyHex);
    assert.equal(dec.sharedSecretHex.length, 64);

    // 4. Invariant: shared secret matches exactly
    assert.equal(dec.sharedSecretHex, enc.sharedSecretHex);
  });

  it("BDD-1015: Hybrid Post-Quantum Key Exchange (X25519 + ML-KEM)", () => {
    // 1. Generate hybrid keypair
    const bob = EosPostQuantumCryptography.generateHybridKemKeyPair();
    assert.equal(bob.nistSecurityCategory, 3);
    assert.ok(bob.publicKey.x25519PublicKeyPem.includes("BEGIN PUBLIC KEY"));
    assert.ok(bob.publicKey.mlKemPublicKeyHex.length > 0);

    // 2. Alice encapsulates under Bob's hybrid public key
    const aliceEnc = EosPostQuantumCryptography.encapsulateHybridKem(bob.publicKey);
    assert.ok(aliceEnc.ciphertext.ephemeralX25519PublicKeyPem.includes("BEGIN PUBLIC KEY"));
    assert.ok(aliceEnc.ciphertext.mlKemCiphertextHex.length > 0);
    assert.equal(aliceEnc.sharedSecretHex.length, 64);
    assert.equal(aliceEnc.sha256Receipt.length, 64);

    // 3. Bob decapsulates using his hybrid private key
    const bobDec = EosPostQuantumCryptography.decapsulateHybridKem(aliceEnc.ciphertext, bob.privateKey);

    // 4. Invariant: hybrid shared secret matches exactly
    assert.equal(bobDec.sharedSecretHex, aliceEnc.sharedSecretHex);
  });

  it("BDD-1016: Constant-time implicit rejection on tampered ciphertext", () => {
    const keypair = EosPostQuantumCryptography.generateMlKemKeyPair("ML-KEM-768");
    const enc = EosPostQuantumCryptography.encapsulateMlKem(keypair.publicKeyHex);

    // Tamper with first byte of ciphertext
    const ctBytes = Buffer.from(enc.ciphertextHex, "hex");
    ctBytes[0] = ctBytes[0] ^ 0xff;
    const tamperedCtHex = ctBytes.toString("hex");

    // Decapsulate tampered ciphertext
    const decTampered = EosPostQuantumCryptography.decapsulateMlKem(tamperedCtHex, keypair.privateKeyHex);

    // Invariant: Implicit rejection returns valid 256-bit secret that does NOT match original
    assert.equal(decTampered.sharedSecretHex.length, 64);
    assert.notEqual(decTampered.sharedSecretHex, enc.sharedSecretHex);
  });

  it("BDD-1017: ML-DSA lattice digital signatures and verification", () => {
    const keypair = EosPostQuantumCryptography.generateMlDsaKeyPair();
    assert.equal(keypair.nistSecurityCategory, 3);

    const message = "GLORIAN_SOVEREIGN_CRITICAL_PAYLOAD_V69";
    const sigResult = EosPostQuantumCryptography.signMlDsa(message, keypair.signingKeyHex);

    assert.equal(sigResult.algorithm, "ML-DSA-65");
    assert.ok(sigResult.signatureHex.length > 0);
    assert.equal(sigResult.sha256Receipt.length, 64);

    // Verify valid message
    const isValid = EosPostQuantumCryptography.verifyMlDsa(message, sigResult.signatureHex, keypair.verificationKeyHex);
    assert.equal(isValid, true);

    // Reject tampered message
    const isTamperedValid = EosPostQuantumCryptography.verifyMlDsa(
      message + "_MUTATED",
      sigResult.signatureHex,
      keypair.verificationKeyHex,
    );
    assert.equal(isTamperedValid, false);
  });

  it("BDD-1018: Hybrid digital signatures and CLI invocation", () => {
    // 1. Hybrid signatures (Ed25519 + ML-DSA)
    const edKeys = EosSlsaSupplyChainAttestation.generateEd25519KeyPair();
    const mlDsaKeys = EosPostQuantumCryptography.generateMlDsaKeyPair();

    const message = "HYBRID_QUANTUM_RESISTANT_CONTRACT_TRANSACTION";
    const hybridSig = EosPostQuantumCryptography.signHybrid(message, {
      ed25519PrivateKeyPem: edKeys.privateKeyPem,
      mlDsaSigningKeyHex: mlDsaKeys.signingKeyHex,
    });

    assert.equal(hybridSig.algorithm, "HYBRID-ED25519-ML-DSA");
    assert.ok(hybridSig.ed25519SignatureB64.length > 0);
    assert.ok(hybridSig.mlDsaSignatureHex.length > 0);

    const verified = EosPostQuantumCryptography.verifyHybrid(message, hybridSig, {
      ed25519PublicKeyPem: edKeys.publicKeyPem,
      mlDsaVerificationKeyHex: mlDsaKeys.verificationKeyHex,
    });
    assert.equal(verified, true);

    // 2. CLI Invocation: glorian pq:kem --hybrid --json
    const rawKemOutput = execFileSync(process.execPath, ["bin/eos.mjs", "pq:kem", "--hybrid", "--json"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const kemParsed = JSON.parse(rawKemOutput.trim());
    assert.equal(kemParsed.verified, true);
    assert.equal(kemParsed.mode, "HYBRID (X25519 + ML-KEM-768)");
    assert.equal(kemParsed.sharedSecretHex.length, 64);

    // 3. CLI Invocation: glorian pq:sign --hybrid --json
    const rawSignOutput = execFileSync(
      process.execPath,
      ["bin/eos.mjs", "pq:sign", "TEST_MESSAGE", "--hybrid", "--json"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    const signParsed = JSON.parse(rawSignOutput.trim());
    assert.equal(signParsed.verified, true);
    assert.equal(signParsed.algorithm, "HYBRID-ED25519-ML-DSA");
  });
});
