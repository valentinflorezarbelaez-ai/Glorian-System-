# PLAN-098: Layer-0 Verifiable Delay Function Engine Architecture

## 1. Architectural Intent

Establish an inherently sequential, non-parallelizable cryptographic delay engine (`EosVerifiableDelayFunctionCore`) based on the Wesolowski (2019) protocol over RSA composite modulus groups $G = \mathbb{Z}_N^*$. It provides provable elapsed wall-clock delay, unbiasable randomness generation, and MEV front-running resistance under the 7 Inviolable Laws of EOS.

## 2. Mathematical Foundation: Wesolowski VDF over $\mathbb{Z}_N^*$

1. **Group and Parameters**:
   - $N$: 1024-bit or 2048-bit RSA composite integer ($N = p \cdot q$ where factorization is unknown to the prover).
   - $x \in \mathbb{Z}_N^*$: Base element derived deterministically from input seed.
   - $T \ge 1$: Delay parameter (number of sequential squarings).
2. **Evaluation**:
   - Compute $y = x^{2^T} \pmod N$ sequentially:
     $$x_0 = x, \quad x_{i+1} = x_i^2 \pmod N \quad (i = 0 \dots T - 1)$$
   - Parallel processors cannot bypass this without factoring $N$.
3. **Fiat-Shamir Prime Challenge**:
   - Hash $\text{seed} = \text{SHA256}(x \,\|\, y \,\|\, T)$.
   - Search for prime integer $\ell$ starting from `BigInt(seed)` (e.g. 64-bit or 128-bit candidate prime) using deterministic Miller-Rabin primality test.
4. **Proof Generation**:
   - Long division: $2^T = q_{\text{div}} \cdot \ell + r$ where $0 \le r < \ell$.
   - The quotient $q_{\text{div}} = \lfloor 2^T / \ell \rfloor$ is an integer of $T - \log_2 \ell$ bits.
   - Proof $\pi = x^{q_{\text{div}}} \pmod N$.
   - Can be computed either via binary polynomial division or modular multi-exponentiation.
5. **Verification**:
   - Compute remainder $r = 2^T \pmod \ell$ via fast modular exponentiation in $O(\log T)$ steps.
   - Verify: $\pi^\ell \cdot x^r \equiv y \pmod N$.
   - Execution time: $\approx 2$ modular exponentiations with small exponents ($\ell$ and $r$), running in under $5$ milliseconds regardless of $T$!

## 3. Layer-0 Hexagonal Isolation

- `src/core/eosVerifiableDelayFunctionCore.types.ts`: Pure types, parameter interfaces, proof structures, and receipt schemas.
- `src/core/eosVerifiableDelayFunctionCore.ts`: Core class with DbC assertions (`assertPrecondition`, `deepFreeze`), native `BigInt` modular arithmetic, Miller-Rabin test, Wesolowski proof generator, and verifier.
- Subpath: `"./vdf"` in `package.json`.
- CLI: `bin/commands/cliFrontierMesh.mjs` (`vdf:*`).
- MCP: `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts` (`vdf_*`).

## 4. Alternative Trade-offs Considered & Rejected

- **Pietrzak VDF**: Rejected in favor of Wesolowski because Wesolowski proofs are strictly $O(1)$ group elements (single element $\pi$), whereas Pietrzak proofs require $O(\log T)$ group elements.
- **Sloth / Modular Square Roots**: Permutations like Sloth require $p \equiv 3 \pmod 4$ with slower verification ($T$ multiplications for verifier). Wesolowski offers asymmetric verification ($O(\log \ell)$ vs $T$).
