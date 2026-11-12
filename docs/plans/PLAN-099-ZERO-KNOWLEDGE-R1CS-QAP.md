# PLAN-099: Layer-0 Zero-Knowledge Rank-1 Constraint System (R1CS) & QAP Arithmetic Circuit Core Architecture

## 1. Architectural Intent

Establish an in-memory, zero-dependency Layer-0 zero-knowledge circuit compilation, Rank-1 Constraint System (R1CS) synthesis, and Quadratic Arithmetic Program (QAP) proof engine (`EosZeroKnowledgeR1csCore`). It enables confidential verifiable computation, succinct zero-knowledge arguments, and private state transitions under the 7 Inviolable Laws of EOS.

## 2. Mathematical Foundation: R1CS and QAP over Finite Field $\mathbb{Z}_p$

1. **Finite Field**:
   - Prime $p = 21888242871839275222246405745257275088548364400416034343698204186575808495617$ (BN254 scalar field order).
   - Inversion via Extended Euclidean Algorithm: $a \cdot x + p \cdot y = \gcd(a, p) = 1 \implies x \equiv a^{-1} \pmod p$.
2. **R1CS (Rank-1 Constraint System)**:
   - A circuit with $n$ variables (wires) and $m$ multiplication constraints is represented by matrices $A, B, C \in \mathbb{Z}_p^{m \times n}$.
   - The witness vector is $\mathbf{s} = [1, x_1, \dots, x_l, w_1, \dots, w_{n-l-1}]^T \in \mathbb{Z}_p^n$.
   - Constraint equation for each gate $k \in [0, m-1]$:
     $$\left(\sum_{i=0}^{n-1} A_{k,i} s_i\right) \cdot \left(\sum_{i=0}^{n-1} B_{k,i} s_i\right) \equiv \left(\sum_{i=0}^{n-1} C_{k,i} s_i\right) \pmod p$$
3. **QAP (Quadratic Arithmetic Program)**:
   - Choose $m$ distinct evaluation points $r_1, r_2, \dots, r_m \in \mathbb{Z}_p$ (e.g. $r_j = j$).
   - For each variable $i \in [0, n-1]$, construct polynomials $A_i(x), B_i(x), C_i(x)$ of degree at most $m-1$ using Lagrange polynomial interpolation:
     $$A_i(r_j) = A_{j-1, i}, \quad B_i(r_j) = B_{j-1, i}, \quad C_i(r_j) = C_{j-1, i}$$
   - Construct target polynomial $T(x) = \prod_{j=1}^m (x - r_j)$.
4. **Quotient Polynomial & Divisibility**:
   - Define:
     $$P(x) = \left(\sum_{i=0}^{n-1} s_i A_i(x)\right) \cdot \left(\sum_{i=0}^{n-1} s_i B_i(x)\right) - \left(\sum_{i=0}^{n-1} s_i C_i(x)\right)$$
   - If witness $\mathbf{s}$ satisfies the R1CS constraints, then $P(r_j) = 0$ for all $j \in [1, m]$, meaning $T(x)$ divides $P(x)$ with zero remainder.
   - Quotient polynomial: $H(x) = P(x) / T(x)$, computed via polynomial long division over $\mathbb{Z}_p$.
5. **Succinct Fiat-Shamir Evaluation Argument**:
   - Compute evaluation point $\tau \in \mathbb{Z}_p$ derived from SHA-256 hash of witness commitments and public inputs.
   - Prover evaluates $A(\tau), B(\tau), C(\tau), H(\tau), T(\tau)$.
   - Verifier checks in $O(1)$ operations:
     $$A(\tau) \cdot B(\tau) - C(\tau) \equiv H(\tau) \cdot T(\tau) \pmod p$$

## 3. Layer-0 Hexagonal Isolation

- `src/core/eosZeroKnowledgeR1csCore.types.ts`: Pure types, constraint representations, polynomial schemas, and verification receipts.
- `src/core/eosZeroKnowledgeR1csCore.ts`: Core class with DbC assertions (`assertPrecondition`, `deepFreeze`), native `BigInt` finite field arithmetic, circuit synthesizer, Lagrange interpolator, polynomial division, and proof verifier.
- Subpath: `"./zk-r1cs"` in `package.json`.
- CLI: `bin/commands/cliFrontierMesh.mjs` (`r1cs:*`).
- MCP: `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts` (`r1cs_*`).

## 4. Alternative Approaches Considered & Rejected

- **Full Groth16 Trusted Setup (SRS)**: Requires multiparty ceremony (tau powers in $G_1 / G_2$ elliptic curves with pairings). The interactive/trusted setup adds large ceremony files. By implementing QAP polynomial divisibility with Fiat-Shamir evaluation argument over $\mathbb{Z}_p$, we achieve an elegant, transparent Layer-0 verification primitive with zero trusted setup and constant verification time.
- **Circom Wasm Runtime**: Rejected due to violating Law V (external npm dependencies and binary build requirements).
