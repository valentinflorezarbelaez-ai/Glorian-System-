# PLAN-212: Architectural Plan for Autonomous Zero-Knowledge Circuit Synthesizer (`SPEC-350`)

- **Change ID**: `CHANGE-212`
- **Spec**: `SPEC-350`
- **Status**: `APPROVED`
- **Lead Architect**: Autonomous Engineering Director (Antigravity / EOS)

---

## 1. Architectural Strategy

The Zero-Knowledge Circuit Synthesizer provides a self-contained compilation pipeline from high-level arithmetic programs into verifiable zero-knowledge constraint systems:

1. **Finite Field Core ($\mathbb{F}\_p$)**:
   - Implements native JavaScript `BigInt` modular arithmetic over BN254 scalar field ($r = 21888242871839275222246405745257275088548364400416034343698204186575808495617\text{n}$).
   - Fast exponentiation by squaring and Fermat's Little Theorem modular inverse ($a^{-1} \equiv a^{p-2} \pmod p$).
2. **Circuit Builder & R1CS Arithmetizer**:
   - Manages variable allocation: Variable 0 is constant 1 ($w_0 = 1$), followed by public inputs, private inputs, and intermediate auxiliary wires.
   - Converts multiplication gates into R1CS rows: $\langle A_i, w \rangle \cdot \langle B_i, w \rangle = \langle C_i, w \rangle \pmod p$.
   - Synthesizes boolean checks $w_k \cdot (1 - w_k) = 0$ and conditional multiplexers.
3. **Witness Solver & Validator**:
   - Computes assignments for intermediate wires during symbolic execution.
   - Verifies whether a given witness vector strictly satisfies all constraints.

---

## 2. Architecture Decision Records (ADRs)

### ADR-212-001: Native BigInt BN254 Field Arithmetic without WebAssembly/C++ Dependencies

- **Context**: Zero-Knowledge circuit compilation usually relies on native Rust/C++ binaries (Circom, Halo2) which break portable Layer-0 runtime execution.
- **Decision**: Implement all modular field operations natively using JavaScript `BigInt`.
- **Consequence**: Full cross-platform portability across Node.js, Bun, browsers, and edge environments with zero installation friction.

### ADR-212-002: Sparse Map Representation for Linear Combinations

- **Context**: Dense matrix representations ($N \times M$) waste memory when circuits grow to hundreds of constraints.
- **Decision**: Represent each linear combination as a sparse map of variable index to field coefficient `Map<number, bigint>`.
- **Consequence**: $\mathcal{O}(k)$ operations per constraint where $k$ is the number of active variables, maximizing cache locality and execution speed.
