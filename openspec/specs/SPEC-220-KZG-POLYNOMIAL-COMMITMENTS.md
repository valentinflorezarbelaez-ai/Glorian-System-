# SPEC-220: Layer-0 KZG Polynomial Commitments & Batched Multi-Proofs Core

- **Component**: `eos-system-control-plane`
- **Domain**: Cryptographic Primitives & Data Availability
- **Status**: APPROVED
- **Version**: `1.0.0`
- **Governing Doctrine**: `openspec/specs/SPEC-001-CONSTITUTION.md`

---

## 1. Functional Requirements (IEEE 830 EARS)

### FR-1119: Structured Reference String (SRS) Setup & Powers-of-Tau

- **Requirement**: The system SHALL initialize a Structured Reference String (SRS) consisting of $d+1$ curve points $SRS_1 = \{ [\tau^i \cdot G]_{i=0}^d \}$ and reference point $SRS_2 = [\tau \cdot G_2]$ where $\tau \in \mathbb{Z}_q^*$ is a secret trapdoor scalar over secp256k1 order $q = 2^{256} - 2^{32} - 977$.
- **Condition**: Trapdoor scalar $\tau$ MUST NOT be retained in state after SRS generation (toxic waste disposal).
- **Invariant**: For degree bound $d \ge 1$, $SRS_1$ MUST contain exactly $d+1$ valid affine curve points not at infinity.

### FR-1120: Constant-Size O(1) Polynomial Commitments

- **Requirement**: Given a polynomial $p(x) = \sum_{i=0}^m c_i x^i \in \mathbb{Z}_q[x]$ with degree $m \le d$, the system SHALL compute a constant-size commitment $C = \sum_{i=0}^m c_i \cdot SRS_1[i] \in \mathbb{G}_1$ using multiscalar point addition.
- **Invariant**: The size of commitment $C$ MUST remain strictly constant ($33$ bytes compressed or $65$ bytes uncompressed) regardless of polynomial degree $m$.

### FR-1121: Constant-Size Single-Point Evaluation Opening Proof

- **Requirement**: Given evaluation point $z \in \mathbb{Z}_q$ and value $v = p(z) \pmod q$, the system SHALL compute the quotient polynomial $q(x) = \frac{p(x) - v}{x - z} \in \mathbb{Z}_q[x]$ using synthetic polynomial division with zero remainder ($R = 0$).
- **Output**: The system SHALL compute opening proof $\pi = [q(\tau)] = \sum_{i=0}^{m-1} q_i \cdot SRS_1[i] \in \mathbb{G}_1$.

### FR-1122: Batched Multi-Point Evaluation Proofs

- **Requirement**: Given $k$ distinct evaluation points $\{z_1, \dots, z_k\}$ and claimed evaluations $\{v_1, \dots, v_k\}$ such that $p(z_j) = v_j$, the system SHALL construct the vanishing polynomial $Z(x) = \prod_{j=1}^k (x - z_j)$ and the interpolation polynomial $I(x)$ of degree $< k$, compute quotient $q(x) = \frac{p(x) - I(x)}{Z(x)}$, and commit to $q(x)$ as the batched proof $\pi_{batch} \in \mathbb{G}_1$.

### FR-1123: Cryptographic Verification & Tamper Rejection

- **Requirement**: The system SHALL verify that commitment $C$, evaluation point $z$, claimed value $v$, and proof $\pi$ satisfy the polynomial relation:
  $$\tau \cdot q(\tau) + v = p(\tau) + z \cdot q(\tau) \pmod q$$
  Equivalently in curve points: $[p(\tau) - v] = (\tau - z) \cdot [q(\tau)]$.
- **Security**: Any modification to claimed value $v$, evaluation point $z$, polynomial coefficients, or proof point $\pi$ MUST be rejected with `valid = false`.
- **Performance**: Single-point verification MUST execute in $< 2$ milliseconds.
- **Auditability**: Every commitment, proof generation, and verification operation MUST emit an immutable SHA-256 receipt.

---

## 2. BDD Acceptance Criteria (ISO/IEC/IEEE 29148)

### BDD-1119: Structured Reference String Initialization and Power-of-Tau Invariants

- **Given** a maximum polynomial degree $d \ge 1$ and an optional deterministic seed,
- **When** the system generates the Structured Reference String $SRS$,
- **Then** $SRS_1$ contains exactly $d + 1$ valid curve points on secp256k1,
- **And** point $0$ matches the curve generator $G$,
- **And** inputs with $d < 1$ throw a precondition error.

### BDD-1120: Deterministic Constant-Size Polynomial Commitments

- **Given** an SRS of degree $d \ge 8$ and a polynomial $p(x)$ of degree $k \le d$,
- **When** the engine computes commitment $C = \text{commit}(p)$,
- **Then** $C$ is a valid affine curve point serialized to 66 hex characters (compressed),
- **And** computing the commitment twice on identical coefficients yields an identical root hex,
- **And** an immutable SHA-256 receipt is generated.

### BDD-1121: Single-Point Evaluation Proof Generation and Exact Quotient Division

- **Given** a polynomial $p(x) = 3x^3 + 2x^2 + 5x + 7$ and point $z = 4$,
- **When** the engine evaluates $v = p(z)$ and calls `open(p, z)`,
- **Then** synthetic division yields quotient $q(x)$ of degree $2$ with remainder $0$,
- **And** proof $\pi = \text{commit}(q)$ is an affine curve point in $\mathbb{G}_1$,
- **And** verifying $(\text{commit}(p), z, v, \pi)$ returns `valid = true`.

### BDD-1122: Batched Multi-Point Opening and Verification

- **Given** a polynomial $p(x)$ and $k=3$ distinct points $\{z_1, z_2, z_3\}$,
- **When** the engine generates a batched proof using vanishing polynomial $Z(x)$ and interpolation polynomial $I(x)$,
- **Then** quotient $q(x) = \frac{p(x) - I(x)}{Z(x)}$ has zero remainder,
- **And** the batched proof $\pi_{batch}$ verifies against the claimed evaluations $\{v_1, v_2, v_3\}$.

### BDD-1123: Tamper Rejection, Sub-Millisecond Verification, CLI and MCP Dispatch

- **Given** a valid commitment $C$ and evaluation proof $\pi$ for $p(z) = v$,
- **When** an adversary tampers with $v$, $z$, or $\pi$,
- **Then** verification returns `valid = false`,
- **And** verification executes in $< 2$ milliseconds,
- **And** CLI commands `kzg:commit`, `kzg:open`, `kzg:verify` execute successfully with `--json`,
- **And** MCP tool actions `kzg_commit`, `kzg_open`, `kzg_verify` dispatch correctly.
