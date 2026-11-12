# SPEC-229 — Layer-0 Modified Merkle Patricia Trie (MPT) for Cryptographic State Commitments

## Metadata

- **SPEC ID**: SPEC-229
- **Change ID**: CHANGE-114
- **Intake ID**: INTAKE-114
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-12
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosMerklePatriciaTrieCore`

---

## 1. Overview

`EosMerklePatriciaTrieCore` implements a Modified Merkle Patricia Trie (MPT) in pure TypeScript.
It provides cryptographically verifiable key-value state storage with:

1. **Hex-Prefix (Compact) Encoding**: Nibble-level path sharing with leaf/extension flags.
2. **Layer-0 Recursive Length Prefix (RLP)**: Deterministic serialization of bytes and lists.
3. **Four Node Types**: Null, Leaf, Extension, and 16-ary Branch.
4. **Dynamic Compaction**: Automatic collapsing of branches into extensions or leaves upon deletion.
5. **Cryptographic Proofs**: Standalone Merkle inclusion/exclusion proof generation and verification.

---

## 2. Functional Requirements (EARS Syntax)

**FR-229-001** (Event-Driven)
WHEN a sequence of nibbles and a leaf boolean flag are provided, THE SYSTEM SHALL encode them into
a compact hex-prefix byte buffer where the high nibble encodes parity and termination status,
AND THE SYSTEM SHALL decode that buffer back into the identical original nibbles and leaf flag.

**FR-229-002** (Event-Driven)
WHEN a key-value pair is inserted via `put(key, value)`, THE SYSTEM SHALL navigate or split existing
nodes into appropriate Branch, Extension, or Leaf nodes, AND store the value deterministically.

**FR-229-003** (Event-Driven)
WHEN a key is queried via `get(key)`, THE SYSTEM SHALL traverse the trie following the key's nibble
path AND return the associated value Buffer if present, OR `null` if the key does not exist.

**FR-229-004** (Event-Driven)
WHEN a key is removed via `delete(key)`, THE SYSTEM SHALL excise the target node AND compact any
resulting branch with a single remaining child into an Extension or Leaf node, updating the root hash.

**FR-229-005** (Ubiquitous)
THE SYSTEM SHALL provide `prove(key)` to generate an array of RLP-encoded proof nodes from root to
target, AND provide static `verifyProof(rootHash, key, proof)` to deterministically verify whether
the key holds a specific value (inclusion) or does not exist (exclusion) without requiring access
to the underlying trie database.

---

## 3. Non-Functional Requirements

- **NFR-229-A** Zero external runtime dependencies; `dependencies` in `package.json` must remain `{}`.
- **NFR-229-B** Node hashing must use standard FIPS 180-4 SHA-256 via `node:crypto`.
- **NFR-229-C** Two tries with identical key-value content inserted in different permutations must produce the exact same 32-byte root hash.
- **NFR-229-D** Time complexity for `get`, `put`, `delete`, and `prove` must be bounded by $O(K)$ where $K$ is key nibble length.
- **NFR-229-E** Proof verification must execute in under 5 milliseconds.

---

## 4. BDD Acceptance Scenarios

### BDD-1164 — Hex-Prefix (Compact) Path Encoding Round-Trip

```gherkin
SCENARIO: Hex-prefix encoding preserves nibbles and termination flag across parity variations
  GIVEN nibble sequences of odd and even lengths for both leaf and extension nodes
  WHEN encoded using compact hex-prefix encoding
  THEN decoding the buffer MUST recover the exact original nibble array
  AND the isLeaf boolean flag MUST match the original
```

### BDD-1165 — Merkle Patricia Trie Put and Get State Integrity

```gherkin
SCENARIO: Common-prefix keys are stored, branched, and retrieved correctly
  GIVEN an empty Merkle Patricia Trie
  WHEN keys sharing common prefixes ("dog", "doge", "dove", "door") are inserted
  THEN every inserted key MUST return its exact corresponding value
  AND any non-existent key ("cat", "doges", "do") MUST return null
```

### BDD-1166 — Deterministic Root Hash Generation

```gherkin
SCENARIO: Permuted insertion orders produce identical root hashes
  GIVEN two independent Merkle Patricia Tries
  WHEN the same set of key-value pairs is inserted in different orders
  THEN both tries MUST yield the identical 32-byte cryptographic root hash
```

### BDD-1167 — Cryptographic Merkle Inclusion Proof Generation & Verification

```gherkin
SCENARIO: Merkle proofs are verified independently without the trie
  GIVEN a trie populated with multiple state entries
  WHEN prove(key) is invoked for an existing key
  THEN verifyProof(rootHash, key, proof) MUST return the exact value
  AND verification with a corrupted proof or mismatched root MUST fail
```

### BDD-1168 — Key Deletion and Structural Compaction

```gherkin
SCENARIO: Deletion removes key and collapses branch nodes
  GIVEN a trie with keys "test" and "team" sharing prefix "te"
  WHEN "team" is deleted
  THEN get("team") MUST return null
  AND get("test") MUST continue to return its valid value
  AND the root node MUST be compacted into a single leaf node
```
