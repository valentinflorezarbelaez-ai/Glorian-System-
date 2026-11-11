# CHANGE-096: Layer-0 Lattice-Based Homomorphic Encryption Core

## 1. Problem Statement

Sovereign multi-agent topologies and confidential computing nodes in Glorian System require the ability to delegate mathematical computations (such as telemetry aggregation, score tallies, and linear transformations) to untrusted worker nodes without exposing sensitive plaintext values. External homomorphic encryption frameworks violate Law V (Zero External Dependencies) due to heavy native toolchain dependencies.

## 2. Proposed Solution

Implement `EosHomomorphicLatticeCore` (`src/core/eosHomomorphicLatticeCore.ts`), a pure Node 24 strip-only TypeScript RLWE/BFV-style somewhat homomorphic encryption engine over the polynomial quotient ring $R_q = \mathbb{Z}_q[X] / (X^N + 1)$. The engine provides:

- Negacyclic polynomial multiplication and addition modulo $(q, X^N + 1)$.
- Discrete bounded ternary error sampling using `node:crypto.randomBytes`.
- Public key generation, message encoding ($\Delta = \lfloor q / t \rfloor$), and blind encryption.
- Homomorphic ciphertext-ciphertext addition and subtraction.
- Homomorphic ciphertext-scalar multiplication and plaintext polynomial evaluation.
- Decryption phase calculation, residual noise budget estimation in bits, and SHA-256 receipts.

## 3. Impact Assessment

- **Scope**: Core cryptographic primitive under `src/core/eosHomomorphicLatticeCore.ts` and `src/core/eosHomomorphicLatticeCore.types.ts`.
- **Dependencies**: 0 external npm dependencies; only `node:crypto`.
- **Breaking Changes**: None. Purely additive Layer-0 capability.
- **Spec**: `SPEC-211-HOMOMORPHIC-LATTICE-CORE.md`.
