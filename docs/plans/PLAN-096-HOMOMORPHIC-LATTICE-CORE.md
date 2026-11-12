# PLAN-096: Layer-0 Lattice-Based Homomorphic Encryption Core Architecture

## 1. Architectural Intent

Confidential computing in multi-agent swarms requires calculating arithmetic over encrypted data without revealing plaintext to worker nodes. This architecture establishes a zero-dependency, pure Layer-0 RLWE/BFV-style somewhat homomorphic encryption engine (`EosHomomorphicLatticeCore`) conforming to the 7 Inviolable Laws of EOS.

## 2. Mathematical Foundation: Negacyclic Polynomial Quotient Ring

Let $R_q = \mathbb{Z}_q[X] / (X^N + 1)$ with $N = 2^k$ (power of two) and odd modulus $q$.
Multiplication of two polynomials $a(X), b(X) \in R_q$:
$$c(X) = a(X) \cdot b(X) \pmod{(X^N + 1)}$$
Since $X^N \equiv -1$, any term $X^{N + j}$ wraps to $-X^j$:
$$c_k = \sum_{i=0}^k a_i b_{k-i} - \sum_{i=k+1}^{N-1} a_i b_{N+k-i} \pmod q$$
This negacyclic convolution ensures exact closure within $N$ coefficients without degree expansion.

## 3. Cryptosystem Scheme: BFV-style RLWE

1. **Parameters**:
   - $N$: Polynomial degree ($16 \le N \le 1024$, default 32 or 64 for light-weight high-throughput operations).
   - $q$: Ciphertext modulus (e.g., 65537, 12289, 786433).
   - $t$: Plaintext modulus (e.g., 257, 17, 2).
   - $\Delta = \lfloor q / t \rfloor$: Plaintext scaling factor.
2. **Key Generation**:
   - Secret key: $s \leftarrow \text{Ternary}(N) \in \{-1, 0, 1\}^N$.
   - Error: $e \leftarrow \text{DiscreteBoundedError}(N, \sigma=2)$.
   - Public key: $pk = (c_0, c_1) = (-(a \cdot s + e) \pmod q, a)$ with $a \leftarrow U(\mathbb{Z}_q^N)$.
3. **Encryption**:
   - Plaintext $m \in \mathbb{Z}_t^N$.
   - Sample $u \leftarrow \text{Ternary}(N)$, $e_0, e_1 \leftarrow \text{DiscreteBoundedError}(N)$.
   - $c_0 = (pk_0 \cdot u + e_0 + \Delta \cdot m) \pmod{(q, X^N + 1)}$.
   - $c_1 = (pk_1 \cdot u + e_1) \pmod{(q, X^N + 1)}$.
4. **Homomorphic Operations**:
   - Addition: $(c_{0,A} + c_{0,B} \pmod q, c_{1,A} + c_{1,B} \pmod q)$.
   - Subtraction: $(c_{0,A} - c_{0,B} \pmod q, c_{1,A} - c_{1,B} \pmod q)$.
   - Scalar multiplication: $(k \cdot c_0 \pmod q, k \cdot c_1 \pmod q)$.
5. **Decryption**:
   - Phase $v = (c_0 + c_1 \cdot s) \pmod{(q, X^N + 1)}$.
   - Recover: $m_i = \left\lfloor \frac{t}{q} \cdot v_i + 0.5 \right\rfloor \pmod t$.
   - Noise budget: $B = \max(0, \lfloor \log_2(q / (2 \|e\|_\infty + 1)) \rfloor)$ bits.

## 4. Layer-0 Hexagonal Modularity

- `src/core/eosHomomorphicLatticeCore.types.ts`: Pure types, parameter interfaces, ciphertext & keypair representations.
- `src/core/eosHomomorphicLatticeCore.ts`: Core class with DbC assertions (`assertPrecondition`, `deepFreeze`), pure negacyclic arithmetic, and receipt generation.
- CLI: `bin/commands/cliFrontierMesh.mjs` exposing `homomorphic:*`.
- MCP: `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`.

## 5. Alternative Trade-offs Considered & Rejected

- **Full Bootstrapping (FHE via GSW / TFHE)**: Rejected due to 10,000x computational overhead and complex bootstrapping key maintenance. Leveled somewhat homomorphic encryption (SHE) perfectly handles the linear aggregations required for Glorian's multi-agent consensus and telemetry without bootstrapping overhead.
- **Wasm / Native bindings (SEAL/OpenFHE)**: Rejected per Law V (Zero External Runtime Dependencies).
