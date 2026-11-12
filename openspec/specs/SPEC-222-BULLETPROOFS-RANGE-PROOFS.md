# SPEC-222: Layer-0 Bulletproofs NIZK Range Proofs without Trusted Setup Core

## 1. Specification Metadata

- **Specification ID**: `SPEC-222`
- **Change ID**: `CHANGE-107`
- **Title**: Layer-0 Bulletproofs Non-Interactive Zero-Knowledge Range Proofs without Trusted Setup Core
- **Status**: `APPROVED`
- **Target Subsystem**: `src/core/eosBulletproofsRangeProofCore.ts`
- **Related Specs**: `SPEC-057` (Samael Nexus), `SPEC-212` (Secure MPC), `SPEC-214` (Zero-Knowledge R1CS), `SPEC-219` (FROST Signatures), `SPEC-220` (KZG Commitments)

## 2. Mathematical Foundation & Protocol Design

Bulletproofs provides short non-interactive zero-knowledge proofs for arbitrary range bounds $v \in [0, 2^m - 1]$ without trusted setup.

- **Elliptic Curve**: secp256k1 ($y^2 \equiv x^3 + 7 \pmod p$) with base point $G$, prime order $n$, and nothing-up-my-sleeve point $H = \text{HashToCurve}(\text{"BULLETPROOFS_H_GENERATOR"})$.
- **Transparent Vector Generators**:
  - Independent generators $\vec{g} = (g_0, \dots, g_{m-1})$ and $\vec{h} = (h_0, \dots, h_{m-1})$ derived via SHA-256 hash-to-curve: $g_i = \text{HashToCurve}(\text{"BP_G_"} \mathbin{\Vert} i)$ and $h_i = \text{HashToCurve}(\text{"BP_H_"} \mathbin{\Vert} i)$.
- **Range Proof Relations**:
  - Value $v = \sum_{i=0}^{m-1} a_{L,i} \cdot 2^i$ where $\vec{a}_L \in \{0, 1\}^m$.
  - Bit constraints: $\vec{a}_R = \vec{a}_L - \vec{1}$ and $\vec{a}_L \circ \vec{a}_R = \vec{0}$.
  - Blinding polynomial $t(X) = t_0 + t_1 X + t_2 X^2$ where $t_0 = \langle \vec{l}(0), \vec{r}(0) \rangle$.
- **Inner Product Argument**:
  - Reduces proof size from $2m$ group elements to $2 \lceil \log_2 m \rceil$ elements through recursive halving:
    $L_k = \langle \vec{a}_{L, \text{lo}}, \vec{h}_{\text{hi}} \rangle + c_L \cdot Q$, $R_k = \langle \vec{a}_{L, \text{hi}}, \vec{h}_{\text{lo}} \rangle + c_R \cdot Q$.
- **Fiat-Shamir Transcript**:
  - Interactive challenges $y, z, x$ are derived deterministically using SHA-256 state sponging over all public commitments ($V, A, S, T_1, T_2$).

## 3. Functional Requirements (IEEE 830 EARS)

### FR-1129: Transparent Parameter Generation & Pedersen Commitments

- **Requirement**: The system SHALL generate transparent generator vectors $\vec{g}, \vec{h} \in \mathbb{G}^m$ for bit-length $m \in \{16, 32, 64\}$ using deterministic hash-to-curve without trusted setup, and SHALL compute homomorphic Pedersen commitments $V = v \cdot G + \gamma \cdot H$.

### FR-1130: Vector Bit-Decomposition & Blinding Polynomial Synthesis

- **Requirement**: The system SHALL decompose the secret value $v$ into binary vector $\vec{a}_L \in \{0, 1\}^m$, generate blinding vectors $\vec{s}_L, \vec{s}_R \in \mathbb{Z}_n^m$, commit to them via $A, S \in \mathbb{G}$, and compute quadratic polynomial coefficients $t_1, t_2$ with commitments $T_1, T_2$.

### FR-1131: Recursive Inner Product Argument Folding

