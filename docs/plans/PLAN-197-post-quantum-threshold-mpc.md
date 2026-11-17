# PLAN-197: Threshold Secret Sharing & Ring-LWE Homomorphic Secure Aggregation Engine

## 1. Architecture

```
 Party_1 .. Party_N (private vectors)
        │  encryptVector(pk, m_i)
        ▼
 ┌──────────────────────────────┐
 │  Ring-LWE ciphertexts (c0,c1) │  R_q = Z_q[x]/(x^n+1), q = 2^61-1
 └──────────────┬───────────────┘
                │ addCiphertexts / scalarMultiply (untrusted aggregator)
                ▼
 ┌──────────────────────────────┐
 │   Aggregate ciphertext        │
 └──────────────┬───────────────┘
                │ partialDecrypt(ct, keyShare_i)  (any T of N custodians)
                ▼
 ┌──────────────────────────────┐
 │ combinePartialDecryptions     │  c0 + Σ λ_i · (c1 · s_i) = c0 + c1 · s
 │ (Lagrange at 0, decode mod t) │
 └──────────────────────────────┘
```

Pure domain module, no I/O. The CLI adapter only formats output and writes the evidence receipt.

## 2. Architecture Decision Records

### ADR-197-001: Mersenne Prime `q = 2^61 - 1` as Shared Field and Ring Modulus

- **Context**: Threshold decryption requires Lagrange interpolation over the same modulus as the ciphertext ring, which needs a prime modulus for modular inverses.
- **Decision**: Use `q = 2^61 - 1` for both the Shamir field and the Ring-LWE modulus. Inverses use Fermat's little theorem (`a^(q-2)`).
- **Rejected Alternative**: Power-of-two modulus (common in RLWE implementations) — no field structure, so Lagrange coefficients do not exist.

### ADR-197-002: Coefficient-Wise Shamir Sharing of the Ring Secret

- **Context**: Partial decryption must be linear in the key share so that `Σ λ_i (c1 · s_i) = c1 · s`.
- **Decision**: Share each coefficient of the ternary secret `s` independently with the same abscissae; polynomial multiplication by `c1` is `F_q`-linear, so Lagrange recombination commutes with it.
- **Rejected Alternatives**: (a) Additive `N`-of-`N` sharing — no dropout tolerance. (b) Smudging-noise partial decryptions — the Lagrange coefficients are large field elements and would amplify smudging noise beyond the decryption bound; correct handling requires noise-flooding with integer-scaled Lagrange coefficients, deferred to a future change.

### ADR-197-003: Seedable Entropy Source with Cryptographic Default

- **Context**: Tests and audits need reproducibility; real use needs unpredictable randomness.
- **Decision**: When a seed is supplied, a SplitMix64 stream (seeded via SHA-256) drives all sampling; otherwise `crypto.randomBytes` is used. Uniform sampling mod `q` uses rejection sampling to avoid modulo bias.
- **Rejected Alternative**: `Math.random()` — not cryptographic and not reproducible.
