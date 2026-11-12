# PLAN-114 — Layer-0 Modified Merkle Patricia Trie (MPT) Engine

## Metadata

- **Plan ID**: PLAN-114
- **Change ID**: CHANGE-114
- **SPEC ID**: SPEC-229
- **Status**: APPROVED
- **Date**: 2026-11-12

## Architecture Decisions

### ADR-114-001: Pure Layer-0 RLP Serialization

**Decision**: Implement standard Ethereum-compatible Recursive Length Prefix (RLP) in pure TypeScript.
**Rationale**: RLP provides deterministic, canonical, prefix-free binary encoding for arbitrary byte strings
and lists of items without external libraries (`rlp` npm package).
**Rejected**: JSON serialization (non-canonical, key reordering ambiguities), Protobuf (requires code generation).

### ADR-114-002: SHA-256 for Node Hashing

**Decision**: Use Node.js built-in `crypto.createHash("sha256")` for trie node hashes.
**Rationale**: FIPS 180-4 compliant, hardware-accelerated in Node.js 24 runtime, zero external dependencies,
consistent with all Glorian cryptographic primitives.
**Rejected**: Keccak-256 (requires custom software implementation or external native addon).

### ADR-114-003: In-Memory Node Representation with Embedded Short Nodes

**Decision**: If a node's RLP serialization is < 32 bytes, embed it directly into the parent; if >= 32 bytes,
hash it with SHA-256 and store the 32-byte hash in the parent.
**Rationale**: Standard MPT property that bounds tree depth while minimizing hash computation for short leaves.

## Implementation Steps

1. Create `src/core/eosMerklePatriciaTrieCore.types.ts`
2. Create `src/core/eosMerklePatriciaTrieCore.ts` (RLP, HexPrefix, MPT nodes, CRUD, prove, verifyProof)
3. Create CLI handler `bin/commands/cliTrieMesh.mjs`
4. Wire CLI in `bin/commands/cliPlatform.mjs`
5. Wire MCP in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
6. Export in `src/core/index.ts` and `package.json`
7. Write BDD test suite `test/eosMerklePatriciaTrieCore.test.mjs` (BDD-1164..BDD-1168)
8. Add step #41 to `test/eosEnterpriseFacade.test.mjs`
9. Update `docs/DEVELOPER_GUIDE.md` (Module 44)
10. Run `scripts/tip-refresh.mjs` and export catalog
11. Run `npm run typecheck` and test suites
12. Prettier format and commit
13. Seal Freeze Pin and commit
14. Run fleet audit and save to Engram
