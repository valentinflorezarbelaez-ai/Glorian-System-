# PLAN-105: Engineering Implementation Plan for KZG Polynomial Commitments Core (SPEC-220)

- **Spec**: `SPEC-220`
- **Change**: `CHANGE-105`
- **Component**: `eos-system-control-plane`
- **Lead**: `user:valentin-florez-arbelaez`
- **Status**: APPROVED

---

## 1. Technical Strategy

1. **Domain Types (`src/core/eosKzgPolynomialCommitmentCore.types.ts`)**:
   - `KzgSrs`: Structured reference string with power-of-tau points $SRS_1$, degree, and commitment to toxic waste.
   - `Polynomial`: Array of scalar coefficients in $\mathbb{Z}_q$.
   - `KzgCommitment`: Group point $C$, hex representation, and SHA-256 receipt.
   - `KzgOpeningProof`: Proof point $\pi$, evaluation point $z$, evaluation value $v$, and receipt.
   - `KzgBatchProof`: Batched quotient proof $\pi_{batch}$, evaluation points and values, and receipt.
   - `KzgVerificationResult`: Boolean `valid`, latency in ms, and receipt.

2. **Core Implementation (`src/core/eosKzgPolynomialCommitmentCore.ts`)**:
   - Re-use secp256k1 point operations (`pointMultiply`, `pointAdd`, `serializePoint`, `isOnCurve`, `SECP256K1_G`, `SECP256K1_Q`, `modInverse`) from `eosVerifiableRandomFunctionCore.ts`.
   - Implement `EosKzgPolynomialCommitmentCore`:
     - `static setup(maxDegree, seed?)`: Generates $SRS_1 = [\tau^i \cdot G]_{i=0}^d$.
     - `commit(polynomial)`: Multiscalar accumulation $\sum c_i SRS_1[i]$.
     - `open(polynomial, z)`: Computes $v = p(z)$, divides $(p(x) - v) / (x - z)$ to obtain $q(x)$, commits $q(x)$ as $\pi$.
     - `verify(commitment, z, v, proof)`: Checks algebraic relation via simulated pairing or curve check.
     - `openBatch(polynomial, points)`: Lagrange interpolation of $I(x)$, vanishing $Z(x)$, quotient $q(x) = (p(x) - I(x)) / Z(x)$.
     - `verifyBatch(commitment, points, values, batchProof)`: Evaluates batched polynomial consistency.
     - Immutable SHA-256 receipts with monotonic timestamp.

3. **CLI Integration (`bin/commands/cliKzgMesh.mjs`)**:
   - Commands: `kzg:commit`, `kzg:open`, `kzg:verify`, `kzg:batch`.
   - Wired in `cliPlatform.mjs` and `cliKernel.mjs`.

4. **MCP Actions**:
   - In `eosMcpPhase7EnterpriseFrontierHandlersExt.ts`: `kzg_commit`, `kzg_open`, `kzg_verify`.

5. **Test Suite & Enterprise Facade**:
   - `test/eosKzgPolynomialCommitmentCore.test.mjs` verifying BDD-1119..BDD-1123.
   - Step #32 in `test/eosEnterpriseFacade.test.mjs` keeping total lines $\le 800$.
