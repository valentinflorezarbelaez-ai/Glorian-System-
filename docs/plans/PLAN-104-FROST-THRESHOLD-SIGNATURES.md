# PLAN-104: Layer-0 FROST Threshold Schnorr Signatures (RFC 9591) Core

## Plan Metadata

- **Plan ID**: `PLAN-104`
- **Change ID**: `CHANGE-104`
- **Spec ID**: `SPEC-219`
- **Target**: `eos-system-control-plane`
- **Author**: Valentín Flórez Arbeláez
- **Status**: APPROVED

---

## 1. Execution Architecture

1. **Secp256k1 Curve Group Operations**:
   - Reuse curve point arithmetic from `src/core/eosVerifiableRandomFunctionCore.ts` (points, addition, scalar multiplication, serialization) or import them cleanly.
   - Field scalar arithmetic modulo $q = \text{0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n}$.
   - Lagrange interpolation over $\mathbb{Z}_q$: $\lambda_i(S) = \prod_{j \in S, j \ne i} \frac{j}{j - i} \pmod q$.

2. **FROST Protocol Stages**:
   - `setup(t, n, seed)`: generates polynomial $f(x) = s_0 + a_1 x + \dots + a_{t-1} x^{t-1} \pmod q$, returns participant key shares $(i, s_i, Y_i)$ and group public key $PK$.
   - `round1(participantId)`: generates nonces $(d_i, e_i)$ and public commitment $(D_i, E_i)$.
   - `computeBindingFactors(message, commitments)`: computes $\rho_i = \text{SHA256}(i \,\|\, m \,\|\, \mathcal{B}) \pmod q$.
   - `round2(participantId, share, nonces, bindingFactor, c, lambda)`: computes $z_i = (d_i + e_i \rho_i + \lambda_i s_i c) \pmod q$.
   - `aggregate(commitments, rhoList, shares)`: computes $R = \sum (D_i + \rho_i E_i)$, $z = \sum z_i \pmod q$, returns signature $(R, z)$.
   - `verify(PK, message, signature)`: standard Schnorr verification $z \cdot G == R + c \cdot PK$.

3. **Frontier & Integration**:
   - Subpath export `"./frost"` in `package.json` and explicit exports in `src/core/index.ts`.
   - Dedicated CLI module `bin/commands/cliFrostMesh.mjs` wired into `cliPlatform.mjs` and `cliKernel.mjs`.
   - MCP actions `frost_keygen`, `frost_sign`, `frost_verify` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
   - Comprehensive test suite in `test/eosFrostThresholdSignatureCore.test.mjs`.
