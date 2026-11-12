# PLAN-117 — Layer-0 HyperLogLog++ Cardinality Estimation Engine

## Metadata

- **Plan ID**: PLAN-117
- **Change ID**: CHANGE-117
- **SPEC ID**: SPEC-232
- **Status**: APPROVED
- **Date**: 2026-11-12

## Architecture Decisions

### ADR-117-001: 64-Bit Cryptographic Hashing via Truncated SHA-256

**Decision**: Use the first 8 bytes (64 bits) of `crypto.createHash('sha256')` as a Big-Endian 64-bit unsigned BigInt.
**Rationale**: Eliminates hash collision degradation for cardinalities up to $2^{64}$. Using built-in `node:crypto` keeps the module strictly Layer-0 with zero external dependencies.
**Rejected**: 32-bit Murmur3 or FNV-1a hashes (begin experiencing collision degradation around $2^{32} \approx 4.29 \times 10^9$ items).

### ADR-117-002: Dual Regime Estimation (Linear Counting & Harmonic Mean with Bias Correction)

**Decision**:

1. When raw estimate $E \le \frac{5}{2}m$ and empty registers $V > 0$, use Linear Counting: $E^* = m \ln(m / V)$.
2. When $E \le 5m$, apply empirical bias correction factor.
3. For large cardinalities ($E > 5m$), use raw harmonic mean $E = \alpha_m m^2 \left( \sum 2^{-M[j]} \right)^{-1}$.
   **Rationale**: Standard HyperLogLog overestimates small cardinalities by up to $300\%$. Linear counting provides near-exact counts when $V > 0$, matching Google's HLL++ paper results.

### ADR-117-003: Memory-Bounded Flat Uint8Array Backing

**Decision**: Store all $m = 2^p$ registers in a contiguous `Uint8Array(m)`.
**Rationale**: For precision $p \ge 4$, the maximum run of leading zeros in a 60-bit remainder is 61, which fits within 6 bits ($< 2^8 = 256$). A flat `Uint8Array` guarantees $O(1)$ indexing, zero heap overhead, and zero-copy binary serialization.

## Implementation Steps

1. Create `src/core/eosHyperLogLogPlusCore.types.ts`
2. Create `src/core/eosHyperLogLogPlusCore.ts`
3. Create CLI handler `bin/commands/cliHllMesh.mjs`
4. Wire CLI in `bin/commands/cliPlatform.mjs`
5. Wire MCP in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
6. Export in `src/core/index.ts` and `package.json`
7. Write BDD test suite `test/eosHyperLogLogPlusCore.test.mjs` (BDD-1179..BDD-1183)
8. Add step #44 to `test/eosEnterpriseFacade.test.mjs`
9. Update `docs/DEVELOPER_GUIDE.md` (Module 47)
10. Run `scripts/tip-refresh.mjs` and export catalog
11. Run `npm run typecheck` and test suites
12. Prettier format and commit
13. Seal Freeze Pin and commit
14. Run fleet audit and save to Engram
