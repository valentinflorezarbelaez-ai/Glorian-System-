# INTAKE-099: Layer-0 Zero-Knowledge Rank-1 Constraint System (R1CS) & QAP Arithmetic Circuit Core (SPEC-214)

## 1. Context & Motivation

Verifiable decentralized computation, privacy-preserving state attestations, and trustless multi-agent assertions require proving the correctness of arbitrary programmatic executions without revealing confidential inputs:

1. **Confidential Computation**: Agents executing financial settlements, private ML model inferences, or access credential verifications cannot disclose secret state variables.
2. **Succinct Verification (SNARK Foundation)**: Verifying complex calculations on-chain or across resource-constrained edge nodes requires compressing a computation into a succinct proof that can be verified in constant time.
3. **Rank-1 Constraint Systems (R1CS)**: R1CS is the universal intermediate representation for arithmetic circuits over prime fields $\mathbb{Z}_p$, expressing arbitrary computational logic as a set of quadratic constraints of the form $(A \mathbf{s}) \odot (B \mathbf{s}) = C \mathbf{s}$.
4. **Quadratic Arithmetic Programs (QAP)**: Transforming R1CS into polynomials via Lagrange interpolation enables polynomial divisibility checks ($P(x) \equiv 0 \pmod{T(x)}$), which form the mathematical core of modern zk-SNARKs (Groth16, PLONK, Marlin).

External zero-knowledge circuit libraries (Circom, snarkjs, bellman, gnark) require complex external compilers, WebAssembly runtimes, or C++ toolchains, violating EOS Law V (Zero External Runtime Dependencies).

Glorian requires a self-contained Layer-0 implementation of:

1. **Finite Prime Field Arithmetic Core** ($\mathbb{Z}_p$ for BN254 / BabyJubjub / ALT_BN128 scalar field) using native `BigInt` with modular addition, multiplication, and Euclidean inverse.
2. **Arithmetic Circuit & R1CS Constraint Synthesizer**: Declarative building of linear combinations, additions, scalar multiplications, and multiplicative gates.
3. **Witness Assignment & Satisfaction Checker**: Validating whether witness vector $\mathbf{s} = (1, x_{\text{public}}, w_{\text{private}})$ satisfies all $m$ constraints.
4. **QAP Polynomial Interpolation Engine**: Fast Lagrange interpolation converting sparse constraint matrices $A, B, C$ into polynomial vectors $A(x), B(x), C(x)$ and computing target divisor $T(x) = \prod_{j=1}^m (x - j)$.
5. **Quotient Polynomial Computation & Zero-Remainder Proof**: Computing $H(x) = \frac{A(x) \cdot B(x) - C(x)}{T(x)}$ and generating Fiat-Shamir non-interactive evaluation proofs at secret point $\tau$ with zero-knowledge blinding factors.
6. **Constant-Time Verifier**: Evaluating polynomial commitments at challenged evaluation point $\tau$ to confirm circuit satisfaction without re-evaluating the circuit.

## 2. Inviolable Architectural Constraints

- **Zero External Runtime Dependencies (Law V)**: Pure Node 24 strip-only TypeScript using only `node:crypto` and core primitives.
- **Node Ceiling (Law VII)**: Zero modules exceeding 800 lines; types factored into a companion `.types.ts` file.
- **Exact BigInt Finite Field Arithmetic**: Modular arithmetic over prime $p = 21888242871839275222246405745257275088548364400416034343698204186575808495617$ (BN254 curve scalar field order).
- **Sub-Second Proof Generation & Sub-Millisecond Verification**: Proof generation in $\le 50$ ms for typical circuits, verification in $\le 1$ ms.
- **Subpath, CLI & MCP First-Class Export**: Available via `./zk-r1cs` subpath, CLI `r1cs:*`, and MCP `eos_enterprise_workspace` frontier actions.

## 3. Deliverables

1. `openspec/changes/CHANGE-099-ZERO-KNOWLEDGE-R1CS-QAP.md`
2. `openspec/specs/SPEC-214-ZERO-KNOWLEDGE-R1CS-QAP.md` (FR-1089..FR-1093, BDD-1089..BDD-1093)
3. `docs/plans/PLAN-099-ZERO-KNOWLEDGE-R1CS-QAP.md`
4. `docs/tasks/TASKS-099-ZERO-KNOWLEDGE-R1CS-QAP.md`
5. `src/core/eosZeroKnowledgeR1csCore.types.ts` & `src/core/eosZeroKnowledgeR1csCore.ts`
6. `test/eosZeroKnowledgeR1csCore.test.mjs` (BDD-1089..BDD-1093)
7. CLI integration in `bin/commands/cliFrontierMesh.mjs` (`r1cs:synthesize`, `r1cs:prove`, `r1cs:verify`)
8. MCP tool integration in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`
9. Enterprise facade step #26 in `test/eosEnterpriseFacade.test.mjs`
10. Documentation in `docs/DEVELOPER_GUIDE.md` (Módulo 29) and OpenSpec catalog update (209 specs)
