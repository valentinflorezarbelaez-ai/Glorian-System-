# PLAN-118 — Layer-0 Verifiable Secret Sharing Engine

## Metadata

- **Plan ID**: PLAN-118
- **Change ID**: CHANGE-118
- **SPEC ID**: SPEC-233
- **Status**: APPROVED
- **Date**: 2026-11-12

## Architecture Decisions

### ADR-118-001: RFC 3526 Group 15 Parameters and Experimental Status

**Decision**: Use the RFC 3526 3072-bit MODP Group 15 safe prime, with $q=(p-1)/2$ and fixed order-$q$ subgroup generators. Keep this pure TypeScript/BigInt implementation experimental until an independent cryptographic review is complete.
**Rationale**: The former 256-bit group and its claimed 128-bit security level were not supported. Group 15 is a standardized parameter set, but using it does not audit this protocol implementation. JavaScript BigInt does not promise constant-time operations, so this implementation is not suitable for production key custody. Performance requirements must be established with reproducible benchmarks on supported runtimes.
**Rejected**: Non-prime order groups (vulnerable to small subgroup confinement attacks).

### ADR-118-002: Dual Verification Modes (Feldman & Pedersen)

**Decision**: Support Feldman and Pedersen VSS, with Pedersen as the default. Feldman commitments can reveal low-entropy secrets by enabling an offline guess check. Pedersen commitments hide the committed value information-theoretically when the blinding scalar is uniform and the discrete-log relation between generators is unknown; binding remains computational. Neither scheme is, by itself, a zero-knowledge proof.
**Rationale**: Make the less revealing supported mode the default and label the security assumptions accurately. The fixed generators and implementation still require independent review.

### ADR-118-003: Active Cheater Detection in Reconstruction

**Decision**: `reconstruct(shares, k, commitments)` verifies shares against commitments, records invalid participant IDs, and interpolates from valid shares if at least $k$ remain.
**Rationale**: This detects inconsistent supplied shares; it does not eliminate denial of service, establish a participant's identity, or provide a standalone proof of malfeasance.

## Implementation Steps

1. Create `src/core/eosVerifiableSecretSharingCore.types.ts`
2. Create `src/core/eosVerifiableSecretSharingCore.ts` (BigInt modPow, modInverse, polynomial evaluation, Feldman/Pedersen split, verify, reconstruct, serialize)
3. Create CLI handler `bin/commands/cliVssMesh.mjs`
4. Wire CLI in `bin/commands/cliPlatform.mjs`
5. Wire MCP in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
6. Export in `src/core/index.ts` and `package.json`
7. Add BDD scenarios and implement `test/eosVerifiableSecretSharingCore.test.mjs` (BDD-1184..BDD-1189)
8. Add step #45 to `test/eosEnterpriseFacade.test.mjs`
9. Update `docs/DEVELOPER_GUIDE.md` (Module 48)
10. Run `scripts/tip-refresh.mjs` and export catalog
11. Run `npm run typecheck`, focused tests, and the prescribed EOS verification workflow
12. Prettier format and commit
13. Seal Freeze Pin and commit
14. Run fleet audit and save to Engram
