# PLAN-115 — Layer-0 Cryptographic Time-Lock Puzzle Engine

## Metadata

- **Plan ID**: PLAN-115
- **Change ID**: CHANGE-115
- **SPEC ID**: SPEC-230
- **Status**: APPROVED
- **Date**: 2026-11-12

## Architecture Decisions

### ADR-115-001: Native BigInt Modular Exponentiation

**Decision**: Implement Montgomery or binary exponentiation using native Node.js `BigInt` for arbitrary-precision
modular arithmetic.
**Rationale**: `BigInt` in V8 provides performant, arbitrary-precision integer arithmetic without native C++
dependencies (like `gmp` or `bignum` npm packages), maintaining absolute Layer-0 purity.

### ADR-115-002: Authenticated AES-256-GCM for Payload Confidentiality

**Decision**: Use `crypto.createCipheriv("aes-256-gcm")` with 96-bit IV and 128-bit auth tag.
**Rationale**: Guarantees confidentiality and ciphertext integrity. Solvers with corrupted keys or tampered
data fail during tag authentication before returning invalid plaintext.

### ADR-115-003: Dual Strategy: RSW96 Composite Trapdoor + Sloth Prime VDF

**Decision**: Support both composite trapdoor puzzles (RSW96) where author has $O(\log T)$ shortcut, and
prime VDF puzzles (Sloth) where solver computes square roots and anyone can verify via squaring.
**Rationale**: Covers both private key-escrow (where creator knows trapdoor) and publicly verifiable delay
applications (where no trapdoor exists).

## Implementation Steps

1. Create `src/core/eosTimeLockPuzzleCore.types.ts`
2. Create `src/core/eosTimeLockPuzzleCore.ts` (BigInt math, RSW96, Sloth, checkpoints, AES-256-GCM)
3. Create CLI handler `bin/commands/cliTimeLockMesh.mjs`
4. Wire CLI in `bin/commands/cliPlatform.mjs`
5. Wire MCP in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
6. Export in `src/core/index.ts` and `package.json`
7. Write BDD test suite `test/eosTimeLockPuzzleCore.test.mjs` (BDD-1169..BDD-1173)
8. Add step #42 to `test/eosEnterpriseFacade.test.mjs`
9. Update `docs/DEVELOPER_GUIDE.md` (Module 45)
10. Run `scripts/tip-refresh.mjs` and export catalog
11. Run `npm run typecheck` and test suites
12. Prettier format and commit
13. Seal Freeze Pin and commit
14. Run fleet audit and save to Engram
