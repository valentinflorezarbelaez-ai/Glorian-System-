# PLAN-097: Layer-0 Secure Multi-Party Computation Engine Architecture

## 1. Architectural Intent

Enable decentralized multi-agent swarms in Glorian System to perform joint arithmetic (additions, weighted averages, products) on private values without exposing plaintexts to any single party or coordinator, adhering strictly to the 7 Inviolable Laws of EOS.

## 2. Mathematical Foundation: Prime Field & Polynomial Interpolation

1. **Prime Field $\mathbb{Z}\_p$**:
   - Modulus $p$: A 31-bit Mersenne prime $2^{31} - 1 = 2147483647$ (or arbitrary BigInt prime).
   - Inverses in $\mathbb{Z}_p$: Computed via Extended Euclidean Algorithm ($a \cdot x \equiv 1 \pmod p$).
2. **Shamir's $(k, N)$ Threshold Scheme**:
   - Secret $s \in \mathbb{Z}_p$.
   - Sample $a_1, \dots, a_{k-1} \leftarrow U(\mathbb{Z}_p)$.
   - $P(x) = s + \sum_{j=1}^{k-1} a_j x^j \pmod p$.
   - Shares: $S_i = (i, P(i) \pmod p)$ for $i \in \{1, \dots, N\}$.
3. **Lagrange Interpolation at $x = 0$**:
   $$s = P(0) = \sum_{j=1}^k y_j \ell_j(0) \pmod p$$
   where
   $$\ell_j(0) = \prod_{m \neq j} \frac{-x_m}{x_j - x_m} \pmod p$$
4. **Homomorphic Additive Linearity**:
   If $P_A(0) = a$ and $P_B(0) = b$, then $P_{A+B}(x) = P_A(x) + P_B(x)$ has degree $< k$ and $P_{A+B}(0) = a + b \pmod p$.
   Thus:
   $$[a + b]_i = [a]_i + [b]_i \pmod p$$
   Non-interactive!
5. **Multiplication via Beaver Triples**:
   - Pre-shared $([a], [b], [c])$ with $c = a \cdot b \pmod p$.
   - Publicly open $d = x - a$ and $e = y - b$.
   - Each party computes:
     $$[z]_i = [c]_i + d \cdot [b]_i + e \cdot [a]_i + \delta_i \cdot (d \cdot e) \pmod p$$
     where $\delta_1 = 1$, $\delta_{i > 1} = 0$.
   - Open $[z]$ yields $x \cdot y \pmod p$ exactly.

## 3. Layer-0 Hexagonal Isolation

- `src/core/eosSecureMpcShamirCore.types.ts`: Pure types, share interfaces, Beaver triple types, and receipt schemas.
- `src/core/eosSecureMpcShamirCore.ts`: Core class with DbC assertions (`assertPrecondition`, `deepFreeze`), exact `BigInt` finite field arithmetic, and cryptographic receipts.
- Subpath: `"./mpc"` in `package.json`.
- CLI: `bin/commands/cliFrontierMesh.mjs` (`mpc:*`).
- MCP: `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts` (`mpc_*`).

## 4. Alternative Trade-offs Considered & Rejected

- **Garbled Circuits (Yao's GC)**: Rejected due to high bandwidth overhead and asymmetric communication pattern (evaluator vs generator). Shamir + Beaver triples offer symmetric, lightweight arithmetic suitable for multi-agent aggregations.
- **Wasm / External C++ MPC (MP-SPDZ)**: Rejected per Law V (Zero External Dependencies).
