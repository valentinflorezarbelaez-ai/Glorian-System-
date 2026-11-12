# CHANGE-106: Layer-0 Post-Quantum Cryptography Core (NIST FIPS 203 ML-KEM / Kyber-768)

## 1. Metadata

- **Change ID**: `CHANGE-106`
- **Specification ID**: `SPEC-221`
- **Title**: Layer-0 Post-Quantum Key Encapsulation Mechanism (NIST FIPS 203 ML-KEM / Kyber-768) Core
- **Status**: `PROPOSED` -> `APPROVED`
- **Author**: Glorian Control Plane Team & Valentín Flórez Arbeláez
- **Date**: 2026-11-11
- **Target Subsystem**: `src/core/eosPostQuantumMlKemCore.ts`
- **Constitutional Compliance**: Seven Inviolable Laws of EOS (Law I: Zero external runtime dependencies, Law II: Node 24 strip-only TS, Law III: Contract-driven DbC, Law IV: Monotonic Ledger receipt).

## 2. Context & Problem Statement

Modern sovereign control planes rely on classical public-key cryptography (Diffie-Hellman, ECDH, RSA) for session key exchange and fleet coordination. The rapid emergence of fault-tolerant quantum computers running Shor's algorithm renders discrete-logarithm and elliptic curve hardness assumptions obsolete.

To future-proof the Glorian sovereign control plane and all 9 federated fleet nodes against "harvest-now, decrypt-later" adversarial attacks, Glorian requires an immutable, zero-dependency, constant-time implementation of the finalized **NIST FIPS 203 Module-Lattice-Based Key-Encapsulation Mechanism Standard (ML-KEM / Kyber-768)**.

## 3. Scope of Changes

1. **Core Mathematical Domain**:
   - Polynomial ring arithmetic over $R_q = \mathbb{Z}_q[X] / (X^{256} + 1)$ with modulus $q = 3329$.
   - Forward and Inverse Number Theoretic Transform (NTT / INTT) utilizing primitive 256th roots of unity ($\zeta = 17$).
   - Barrett and Montgomery modular reduction.
   - Deterministic rejection sampling from SHAKE-128 for matrix $A \in R_q^{k \times k}$ generation ($k=3$ for ML-KEM-768).
   - Centered Binomial Distribution (CBD) sampling with $\eta_1 = 2, \eta_2 = 2$.
   - Byte encoding and decoding for polynomials and vectors ($d_u = 10, d_v = 4$).
2. **K-PKE & IND-CCA2 ML-KEM Protocols**:
   - `K-PKE.KeyGen`, `K-PKE.Encrypt`, `K-PKE.Decrypt`.
   - `ML-KEM.KeyGen`: Generates 1184-byte encapsulation key ($ek$) and 2400-byte decapsulation key ($dk$).
   - `ML-KEM.Encaps`: Generates 32-byte shared secret ($K$) and 1088-byte ciphertext ($c$).
   - `ML-KEM.Decaps`: Decapsulates $K$ from $c$ with Fujisaki-Okamoto transform and constant-time implicit rejection upon forged or tampered ciphertexts.
3. **Integration & Ergonomics**:
   - Frontier CLI commands: `ml-kem:keygen`, `ml-kem:encaps`, `ml-kem:decaps`, `ml-kem:benchmark`.
   - MCP actions: `ml_kem_keygen`, `ml_kem_encaps`, `ml_kem_decaps`.
   - Subpath export in `package.json` (`./pqc` and `./ml-kem`).
   - SQLite WAL Monotonic Ledger integration with SHA-256 receipts.
