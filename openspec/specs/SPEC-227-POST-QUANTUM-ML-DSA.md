# SPEC-227: Layer-0 Post-Quantum Digital Signature Algorithm (NIST FIPS 204 ML-DSA-65)

## 1. Specification Metadata

- **Specification ID**: `SPEC-227`
- **Change ID**: `CHANGE-112`
- **Title**: Layer-0 Post-Quantum Digital Signature Algorithm (NIST FIPS 204 ML-DSA-65 / Dilithium) Core Engine
- **Status**: `APPROVED`
- **Target Subsystem**: `src/core/eosPostQuantumMlDsaCore.ts`
- **Related Specs**: `SPEC-221` (ML-KEM-768), `SPEC-219` (FROST Signatures), `SPEC-086` (SecDevOps Guard), `SPEC-057` (Samael Nexus)

## 2. Mathematical Foundation & Parameters (NIST FIPS 204)

ML-DSA is based on the hardness of the Module Learning with Errors (M-LWE) and Module Short Integer Solution (M-SIS) problems in polynomial rings over lattices, using the Fiat-Shamir with Aborts paradigm.

- **Polynomial Ring**: $R_q = \mathbb{Z}_q[X] / (X^{256} + 1)$ with prime modulus $q = 8380417 = 2^{23} - 2^{13} + 1$.
- **NTT Parameters**: Primitive 512th root of unity $\zeta = 1753$ such that $\zeta^{256} \equiv -1 \equiv 8380416 \pmod{8380417}$.
- **ML-DSA-65 Parameter Set (Security Category 3 — AES-192 equivalent)**:
  - Ring dimension: $n = 256$.
  - Matrix dimensions: $k = 6$ rows, $l = 5$ columns ($A \in R_q^{6 \times 5}$).
  - Secret vector noise bound: $\eta = 4$.
  - Mask polynomial bound: $\gamma_1 = 2^{19} = 524288$.
  - High-bits decomposition parameter: $\gamma_2 = (q - 1) / 32 = 261888$.
  - Challenge Hamming weight: $\tau = 49$.
  - Maximum hints: $\omega = 55$.
  - Verification bound: $\beta = \tau \cdot \eta = 196$.
  - Public key size ($pk$): 1952 bytes ($\rho$ seed 32 bytes + $t_1$ high-bits packed 1920 bytes).
  - Secret key size ($sk$): 4032 bytes ($\rho, K, \text{tr}$ seeds + $s_1, s_2, t_0$ vectors).
  - Signature size ($\sigma$): 3309 bytes ($\tilde{c}$ commitment hash 32 bytes + $z$ response vector + hint vector $h$).

## 3. Functional Requirements (IEEE 830 EARS)

### FR-1154: High-Bits / Low-Bits Decomposition and Ring Arithmetic ($q = 8380417$)

- **Requirement**: The system SHALL implement polynomial addition, subtraction, multiplication, and high/low-bits decomposition (`Power2Round`, `Decompose`, `HighBits`, `LowBits`) over $R_q$ with $q = 8380417$ and $n = 256$, ensuring deterministic coefficients bounded strictly within their canonical ranges.

### FR-1155: Deterministic Matrix Expansion and Bounded Noise Sampling

- **Requirement**: The system SHALL use SHAKE-128 and SHAKE-256 to deterministically expand the $6 \times 5$ polynomial matrix $A \in R_q^{6 \times 5}$ from a 32-byte uniform seed $\rho$, and sample secret vectors $s_1 \in R_q^5$ and $s_2 \in R_q^6$ with bounded coefficients in $[-\eta, \eta] = [-4, 4]$ via rejection sampling.

### FR-1156: Fiat-Shamir with Aborts Key Generation and Signing

- **Requirement**: The system SHALL implement `ML-DSA.KeyGen` and `ML-DSA.Sign` using deterministic pseudo-random sampling from an entropy seed $\xi$. During signing, if the response vector $z = y + c \cdot s_1$ or low-bits exceed safety margins ($\|z\|_\infty \ge \gamma_1 - \beta$ or $\|r_0\|_\infty \ge \gamma_2 - \beta$), the system SHALL abort and resample mask vector $y$ until a secure signature satisfying zero-knowledge bounds is produced.

### FR-1157: High-Throughput Verification and Hint Reconstruction

