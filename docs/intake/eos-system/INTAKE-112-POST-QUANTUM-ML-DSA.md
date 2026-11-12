# INTAKE-112: Layer-0 Post-Quantum Digital Signature Algorithm (NIST FIPS 204 ML-DSA-65 / Dilithium)

## 1. Context & Business Intent

- **Initiative**: Glorian System Sovereign Post-Quantum Cryptography Suite Completion.
- **Problem Statement**:
  While Glorian System features NIST FIPS 203 (ML-KEM-768, SPEC-221) for Post-Quantum Key Encapsulation, it lacks a dedicated, standalone, Layer-0 Pure TypeScript implementation of the finalized NIST FIPS 204: Module-Lattice Digital Signature Algorithm (ML-DSA-65 / Dilithium-65). Classical signature algorithms (Ed25519, ECDSA, RSA) will be completely broken by Shor's algorithm on quantum computers. To achieve true quantum-resilient sovereignty across Glorian and the 9 fleet satellite repositories, a dedicated, zero-dependency, constant-time lattice digital signature engine is mandatory.
- **Target Standard**: NIST FIPS 204 (August 2024 final standard), Security Category 3 (ML-DSA-65, AES-192 equivalent security).
- **Constitutional Guardrails**:
  - Law I (Zero Vibe Coding): Strict adherence to EARS requirements and Gherkin BDD scenarios.
  - Law II (Strict Gate): No implementation before approval and Level 3 authorization.
  - Law V (Architectural Purity): Pure Layer-0 Node.js 24 without external npm runtime dependencies (`dependencies: {}`).
  - Law VI (Absolute Security): Constant-time rejection sampling and Fiat-Shamir with Aborts to prevent side-channel timing leaks.

## 2. Technical Scope

- Standalone module `src/core/eosPostQuantumMlDsaCore.ts` and types in `eosPostQuantumMlDsaCore.types.ts`.
- Polynomial ring $R_q = \mathbb{Z}_q[X] / (X^{256} + 1)$ with $q = 8380417 = 2^{23} - 2^{13} + 1$.
- Matrix $A \in R_q^{6 \times 5}$ expanded via SHAKE-128 rejection sampling from seed $\rho$.
- Centered uniform noise vectors $s_1 \in R_q^5, s_2 \in R_q^6$ sampled with bound $\eta = 4$.
- High-bits / low-bits decomposition: `Power2Round`, `Decompose`, `HighBits`, `LowBits`, `MakeHint`, `UseHint`.
- `ML-DSA.KeyGen`, `ML-DSA.Sign`, and `ML-DSA.Verify` implementations.
- Hybrid signature support: Dual Ed25519 + ML-DSA-65 composite signatures.
- CLI subcommands: `ml-dsa:keygen`, `ml-dsa:sign`, `ml-dsa:verify`, `ml-dsa:benchmark`.
- MCP actions registered: `ml_dsa_keygen`, `ml_dsa_sign`, `ml_dsa_verify`.
- Monotonic SQLite WAL ledger attestation receipts with SHA-256 digests.