- **Requirement**: The system SHALL execute recursive inner product argument folding over $\log_2(m)$ iterations, outputting generator vectors $L, R$ of length $\log_2(m)$ and final folded scalars $a, b \in \mathbb{Z}_n$, achieving $O(\log m)$ proof size.

### FR-1132: Non-Interactive Verification & Soundness

- **Requirement**: The system SHALL verify that a range proof $(\text{commitment}, A, S, T_1, T_2, \tau_x, \mu, \hat{t}, L, R, a, b)$ is valid for commitment $V$ in $O(m)$ multiscalar multiplications, rejecting any forged proof where $v \notin [0, 2^m - 1]$ or where blinding factors are tampered with.

### FR-1133: Frontier CLI, MCP Tools, and Monotonic Ledger Receipts

- **Requirement**: The system SHALL expose subcommands `bp:commit`, `bp:prove`, `bp:verify`, and `bp:benchmark` via the universal CLI, register MCP actions `bp_commit`, `bp_prove`, `bp_verify`, and record an attested SHA-256 execution receipt into the SQLite WAL Ledger.

## 4. Behavior-Driven Development Scenarios (Gherkin)

```gherkin
Feature: Layer-0 Bulletproofs NIZK Range Proofs without Trusted Setup

  Scenario: BDD-1129 Transparent Generator Derivation and Pedersen Homomorphism
    Given the secp256k1 curve parameters and bit-length m = 32
    When generating vector generators g and h via deterministic hash-to-curve
    Then all points lie on the secp256k1 curve and satisfy group invariants
    And Pedersen commitments V1, V2 satisfy additive homomorphism: V(v1 + v2, gamma1 + gamma2) = V1 + V2.

  Scenario: BDD-1130 Valid Range Proof Generation and Logarithmic Verification
    Given a private value v = 42000 within range [0, 2^32 - 1]
    When generating a Bulletproofs range proof using transparent generators
    Then the proof contains exactly 2*log2(32) + 4 = 14 group elements and 5 scalars
    And the verification algorithm confirms validity in sub-5 milliseconds.

  Scenario: BDD-1131 Soundness and Out-of-Range Value Rejection
    Given an out-of-range value v = 2^32 + 5 for bit-length m = 32
    When attempting to generate or verify a range proof claiming v is within [0, 2^32 - 1]
    Then verification fails and returns valid = false.

  Scenario: BDD-1132 Tampered Proof Rejection and Non-Malleability
    Given an authentic Bulletproofs range proof for valid value v
    When an adversary tampers with scalar tau_x, mu, t_hat, or any group point L/R
    Then verification strictly rejects the forged proof with valid = false.

  Scenario: BDD-1133 CLI, MCP Dispatch and Monotonic Ledger Receipt
    Given the Glorian CLI and MCP control plane
    When invoking bp:commit, bp:prove, and bp:verify through CLI and MCP tools
    Then the command outputs valid JSON with Pedersen commitment and NIZK proof
    And an immutable SHA-256 execution receipt is recorded in the SQLite WAL Ledger.
```

## 5. Architecture Decision Record (ADR-222)

- **Context**: Zero-knowledge proving of confidential quotas and balances across the 9 fleet repositories requires avoiding trusted setups.
- **Decision**: Implement Bulletproofs (Bünz et al.) with logarithmic inner product arguments directly on secp256k1 in pure Layer-0 TypeScript (Node 24 strip-only).
- **Alternatives Discarded**:
  - _Groth16 / SNARKs_: Requires circuit-specific trusted setup (toxic waste risk).
  - _STARKs_: Transparent setup but proof size is $>40$ KB (vs Bulletproofs' compact $\approx 1.5$ KB).
  - _External native libraries (libsecp256k1-bulletproofs, dalek-bulletproofs)_: Violates EOS Law I (zero external dependencies) and Law II (Node 24 strip-only purity).
- **Consequences**: Enables confidential resource accounting with compact proofs and zero trusted ceremony.
