# PLAN-084: Post-Quantum Cryptographic Key Encapsulation (SPEC-199)

- **Target**: `src/core/eosPostQuantumCryptography.ts`
- **Milestone**: SPEC-199 (v69.0.0)
- **Author**: Valentín Flórez Arbeláez

---

## Technical Approach

1. **Lattice Field & Ring Arithmetic**:
   - Modulus $q = 3329$, dimension $n = 256$, primitive root of unity $\zeta = 17$.
   - Forward and inverse Number Theoretic Transform (NTT) for constant-time $O(n \log n)$ ring multiplication.
   - Centered Binomial Distribution (CBD) sampling for error polynomials using secure entropy from `crypto.randomBytes`.
2. **ML-KEM Operations (FIPS 203)**:
   - Keygen: Samples matrix $A$, error $s, e \in R_q^k$, computes $t = As + e$.
   - Encapsulation: Samples message $m$, derives seed, encrypts $u = A^T r + e_1$, $v = t^T r + e_2 + \lceil q/2 \rfloor m$, computes $K = \text{H}(m || ct)$.
   - Decapsulation: Reconstructs $m' = v - s^T u$, re-encrypts $ct'$, and applies Fujisaki-Okamoto implicit rejection if $ct \neq ct'$.
3. **Hybrid KEM**:
   - Uses `crypto.generateKeyPairSync("x25519")` and `crypto.diffieHellman` combined with ML-KEM via HKDF-SHA256.
4. **ML-DSA Signatures (FIPS 204)**:
   - Module-lattice rejection sampling signatures combined with Ed25519 for hybrid signatures.
5. **CLI & MCP Wiring**:
   - `bin/commands/cliPlatform.mjs`: `pq:kem`, `pq:sign`, `pq:verify`.
   - `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`: `pq_kem`, `pq_verify`.
