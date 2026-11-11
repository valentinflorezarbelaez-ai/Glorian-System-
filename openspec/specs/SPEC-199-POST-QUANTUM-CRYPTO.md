# SPEC-199: Post-Quantum Cryptographic Key Encapsulation & Lattice Signatures (NIST FIPS 203/204)

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Core / Security & Cryptography
- **Standard**: NIST FIPS 203 (ML-KEM) / NIST FIPS 204 (ML-DSA) / NSA CNSA 2.0 / IETF Hybrid KEM
- **Module**: `src/core/eosPostQuantumCryptography.ts`

---

## 1. Context and Rationale

The impending arrival of Cryptanalytically Relevant Quantum Computers (CRQCs) threatens the fundamental security assumptions of modern public-key cryptography. To guarantee forward secrecy and tamper-evident authenticity across sovereign clouds, satellite nodes, and inter-agent topologies, Glorian incorporates post-quantum module-lattice cryptography.

`EosPostQuantumCryptography` implements NIST FIPS 203 (ML-KEM) and NIST FIPS 204 (ML-DSA) alongside hybrid classical-quantum modes (X25519 + ML-KEM and Ed25519 + ML-DSA) with zero runtime dependencies.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-1014 (Ubiquitous - ML-KEM Key Encapsulation)**: `THE SYSTEM SHALL generate public/private keypairs, encapsulate 256-bit symmetric shared secrets into ciphertexts, and decapsulate ciphertexts into identical shared secrets over polynomial ring R_q with q = 3329.`

- **FR-1015 (Ubiquitous - Hybrid Post-Quantum Key Exchange)**: `THE SYSTEM SHALL combine classical X25519 elliptic-curve Diffie-Hellman with ML-KEM lattice encapsulation via HKDF-SHA256, guaranteeing confidentiality if either primitive holds.`

- **FR-1016 (Unwanted - Implicit Rejection on Tampering)**: `IF an encapsulated ciphertext is tampered with or modified, THEN decapsulateMlKem SHALL implicitly reject the ciphertext by returning a pseudorandom shared secret distinct from the original without timing side-channels.`

- **FR-1017 (Ubiquitous - ML-DSA Lattice Digital Signatures)**: `THE SYSTEM SHALL generate module-lattice digital signature keypairs, sign messages, and verify signatures with zero external dependencies.`

- **FR-1018 (Ubiquitous - Hybrid Signatures and Receipts)**: `THE SYSTEM SHALL provide dual Ed25519 + ML-DSA signatures and emit tamper-evident SHA-256 cryptographic receipts including NIST security categories (Levels 1, 3, 5).`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-1014 ML-KEM Keypair Generation, Encapsulation, and Decapsulation
  GIVEN an ML-KEM keypair (ek, dk)
  WHEN encapsulateMlKem is executed with the public key
  THEN a 256-bit shared secret and ciphertext are produced
  AND decapsulateMlKem with the private key recovers the identical shared secret

SCENARIO: BDD-1015 Hybrid Post-Quantum Key Exchange (X25519 + ML-KEM)
  GIVEN a hybrid keypair comprising X25519 and ML-KEM keys
  WHEN encapsulateHybridKem is executed
  THEN a dual-bound shared secret is derived via HKDF-SHA256
  AND decapsulateHybridKem produces the exact matching dual shared secret

SCENARIO: BDD-1016 Constant-Time Implicit Rejection on Tampered Ciphertext
  GIVEN an encapsulated ML-KEM ciphertext
  WHEN any byte of the ciphertext is flipped or mutated
  THEN decapsulateMlKem rejects the pre-image and returns a mismatched pseudorandom secret
  AND no exception leaks error status or timing differentials

SCENARIO: BDD-1017 ML-DSA Lattice Digital Signatures
  GIVEN an ML-DSA signing keypair
  WHEN signMlDsa is invoked on an arbitrary message buffer
  THEN a valid lattice signature is generated
  AND verifyMlDsa returns true for the original message and false for tampered messages

SCENARIO: BDD-1018 CLI Invocation and Cryptographic Receipt
  GIVEN the Glorian CLI
  WHEN glorian pq:kem --hybrid --json is executed
  THEN a valid JSON report containing public keys, ciphertext, sharedSecretHex, and sha256Receipt is emitted
```

---

## 4. Architectural Invariants

1. **Law I (Zero Vibe Coding)**: Lattice polynomial operations strictly follow standard ring arithmetic and deterministic NTT transform.
2. **Law V (Zero Runtime Dependencies)**: Pure TypeScript using `node:crypto` and standard built-ins.
3. **Law VII (Constant-Time Operations)**: Constant-time buffer comparisons (`crypto.timingSafeEqual`) avoid side-channel information leakage.
