# CHANGE-101: Layer-0 Merkle Mountain Range (MMR) & Cryptographic Accumulator Engine

## 1. Problem Statement

Immutable append-only event logging, cryptographic audits, and light-client state proofs in Glorian currently rely on static Merkle trees or linear hash chains. Static trees require complete re-balancing and re-hashing of internal nodes on every append, while linear chains require $O(n)$ verification costs. External MMR libraries introduce heavy C++ or Rust toolchains, violating EOS Law V (Zero External Runtime Dependencies).

## 2. Proposed Solution

Implement `EosMerkleMountainRangeCore` (`src/core/eosMerkleMountainRangeCore.ts`), an append-only logarithmic accumulator based on Peter Todd's Merkle Mountain Range architecture using pure Node 24 strip-only TypeScript and `node:crypto`.
Key capabilities:

- **Strict Append-Only Ingestion**: Append leaves in $O(\log n)$ operations without modifying existing historical nodes.
- **Bitwise Positional Algebra**: Constant-time $O(1)$ calculations of node height, parent position, sibling index, and peak identification using bit shifts and binary popcounts.
- **Bag-of-Peaks Root Commitment**: Canonical root hash derived from the ordered list of peaks: $R = \text{SHA256}(\text{size} \,\|\, p_1 \,\|\, p_2 \,\|\, \dots \,\|\, p_k)$.
- **Succinct $O(\log n)$ Inclusion Proofs**: Generating and validating membership proofs from any leaf index to the canonical MMR root.
- **Prefix Consistency Proofs**: Proving that an older MMR state is a verified prefix of a newer state using only $O(\log n)$ peak evaluations.
- **Pruning Support & Tamper-Evident Receipts**: Enabling memory-bounded light-client verification and immutable SHA-256 receipts.

## 3. Impact Assessment

- **Scope**: Layer-0 core module `src/core/eosMerkleMountainRangeCore.ts` and `src/core/eosMerkleMountainRangeCore.types.ts`.
- **Dependencies**: 0 external npm dependencies; only `node:crypto`.
- **Breaking Changes**: None. Purely additive Layer-0 capability.
- **Spec**: `SPEC-216-MERKLE-MOUNTAIN-RANGE.md`.
