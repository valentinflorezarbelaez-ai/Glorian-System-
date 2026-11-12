# PLAN-102: Layer-0 Verifiable Random Functions (ECVRF RFC 9381) Core

## Plan Metadata

- **Plan ID**: `PLAN-102`
- **Change ID**: `CHANGE-102`
- **Spec ID**: `SPEC-217`
- **Target**: `eos-system-control-plane`
- **Author**: Valentín Flórez Arbeláez
- **Status**: APPROVED

---

## 1. Execution Architecture

1. **Mathematical Primitives**:
   - Prime field $\mathbb{F}_p$ arithmetic where $p = 2^{256} - 2^{32} - 977$.
   - Group order $q = \text{0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n}$.
   - Secp256k1 short Weierstrass curve: $y^2 = x^3 + 7 \pmod p$.
   - Base generator point $G = (G_x, G_y)$.
   - Modular inverse via Extended Euclidean Algorithm ($O(\log p)$).
   - Modular square root via Tonelli-Shanks / $p \equiv 3 \pmod 4$ exponentiation ($x^{(p+1)/4} \pmod p$).
   - Constant-time scalar multiplication (double-and-add).
   - Hash-to-curve try-and-increment primitive producing verified points on the curve.

2. **ECVRF Protocol**:
   - `prove(sk, alpha)`: generates $\Gamma = sk \cdot H$, $U = k \cdot G$, $V = k \cdot H$, challenge $c$, response $s$.
   - `verify(pk, alpha, proof)`: reconstructs $U' = s \cdot G - c \cdot pk$, $V' = s \cdot H - c \cdot \Gamma$, recomputes challenge $c'$.
   - `isElected(beta, thresholdFraction)`: evaluates $\frac{\text{BigInt}(\beta)}{2^{256}} < \text{thresholdFraction}$.

3. **Frontier & Integration**:
   - Subpath export `"./vrf"` in `package.json` and explicit exports in `src/core/index.ts`.
   - Dedicated CLI module `bin/commands/cliVrfMesh.mjs` wired into `cliPlatform.mjs` and `cliKernel.mjs`.
   - MCP actions `vrf_eval`, `vrf_verify`, `vrf_elect` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`.
   - Comprehensive test suite in `test/eosVerifiableRandomFunctionCore.test.mjs`.
