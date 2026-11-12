# SPEC-221: Layer-0 Post-Quantum Key Encapsulation Mechanism (NIST FIPS 203 ML-KEM / Kyber-768)

## 1. Specification Metadata

- **Specification ID**: `SPEC-221`
- **Change ID**: `CHANGE-106`
- **Title**: Layer-0 Post-Quantum Key Encapsulation Mechanism (NIST FIPS 203 ML-KEM / Kyber-768) Core
- **Status**: `APPROVED`
- **Target Subsystem**: `src/core/eosPostQuantumMlKemCore.ts`
- **Related Specs**: `SPEC-057` (Samael Nexus), `SPEC-086` (SecDevOps Guard), `SPEC-211` (Homomorphic Lattice Core), `SPEC-219` (FROST Signatures)

## 2. Mathematical Foundation & Parameters (NIST FIPS 203)

ML-KEM is based on the hardness of the Module Learning with Errors (M-LWE) problem in module polynomial rings.

- **Polynomial Ring**: $R_q = \mathbb{Z}_q[X] / (X^{256} + 1)$ with prime modulus $q = 3329$.
- **NTT Parameters**: Primitive 256th root of unity $\zeta = 17$ such that $\zeta^{128} \equiv -1 \equiv 3328 \pmod{3329}$.
- **ML-KEM-768 Parameter Set (Security Category 3 — AES-192 equivalent)**:
  - Ring dimension: $n = 256$.
  - Module rank: $k = 3$.
  - Binomial noise parameter $\eta_1 = 2$.
  - Binomial noise parameter $\eta_2 = 2$.
  - Compression exponent $d_u = 10$.
  - Compression exponent $d_v = 4$.
  - Public key size ($ek$): 1184 bytes.
  - Secret key size ($dk$): 2400 bytes.
  - Ciphertext size ($c$): 1088 bytes.
  - Shared secret key size ($K$): 32 bytes (256 bits).

## 3. Functional Requirements (IEEE 830 EARS)

### FR-1124: Deterministic NTT Domain Arithmetic and Polynomial Reduction

- **Requirement**: The system SHALL execute polynomial addition, subtraction, scalar multiplication, and NTT multiplication over $R_q$ with $q = 3329$ and $n = 256$, using Montgomery and Barrett reductions guaranteeing bounded coefficients in $[0, q-1]$.

### FR-1125: Keccak/SHA-3 Extensible Output Functions & Rejection Sampling

- **Requirement**: The system SHALL use built-in Keccak functions (`shake128`, `shake256`, `sha3-256`, `sha3-512`) to deterministically sample the public matrix $A \in R_q^{k \times k}$ from seed $\rho$ and sample Centered Binomial Distribution (CBD) error vectors $s, e$ from seed $\sigma$ with $\eta = 2$.

### FR-1126: IND-CPA Underlying Public-Key Encryption (`K-PKE`)

- **Requirement**: The system SHALL implement `K-PKE.KeyGen`, `K-PKE.Encrypt`, and `K-PKE.Decrypt` with byte compressions $d_u = 10$ and $d_v = 4$, correctly recovering the 32-byte message $m$ with failure probability $< 2^{-164}$.

### FR-1127: IND-CCA2 Fujisaki-Okamoto Transform with Constant-Time Implicit Rejection

- **Requirement**: The system SHALL implement `ML-KEM.Encaps` and `ML-KEM.Decaps`. If a ciphertext is modified, forged, or invalid, `ML-KEM.Decaps` SHALL NOT return an explicit error or leak secret timing; instead, it SHALL output a deterministic pseudo-random key $K \leftarrow \text{J}(z, c)$ derived from the secret key's rejection seed $z$, satisfying IND-CCA2 security.

### FR-1128: Frontier CLI, MCP Tools, and Monotonic Ledger Receipts

- **Requirement**: The system SHALL expose subcommands `ml-kem:keygen`, `ml-kem:encaps`, `ml-kem:decaps`, and `ml-kem:benchmark` via the universal CLI, register MCP actions `ml_kem_keygen`, `ml_kem_encaps`, `ml_kem_decaps`, and append an immutable SHA-256 execution receipt into the SQLite WAL Ledger.

## 4. Behavior-Driven Development Scenarios (Gherkin)

```gherkin
Feature: Layer-0 Post-Quantum Key Encapsulation Mechanism (NIST FIPS 203 ML-KEM-768)

  Scenario: BDD-1124 NTT Ring Arithmetic and Polynomial Multiplication
    Given the prime modulus q = 3329 and polynomial dimension n = 256
    When two polynomials a(x) and b(x) are transformed to NTT domain
    And multiplied pointwise and converted back via INTT
    Then the resulting polynomial matches classical ring polynomial multiplication modulo (x^256 + 1) and q = 3329.

  Scenario: BDD-1125 Matrix Generation and Centered Binomial Distribution Sampling
    Given a 32-byte uniform seed rho and noise seed sigma
    When generating the 3x3 polynomial matrix A via SHAKE-128 rejection sampling
    And sampling error vectors s and e via CBD with eta = 2
    Then all coefficients of s and e fall strictly within [-2, 2] modulo q
    And the generated matrix A is completely deterministic and reproducible.

  Scenario: BDD-1126 Honest Encapsulation and Decapsulation Round-Trip
    Given a freshly generated ML-KEM-768 keypair (ek, dk)
    When encapsulating a shared secret against the public key ek
    And decapsulating the ciphertext against the private key dk
    Then both parties obtain the exact identical 32-byte shared secret K.

  Scenario: BDD-1127 IND-CCA2 Active Attack and Implicit Rejection
    Given a valid ciphertext c corresponding to shared secret K
    When an adversary tampers with any single byte in the ciphertext c'
    And decapsulating c' against private key dk
    Then the returned shared secret K' does NOT match K
    And no error is thrown, executing constant-time implicit rejection.

  Scenario: BDD-1128 CLI, MCP Dispatch and Monotonic Ledger Receipt
    Given the Glorian CLI and MCP control plane
    When invoking ml-kem:keygen and ml-kem:encaps through CLI and MCP tools
    Then the command outputs valid JSON with 1184-byte ek, 1088-byte ciphertext, and 32-byte shared secret
    And an attested cryptographic receipt is appended to the SQLite WAL Ledger.
```

## 5. Architecture Decision Record (ADR-221)

- **Context**: Post-quantum migration is mandated by aerospace and defense standards. Classical ECDH (X25519) is vulnerable to quantum cryptanalysis.
- **Decision**: Implement the finalized NIST FIPS 203 ML-KEM-768 standard in pure Layer-0 TypeScript (Node 24 strip-only), with zero external dependencies.
- **Alternatives Discarded**:
  - _External npm packages (`kyber-crystals`, `pqc-kem`)_: Rejected due to violation of Law I (external dependencies) and risk of supply chain tampering.
  - _Native C / Rust N-API bindings_: Rejected due to platform portability barriers and security boundaries (violation of Law II).
  - _Classic McEliece_: Rejected due to massive public key size (~261 KB vs ML-KEM's compact 1.18 KB).
- **Consequences**: Provides sovereign quantum-resilient forward secrecy for Glorian and all 9 fleet satellite repositories.
