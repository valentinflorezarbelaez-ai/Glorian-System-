# INTAKE-084: Post-Quantum Cryptographic Key Encapsulation & Lattice Signatures (NIST FIPS 203/204)

- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Principal Architect & Owner)
- **Lifecycle Tier**: Core / Security & Cryptography
- **Context**: Sovereign, Defense, Space & Hyperscale Zero-Trust Environments

---

## 1. Problem Statement

With the emergence of cryptanalytically relevant quantum computers (CRQCs) capable of executing Shor's algorithm, all classical public-key cryptography (RSA, ECDH, ECDSA, Ed25519) will become obsolete. Adversaries are actively performing "Harvest Now, Decrypt Later" (HNDL) attacks against sovereign communications, codebases, and inter-agent topologies.

Glorian requires an immediate, production-grade, zero-dependency implementation of NIST FIPS 203 (ML-KEM) and NIST FIPS 204 (ML-DSA) with hybrid post-quantum key exchange (X25519 + ML-KEM) and dual hybrid signatures (Ed25519 + ML-DSA).

---

## 2. Requirements and Scope

1. **ML-KEM Key Encapsulation (FIPS 203)**:
   - Polynomial ring $R_q = \mathbb{Z}_q[X]/(X^{256} + 1)$ with $q = 3329$.
   - Constant-time Number Theoretic Transform (NTT) arithmetic.
   - Encapsulation generating 256-bit shared secret $ss$ and ciphertext $ct$.
   - Decapsulation with Fujisaki-Okamoto transform and implicit rejection.
2. **Hybrid Key Exchange**:
   - Dual encapsulation binding classical Curve25519 (ECDH) and ML-KEM shared secrets via HKDF-SHA256.
3. **ML-DSA Signatures (FIPS 204)**:
   - Module lattice digital signatures with rejection sampling.
   - Dual hybrid signatures combining Ed25519 with ML-DSA.
4. **Architectural Compliance**:
   - Strictly ZERO external runtime dependencies (`dependencies: {}`).
   - Constant-time comparison to prevent timing side-channels.
   - CLI commands `glorian pq:kem`, `glorian pq:sign`, `glorian pq:verify`.
   - MCP actions `pq_kem`, `pq_verify`.