- **Requirement**: The system SHALL implement `ML-DSA.Verify` in constant space without dynamic heap allocations. Given public key $pk$, message $M$, and signature $\sigma = (\tilde{c}, z, h)$, the system SHALL reconstruct high-bits $w_1' = \text{UseHint}(h, A \cdot z - c \cdot t_1 \cdot 2^d)$, compute challenge $\tilde{c}' = H(\mu \| w_1')$, and assert $\tilde{c}' = \tilde{c}$ and $\|z\|_\infty < \gamma_1 - \beta$.

### FR-1158: Hybrid Signature Attestation, CLI, and SQLite WAL Ledger Receipts

- **Requirement**: The system SHALL support hybrid dual signatures combining classical Ed25519 with ML-DSA-65, expose subcommands `ml-dsa:keygen`, `ml-dsa:sign`, `ml-dsa:verify`, and `ml-dsa:benchmark` via the universal CLI, register MCP actions `ml_dsa_keygen`, `ml_dsa_sign`, `ml_dsa_verify`, and record immutable SHA-256 receipts in the SQLite WAL Ledger.

## 4. Behavior-Driven Development Scenarios (Gherkin)

```gherkin
Feature: Layer-0 Post-Quantum Digital Signature Algorithm (NIST FIPS 204 ML-DSA-65)

  Scenario: BDD-1154 High-Bits and Low-Bits Ring Decomposition
    Given the prime modulus q = 8380417 and decomposition parameter gamma2 = 261888
    When decomposing a polynomial r(x) into high-bits r1 and low-bits r0 via Decompose(r, 2*gamma2)
    Then r is reconstructed exactly as r = r1 * (2*gamma2) + r0 with -gamma2 < r0 <= gamma2.

  Scenario: BDD-1155 Matrix Expansion and Uniform Secret Sampling
    Given a 32-byte seed rho and 64-byte signing seed K
    When expanding the 6x5 matrix A via SHAKE-128 rejection sampling
    And sampling secret vectors s1 in R_q^5 and s2 in R_q^6 with eta = 4
    Then every coefficient in s1 and s2 satisfies -4 <= c <= 4 modulo q
    And the expanded matrix A is completely deterministic and reproducible.

  Scenario: BDD-1156 Honest Key Generation and Signature Verification Round-Trip
    Given a freshly generated ML-DSA-65 keypair (pk, sk)
    When signing an arbitrary payload message M
    And verifying the signature sigma against public key pk and message M
    Then verification returns true and matches the canonical NIST FIPS 204 acceptance predicate.

  Scenario: BDD-1157 Signature Tamper and Forgery Rejection
    Given a valid signature sigma for message M under public key pk
    When any single bit of message M' is flipped or signature sigma' is modified
    Then verification of sigma' against M' returns false deterministically.

  Scenario: BDD-1158 Hybrid Ed25519 + ML-DSA Signatures and CLI/MCP Dispatch
    Given a hybrid keypair comprising an Ed25519 key and an ML-DSA-65 key
    When generating a composite hybrid signature over payload M
    Then both Ed25519 and ML-DSA verification must pass for the composite signature to be accepted
    And the CLI command 'ml-dsa:sign' outputs valid JSON with an attested SQLite WAL Ledger receipt.
```

## 5. Architecture Decision Record (ADR-227)

- **Context**: NIST finalized the post-quantum standards in August 2024: FIPS 203 (ML-KEM) and FIPS 204 (ML-DSA). Classical asymmetric algorithms are vulnerable to quantum cryptanalysis via Shor's algorithm.
- **Decision**: Implement the finalized NIST FIPS 204 ML-DSA-65 standard in pure Layer-0 TypeScript (Node 24 strip-only), without external npm dependencies (Law V).
- **Alternatives Discarded**:
  - _External npm libraries (`@noble/post-quantum`, `crystals-dilithium-js`)_: Rejected due to external dependency violation (Law V) and supply-chain risk.
  - _Native Rust/C N-API addon_: Rejected to maintain 100% platform-independent portability across Windows, Linux, and macOS without binary compilation toolchains.
  - _Falcon (NIST FIPS 206 / FN-DSA)_: Rejected due to complex floating-point requirements and trapdoor sampler timing-attack hazards in JavaScript runtimes.
- **Consequences**: Completes Glorian's sovereign post-quantum suite alongside ML-KEM-768, providing end-to-end quantum-resistant key exchange and digital attestation.
