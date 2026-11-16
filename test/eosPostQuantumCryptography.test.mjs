/**
 * EOS SYSTEM — POST-QUANTUM CRYPTOGRAPHY TESTS
 * Tests for ML-KEM key generation, encapsulate/decapsulate,
 * ML-DSA sign/verify, hybrid KEM, hybrid signatures
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { EosPostQuantumCryptography } from "../src/core/eosPostQuantumCryptography.ts";

// ============================================================================
// ML-KEM Key Generation
// ============================================================================

test("generateMlKemKeyPair ML-KEM-512 returns correct level", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair("ML-KEM-512");
  assert.equal(kp.level, "ML-KEM-512");
});

test("generateMlKemKeyPair ML-KEM-768 returns correct level", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair("ML-KEM-768");
  assert.equal(kp.level, "ML-KEM-768");
});

test("generateMlKemKeyPair ML-KEM-1024 returns correct level", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair("ML-KEM-1024");
  assert.equal(kp.level, "ML-KEM-1024");
});

test("generateMlKemKeyPair defaults to ML-KEM-768", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  assert.equal(kp.level, "ML-KEM-768");
});

test("generateMlKemKeyPair nistSecurityCategory ML-KEM-512 = 1", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair("ML-KEM-512");
  assert.equal(kp.nistSecurityCategory, 1);
});

test("generateMlKemKeyPair nistSecurityCategory ML-KEM-768 = 3", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair("ML-KEM-768");
  assert.equal(kp.nistSecurityCategory, 3);
});

test("generateMlKemKeyPair nistSecurityCategory ML-KEM-1024 = 5", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair("ML-KEM-1024");
  assert.equal(kp.nistSecurityCategory, 5);
});

test("generateMlKemKeyPair publicKeyHex is valid hex", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  assert.match(kp.publicKeyHex, /^[0-9a-f]+$/);
});

test("generateMlKemKeyPair privateKeyHex is valid hex", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  assert.match(kp.privateKeyHex, /^[0-9a-f]+$/);
});

test("generateMlKemKeyPair privateKey is longer than publicKey", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  assert.ok(kp.privateKeyHex.length > kp.publicKeyHex.length);
});

test("generateMlKemKeyPair returns frozen object", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  assert.ok(Object.isFrozen(kp));
});

test("generateMlKemKeyPair publicKeyHex length is correct", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  // t (384 bytes) + rho (32 bytes) = 416 bytes = 832 hex chars
  assert.equal(kp.publicKeyHex.length, 832);
});

// ============================================================================
// ML-KEM Encapsulate
// ============================================================================

test("encapsulateMlKem returns ciphertextHex", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  const result = EosPostQuantumCryptography.encapsulateMlKem(kp.publicKeyHex);
  assert.ok(result.ciphertextHex.length > 0);
  assert.match(result.ciphertextHex, /^[0-9a-f]+$/);
});

test("encapsulateMlKem returns sharedSecretHex 64 chars", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  const result = EosPostQuantumCryptography.encapsulateMlKem(kp.publicKeyHex);
  assert.equal(result.sharedSecretHex.length, 64);
});

test("encapsulateMlKem returns sha256Receipt", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  const result = EosPostQuantumCryptography.encapsulateMlKem(kp.publicKeyHex);
  assert.equal(result.sha256Receipt.length, 64);
});

test("encapsulateMlKem returns correct level", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair("ML-KEM-512");
  const result = EosPostQuantumCryptography.encapsulateMlKem(kp.publicKeyHex, "ML-KEM-512");
  assert.equal(result.level, "ML-KEM-512");
});

test("encapsulateMlKem returns frozen object", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  const result = EosPostQuantumCryptography.encapsulateMlKem(kp.publicKeyHex);
  assert.ok(Object.isFrozen(result));
});

test("encapsulateMlKem throws on invalid publicKeyHex", () => {
  assert.throws(
    () => {
      EosPostQuantumCryptography.encapsulateMlKem("invalid");
    },
    { message: /Invalid ML-KEM public key length/ },
  );
});

// ============================================================================
// ML-KEM Decapsulate
// ============================================================================

test("decapsulateMlKem returns sharedSecretHex", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  const enc = EosPostQuantumCryptography.encapsulateMlKem(kp.publicKeyHex);
  const dec = EosPostQuantumCryptography.decapsulateMlKem(enc.ciphertextHex, kp.privateKeyHex);
  assert.ok(dec.sharedSecretHex.length > 0);
});

test("decapsulateMlKem returns frozen object", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  const enc = EosPostQuantumCryptography.encapsulateMlKem(kp.publicKeyHex);
  const dec = EosPostQuantumCryptography.decapsulateMlKem(enc.ciphertextHex, kp.privateKeyHex);
  assert.ok(Object.isFrozen(dec));
});

// ============================================================================
// Hybrid KEM Key Generation
// ============================================================================

test("generateHybridKemKeyPair returns x25519 PEM keys", () => {
  const kp = EosPostQuantumCryptography.generateHybridKemKeyPair();
  assert.ok(kp.publicKey.x25519PublicKeyPem.includes("BEGIN"));
  assert.ok(kp.privateKey.x25519PrivateKeyPem.includes("BEGIN"));
});

test("generateHybridKemKeyPair returns ML-KEM hex keys", () => {
  const kp = EosPostQuantumCryptography.generateHybridKemKeyPair();
  assert.match(kp.publicKey.mlKemPublicKeyHex, /^[0-9a-f]+$/);
  assert.match(kp.privateKey.mlKemPrivateKeyHex, /^[0-9a-f]+$/);
});

test("generateHybridKemKeyPair nistSecurityCategory = 3", () => {
  const kp = EosPostQuantumCryptography.generateHybridKemKeyPair();
  assert.equal(kp.nistSecurityCategory, 3);
});

test("generateHybridKemKeyPair returns frozen object", () => {
  const kp = EosPostQuantumCryptography.generateHybridKemKeyPair();
  assert.ok(Object.isFrozen(kp));
});

// ============================================================================
// Hybrid KEM Encapsulate & Decapsulate
// ============================================================================

test("encapsulateHybridKem returns ciphertext structure", () => {
  const kp = EosPostQuantumCryptography.generateHybridKemKeyPair();
  const result = EosPostQuantumCryptography.encapsulateHybridKem(kp.publicKey);
  assert.ok(result.ciphertext.ephemeralX25519PublicKeyPem.includes("BEGIN"));
  assert.ok(result.ciphertext.mlKemCiphertextHex.length > 0);
  assert.ok(result.ciphertext.saltHex.length > 0);
});

test("encapsulateHybridKem returns sharedSecretHex", () => {
  const kp = EosPostQuantumCryptography.generateHybridKemKeyPair();
  const result = EosPostQuantumCryptography.encapsulateHybridKem(kp.publicKey);
  assert.ok(result.sharedSecretHex.length > 0);
});

test("encapsulateHybridKem returns sha256Receipt", () => {
  const kp = EosPostQuantumCryptography.generateHybridKemKeyPair();
  const result = EosPostQuantumCryptography.encapsulateHybridKem(kp.publicKey);
  assert.equal(result.sha256Receipt.length, 64);
});

test("encapsulateHybridKem returns frozen object", () => {
  const kp = EosPostQuantumCryptography.generateHybridKemKeyPair();
  const result = EosPostQuantumCryptography.encapsulateHybridKem(kp.publicKey);
  assert.ok(Object.isFrozen(result));
});

test("decapsulateHybridKem round-trip matches shared secret", () => {
  const kp = EosPostQuantumCryptography.generateHybridKemKeyPair();
  const enc = EosPostQuantumCryptography.encapsulateHybridKem(kp.publicKey);
  const dec = EosPostQuantumCryptography.decapsulateHybridKem(enc.ciphertext, kp.privateKey);
  assert.equal(enc.sharedSecretHex, dec.sharedSecretHex);
});

test("decapsulateHybridKem returns frozen object", () => {
  const kp = EosPostQuantumCryptography.generateHybridKemKeyPair();
  const enc = EosPostQuantumCryptography.encapsulateHybridKem(kp.publicKey);
  const dec = EosPostQuantumCryptography.decapsulateHybridKem(enc.ciphertext, kp.privateKey);
  assert.ok(Object.isFrozen(dec));
});

// ============================================================================
// ML-DSA Key Generation
// ============================================================================

test("generateMlDsaKeyPair returns verificationKeyHex", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  assert.match(kp.verificationKeyHex, /^[0-9a-f]+$/);
});

test("generateMlDsaKeyPair returns signingKeyHex", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  assert.match(kp.signingKeyHex, /^[0-9a-f]+$/);
});

test("generateMlDsaKeyPair nistSecurityCategory = 3", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  assert.equal(kp.nistSecurityCategory, 3);
});

test("generateMlDsaKeyPair signingKey is longer than verificationKey", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  assert.ok(kp.signingKeyHex.length > kp.verificationKeyHex.length);
});

test("generateMlDsaKeyPair returns frozen object", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  assert.ok(Object.isFrozen(kp));
});

// ============================================================================
// ML-DSA Sign
// ============================================================================

test("signMlDsa with string message", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const result = EosPostQuantumCryptography.signMlDsa("hello world", kp.signingKeyHex);
  assert.ok(result.signatureHex.length > 0);
  assert.equal(result.algorithm, "ML-DSA-65");
});

test("signMlDsa with Buffer message", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const result = EosPostQuantumCryptography.signMlDsa(Buffer.from("hello"), kp.signingKeyHex);
  assert.ok(result.signatureHex.length > 0);
});

test("signMlDsa returns sha256Receipt", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const result = EosPostQuantumCryptography.signMlDsa("test", kp.signingKeyHex);
  assert.equal(result.sha256Receipt.length, 64);
});

test("signMlDsa returns frozen object", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const result = EosPostQuantumCryptography.signMlDsa("test", kp.signingKeyHex);
  assert.ok(Object.isFrozen(result));
});

// ============================================================================
// ML-DSA Verify
// ============================================================================

test("verifyMlDsa valid signature returns true", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const sig = EosPostQuantumCryptography.signMlDsa("message", kp.signingKeyHex);
  const valid = EosPostQuantumCryptography.verifyMlDsa("message", sig.signatureHex, kp.verificationKeyHex);
  assert.equal(valid, true);
});

test("verifyMlDsa wrong message returns false", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const sig = EosPostQuantumCryptography.signMlDsa("message", kp.signingKeyHex);
  const valid = EosPostQuantumCryptography.verifyMlDsa("tampered", sig.signatureHex, kp.verificationKeyHex);
  assert.equal(valid, false);
});

test("verifyMlDsa wrong key returns false", () => {
  const kp1 = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const kp2 = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const sig = EosPostQuantumCryptography.signMlDsa("message", kp1.signingKeyHex);
  const valid = EosPostQuantumCryptography.verifyMlDsa("message", sig.signatureHex, kp2.verificationKeyHex);
  assert.equal(valid, false);
});

test("verifyMlDsa with Buffer message", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const msg = Buffer.from("buffer message");
  const sig = EosPostQuantumCryptography.signMlDsa(msg, kp.signingKeyHex);
  const valid = EosPostQuantumCryptography.verifyMlDsa(msg, sig.signatureHex, kp.verificationKeyHex);
  assert.equal(valid, true);
});

test("verifyMlDsa invalid signature hex returns false", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const valid = EosPostQuantumCryptography.verifyMlDsa("message", "invalid", kp.verificationKeyHex);
  assert.equal(valid, false);
});

// ============================================================================
// Hybrid Signatures
// ============================================================================

test("signHybrid returns correct algorithm", () => {
  const edKp = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const mlDsaKp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const privateKeys = {
    ed25519PrivateKeyPem: edKp.privateKey,
    mlDsaSigningKeyHex: mlDsaKp.signingKeyHex,
  };
  const result = EosPostQuantumCryptography.signHybrid("test message", privateKeys);
  assert.equal(result.algorithm, "HYBRID-ED25519-ML-DSA");
});

test("signHybrid returns ed25519 signature", () => {
  const edKp = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const mlDsaKp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const privateKeys = {
    ed25519PrivateKeyPem: edKp.privateKey,
    mlDsaSigningKeyHex: mlDsaKp.signingKeyHex,
  };
  const result = EosPostQuantumCryptography.signHybrid("test", privateKeys);
  assert.ok(result.ed25519SignatureB64.length > 0);
});

test("signHybrid returns mlDsa signature", () => {
  const edKp = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const mlDsaKp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const privateKeys = {
    ed25519PrivateKeyPem: edKp.privateKey,
    mlDsaSigningKeyHex: mlDsaKp.signingKeyHex,
  };
  const result = EosPostQuantumCryptography.signHybrid("test", privateKeys);
  assert.ok(result.mlDsaSignatureHex.length > 0);
});

test("signHybrid returns sha256Receipt", () => {
  const edKp = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const mlDsaKp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const privateKeys = {
    ed25519PrivateKeyPem: edKp.privateKey,
    mlDsaSigningKeyHex: mlDsaKp.signingKeyHex,
  };
  const result = EosPostQuantumCryptography.signHybrid("test", privateKeys);
  assert.equal(result.sha256Receipt.length, 64);
});

test("signHybrid returns frozen object", () => {
  const edKp = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const mlDsaKp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const privateKeys = {
    ed25519PrivateKeyPem: edKp.privateKey,
    mlDsaSigningKeyHex: mlDsaKp.signingKeyHex,
  };
  const result = EosPostQuantumCryptography.signHybrid("test", privateKeys);
  assert.ok(Object.isFrozen(result));
});

test("verifyHybrid valid signature returns true", () => {
  const edKp = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const mlDsaKp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const privateKeys = {
    ed25519PrivateKeyPem: edKp.privateKey,
    mlDsaSigningKeyHex: mlDsaKp.signingKeyHex,
  };
  const publicKeys = {
    ed25519PublicKeyPem: edKp.publicKey,
    mlDsaVerificationKeyHex: mlDsaKp.verificationKeyHex,
  };
  const sig = EosPostQuantumCryptography.signHybrid("message", privateKeys);
  const valid = EosPostQuantumCryptography.verifyHybrid("message", sig, publicKeys);
  assert.equal(valid, true);
});

test("verifyHybrid tampered message returns false", () => {
  const edKp = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const mlDsaKp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const privateKeys = {
    ed25519PrivateKeyPem: edKp.privateKey,
    mlDsaSigningKeyHex: mlDsaKp.signingKeyHex,
  };
  const publicKeys = {
    ed25519PublicKeyPem: edKp.publicKey,
    mlDsaVerificationKeyHex: mlDsaKp.verificationKeyHex,
  };
  const sig = EosPostQuantumCryptography.signHybrid("message", privateKeys);
  const valid = EosPostQuantumCryptography.verifyHybrid("tampered", sig, publicKeys);
  assert.equal(valid, false);
});

// ============================================================================
// ML-KEM different levels produce different key sizes
// ============================================================================

test("ML-KEM key pairs are unique per generation", () => {
  const kp1 = EosPostQuantumCryptography.generateMlKemKeyPair();
  const kp2 = EosPostQuantumCryptography.generateMlKemKeyPair();
  assert.notEqual(kp1.publicKeyHex, kp2.publicKeyHex);
  assert.notEqual(kp1.privateKeyHex, kp2.privateKeyHex);
});

// ============================================================================
// ML-DSA different signatures per message
// ============================================================================

test("ML-DSA different messages produce different signatures", () => {
  const kp = EosPostQuantumCryptography.generateMlDsaKeyPair();
  const sig1 = EosPostQuantumCryptography.signMlDsa("msg1", kp.signingKeyHex);
  const sig2 = EosPostQuantumCryptography.signMlDsa("msg2", kp.signingKeyHex);
  assert.notEqual(sig1.signatureHex, sig2.signatureHex);
});

// ============================================================================
// Encapsulate produces different ciphertexts
// ============================================================================

test("encapsulateMlKem produces different ciphertexts", () => {
  const kp = EosPostQuantumCryptography.generateMlKemKeyPair();
  const enc1 = EosPostQuantumCryptography.encapsulateMlKem(kp.publicKeyHex);
  const enc2 = EosPostQuantumCryptography.encapsulateMlKem(kp.publicKeyHex);
  assert.notEqual(enc1.ciphertextHex, enc2.ciphertextHex);
});
