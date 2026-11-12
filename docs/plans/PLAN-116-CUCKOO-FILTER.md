# PLAN-116 — Layer-0 Cuckoo Filter Engine

## Metadata

- **Plan ID**: PLAN-116
- **Change ID**: CHANGE-116
- **SPEC ID**: SPEC-231
- **Status**: APPROVED
- **Date**: 2026-11-12

## Architecture Decisions

### ADR-116-001: 4-Slot Bucket Design with Power-of-Two Capacity

**Decision**: Use 4 slots per bucket ($b = 4$) and round total bucket count $m$ up to the nearest power of 2.
**Rationale**: 4-slot buckets allow the Cuckoo filter to reach $>95\%$ load factor before kicking cascades fail.
A power-of-two bucket count allows bitwise masking `(val & (m - 1))` instead of modulo division, and
preserves the XOR symmetry: $(i_1 \oplus \text{hash}(fp)) \pmod m \equiv i_2 \iff (i_2 \oplus \text{hash}(fp)) \pmod m \equiv i_1$.
**Rejected**: Non-power-of-two bucket count (causes XOR wrapping asymmetry where $(a \oplus b) \pmod m \ne ((a \pmod m) \oplus b) \pmod m$).

### ADR-116-002: Non-Zero Fingerprints (8-bit or 16-bit)

**Decision**: Fingerprint 0 is reserved as the `EMPTY` slot sentinel. When hash produces fingerprint 0,
it is incremented to 1.
**Rationale**: Eliminates the need for a separate boolean presence bitmask per slot, cutting memory in half.

### ADR-116-003: Compact Uint8Array/Uint16Array Backing

**Decision**: Store all buckets in a single flat contiguous `Uint8Array` or `Uint16Array` of size $m \times b$.
**Rationale**: Cache-friendly layout, zero heap fragmentation, and instant zero-copy serialization
via `Buffer.from(typedArray.buffer)`.

## Implementation Steps

1. Create `src/core/eosCuckooFilterCore.types.ts`
2. Create `src/core/eosCuckooFilterCore.ts` (FNV-1a / Murmur3 / SHA-256 hashing, partial-key cuckoo, insert, contains, delete, serialize, deserialize)
3. Create CLI handler `bin/commands/cliCuckooMesh.mjs`
4. Wire CLI in `bin/commands/cliPlatform.mjs`
5. Wire MCP in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
6. Export in `src/core/index.ts` and `package.json`
7. Write BDD test suite `test/eosCuckooFilterCore.test.mjs` (BDD-1174..BDD-1178)
8. Add step #43 to `test/eosEnterpriseFacade.test.mjs`
9. Update `docs/DEVELOPER_GUIDE.md` (Module 46)
10. Run `scripts/tip-refresh.mjs` and export catalog
11. Run `npm run typecheck` and test suites
12. Prettier format and commit
13. Seal Freeze Pin and commit
14. Run fleet audit and save to Engram
