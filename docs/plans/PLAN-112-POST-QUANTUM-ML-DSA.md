# PLAN-112: Implementation Plan for NIST FIPS 204 ML-DSA-65 Engine

- **Plan ID**: `PLAN-112`
- **Spec Reference**: `SPEC-227`
- **Change Reference**: `CHANGE-112`
- **Standard**: NIST FIPS 204 (Module-Lattice-Based Digital Signature Standard)

## 1. Architectural Strategy

Build a pure Layer-0 TypeScript module (`src/core/eosPostQuantumMlDsaCore.ts`) executing in Node.js 24 without transpilation or external libraries.

### Components

1. **Lattice Ring Arithmetic ($R_q = \mathbb{Z}\_q[X]/(X^{256} + 1)$ with $q = 8380417$)**:
   - Constant-time polynomial addition, subtraction, and ring multiplication with negative wrap-around.
   - Decomposition functions: `power2Round`, `decompose`, `highBits`, `lowBits`, `makeHint`, `useHint`.
2. **Deterministic Sampling via Built-In Keccak/SHAKE**:
   - Matrix $A \in R_q^{6 \times 5}$ generation via SHAKE-128 rejection sampling from $\rho$.
   - Uniform bounded polynomial sampling $S_\eta$ with $\eta = 4$.
   - Challenge polynomial sampling $c \in R_q$ with Hamming weight $\tau = 49$.
3. **Key Generation (`ML-DSA.KeyGen`)**:
   - Expands seed $\xi \in \{0,1\}^{256}$ to seeds $\rho, \rho', K$.
   - Samples $s_1 \in R_q^5, s_2 \in R_q^6$.
   - Computes $t = A \cdot s_1 + s_2$.
   - Decomposes $(t_1, t_0) \leftarrow \text{Power2Round}(t, d=13)$.
   - Computes public key $pk = (\rho, t_1)$ and secret key $sk = (\rho, K, \text{tr}, s_1, s_2, t_0)$.
4. **Signing (`ML-DSA.Sign`)**:
   - Fiat-Shamir with Aborts loop.
   - Samples masking vector $y \in R_q^5$ with coefficients bounded by $\gamma_1 = 2^{19}$.
   - Computes $w = A \cdot y$ and extracts high-bits $w_1 = \text{HighBits}(w)$.
   - Derives challenge $\tilde{c} = H(\mu \| w_1)$.
   - Computes response $z = y + c \cdot s_1$.
   - Rejection condition: if $\|z\|_\infty \ge \gamma_1 - \beta$ or low-bits $\|r_0\|_\infty \ge \gamma_2 - \beta$, abort and resample $y$.
   - Computes hints $h = \text{MakeHint}(-c \cdot t_0, w - c \cdot s_2 + c \cdot t_0)$.
   - Outputs signature $\sigma = (\tilde{c}, z, h)$.
5. **Verification (`ML-DSA.Verify`)**:
   - Reconstructs $w_1' = \text{UseHint}(h, A \cdot z - c \cdot t_1 \cdot 2^d)$.
   - Checks $\tilde{c} = H(\mu \| w_1')$ and $\|z\|_\infty < \gamma_1 - \beta$.
6. **Hybrid Ed25519 + ML-DSA-65 Signatures**:
   - Signs with both Ed25519 (via Node `crypto.sign`) and ML-DSA-65.
   - Verifies both before approving transaction or git commit.
7. **CLI and MCP Interface**:
   - `node bin/eos.mjs ml-dsa:keygen`, `ml-dsa:sign`, `ml-dsa:verify`.
   - MCP actions in `eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
