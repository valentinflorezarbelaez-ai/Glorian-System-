# INTAKE-114 — Layer-0 Modified Merkle Patricia Trie (MPT) for Cryptographic State Commitments

## Metadata

- **Intake ID**: INTAKE-114
- **Change ID**: CHANGE-114
- **SPEC ID**: SPEC-229
- **Author**: EOS Engineering System
- **Date**: 2026-11-12
- **Status**: INTAKE_COMPLETE
- **Priority**: HIGH
- **Layer**: Layer-0 (Zero external runtime dependencies)

## Business Context

The Glorian System requires cryptographic state commitments for distributed state synchronization,
auditable ledger snapshots, and zero-knowledge / light-client verifiable proofs across the 9 fleet
repositories. While append-only Merkle Mountain Ranges (`SPEC-216`) and Sparse Merkle Trees (`SPEC-218`)
provide audit logs and 256-bit membership proofs, they do not provide efficient variable-length
key-value state trie compaction with hex-prefix path optimization, nor do they support dynamic branch
coalescing upon deletion with compact proofs.

## Problem Statement

1. **No variable-length key-value state commitment**: Existing Merkle structures require fixed-depth
   or append-only structures, unsuitable for general-purpose key-value state databases.
2. **No hex-prefix compact encoding**: Path compression is essential to avoid deep branch chains for
   sparse key namespaces.
3. **No standalone Merkle inclusion & exclusion proof verification**: Light clients and external verifiers
   need to verify that a state key equals a specific value (or does not exist) given only the 32-byte
   root hash and a compact proof path.
4. **No branch compaction upon deletion**: Deleting keys from traditional trees leaves tombstone bloat
   or requires full re-indexing.

## Proposed Solution

Implement `EosMerklePatriciaTrieCore` — a pure Layer-0 TypeScript module implementing:

- **Hex-Prefix (Compact) Encoding**: Nibble-based path compression with even/odd length flags and
  leaf/extension terminators.
- **Pure Layer-0 RLP (Recursive Length Prefix)**: Canonical serialization for byte arrays and nested lists.
- **4 Node Architectures**: Null, Leaf (path + value), Extension (path + child hash), Branch (16 nibble
  children + value).
- **CRUD Operations**: `put`, `get`, `delete` with automatic branch-to-extension-to-leaf compaction.
- **Cryptographic Merkle Proofs**: `prove(key)` producing minimal node sequences, and static
  `verifyProof(root, key, proof)` validating inclusion/exclusion in $O(\log_{16} N)$ time.
- **Deterministic 32-byte Root Hash**: SHA-256 node hashing with embedded child nodes for short payloads.

## Constraints

- Zero external runtime dependencies (`dependencies: {}` in `package.json`).
- Pure TypeScript / Node.js 24 built-ins only (`node:crypto` for SHA-256).
- Strict memory bounds and deterministic serialization.
