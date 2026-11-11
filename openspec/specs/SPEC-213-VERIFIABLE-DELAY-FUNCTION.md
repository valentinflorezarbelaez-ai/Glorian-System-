# SPEC-213: Layer-0 Verifiable Delay Function & Proof of Elapsed Time Engine

## Status

- **Status**: APPROVED
- **Change**: `CHANGE-098`
- **Architecture Decision Record**: `ADR-098`
- **Applicable Standards**: IEEE 830 EARS, ISO/IEC/IEEE 29148 BDD, Wesolowski (2019), Boneh et al. (2018), EOS Inviolable Laws I-VII

---

## Functional Requirements (EARS)

### FR-1084 (Ubiquitous - RSA Group Parameter Configuration & Input Mapping)

THE SYSTEM SHALL initialize the VDF parameter context with composite modulus $N = p \cdot q$ of at least 1024 bits and map input seed string $S$ to base element $x \in \mathbb{Z}_N^*$ by computing $x = (2 + \text{BigInt}(\text{SHA256}(S))) \pmod N$ such that $\gcd(x, N) = 1$.

### FR-1085 (Event-Driven - Sequential Squaring Evaluation)

WHEN delay parameter $T \ge 1$ is specified, THE EVALUATOR SHALL compute $y = x^{2^T} \pmod N$ via strictly sequential squarings:
$$x_0 = x, \quad x_{i+1} = x_i^2 \pmod N \quad \text{for } i \in [0, T - 1]$$
disallowing parallel acceleration without prior knowledge of $\phi(N)$.

### FR-1086 (Event-Driven - Fiat-Shamir Prime Challenge Derivation)

WHEN generating or verifying a Wesolowski proof, THE SYSTEM SHALL derive prime challenge $\ell$ by hashing $(x, y, T)$ through SHA-256 and searching for the smallest prime integer $\ell \ge 2^{64}$ (or 64-bit to 128-bit candidate) satisfying the Miller-Rabin primality test with at least 16 rounds.

### FR-1087 (State-Driven - Wesolowski Quotient Proof Generation & Sub-Millisecond Verification)

WHILE verifying evaluation output $y$ for input $x$ and delay $T$, THE PROVER SHALL compute quotient $q_{\text{div}} = \lfloor 2^T / \ell \rfloor$ and generate proof $\pi = x^{q_{\text{div}}} \pmod N$. THE VERIFIER SHALL compute remainder $r = 2^T \pmod \ell$ in $O(\log T)$ steps, calculate $\hat{y} = (\pi^\ell \cdot x^r) \pmod N$ in $O(\log \ell)$ group multiplications, and verify that $\hat{y} \equiv y \pmod N$ in under 10 milliseconds.

### FR-1088 (Ubiquitous - Unbiased Randomness Beacon, Receipts & Frontier Dispatch)

THE SYSTEM SHALL generate an unbiasable randomness beacon $B = \text{SHA256}(y)$ from the evaluated VDF output, emit a tamper-evident execution receipt, and expose CLI commands `vdf:compute`, `vdf:verify`, `vdf:beacon` and MCP actions `vdf_compute`, `vdf_verify`, `vdf_beacon`.

---

## BDD Scenarios

### BDD-1084: Parameter Context Initialization and Seed Element Mapping

GIVEN an RSA modulus $N$ of 1024 bits and seed string `"eos-sovereign-entropy"`
WHEN the base group element $x$ is mapped
THEN $x$ MUST be strictly in the range $[2, N - 1]$
AND $\gcd(x, N)$ MUST equal $1$.

### BDD-1085: Sequential Squaring Evaluation and Correctness

GIVEN base element $x$ and delay parameter $T = 200$
WHEN sequential squaring evaluation is performed
THEN output $y$ MUST equal $x^{2^{200}} \pmod N$
AND evaluation time MUST scale linearly with $T$.

### BDD-1086: Deterministic Fiat-Shamir Prime Challenge Generation

GIVEN $(x, y, T)$ from an evaluated VDF instance
WHEN prime challenge $\ell$ is derived
THEN $\ell$ MUST be deterministically reproducible from $(x, y, T)$
AND $\ell$ MUST pass Miller-Rabin primality testing with zero false positives.

### BDD-1087: Wesolowski Proof Generation and Fast Verification

GIVEN evaluation output $y$ and proof $\pi$ generated for $T = 500$
WHEN proof verification is executed
THEN verification MUST return TRUE
AND verification time MUST complete in $\le 5$ milliseconds
AND WHEN a forged proof $\pi' \neq \pi$ is tested
THEN verification MUST return FALSE immediately.

### BDD-1088: Unbiased Randomness Beacon and CLI/MCP Dispatch

GIVEN a decentralized randomness request with mixed multi-agent commitments
WHEN the VDF computation completes
THEN the resulting beacon hash MUST be 64 hexadecimal characters
AND CLI command `glorian vdf:compute --delay=100 --json` MUST output valid JSON with SHA-256 receipt.
