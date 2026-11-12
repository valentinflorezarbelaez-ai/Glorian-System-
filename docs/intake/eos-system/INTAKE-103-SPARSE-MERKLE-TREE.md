# INTAKE-103: Layer-0 Sparse Merkle Tree (SMT) with Non-Membership Proofs Core

## Metadata

- **Intake ID**: `INTAKE-103`
- **Target Component**: `eos-system-control-plane`
- **Feature Title**: Layer-0 Sparse Merkle Tree (SMT) with Cryptographic Non-Membership Proofs
- **Author**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Status**: APPROVED
- **Date**: 2026-11-11
- **Governing Specs**: `SPEC-218`
- **Change Reference**: `CHANGE-103`
- **Plan Reference**: `PLAN-103`
- **Tasks Reference**: `TASKS-103`

---

## 1. Problem Statement

Standard Merkle trees and Merkle Mountain Ranges (MMRs) efficiently prove that an element is part of an append-only log ($O(\log n)$ inclusion proofs). However, decentralized state registries, revocation lists (CRLs), identity claim verification, and distributed key-value stores urgently require the ability to prove **absence** (non-membership / exclusion) with cryptographic certainty.

Without Sparse Merkle Trees, proving that a certificate or token has NOT been revoked requires downloading the entire revocation list or traversing complete sorted tree ranges.

A 256-bit Sparse Merkle Tree solves this universally: the keyspace comprises $2^{256}$ indexed leaves. By exploiting default empty subtree hashes, an SMT provides:

1. Constant memory footprint for sparse states.
2. Collision-resistant 256-bit root commitment over arbitrary key-value sets.
3. Succinct $O(\log n)$ cryptographic membership proofs.
4. Succinct cryptographic **non-membership (exclusion) proofs** that verify a key is provably absent from the tree.

## 2. Requirements & Inviolable Constraints

1. **Zero External Runtime Dependencies (EOS Law V)**: Pure TypeScript using Node 24 native SHA-256 and bitwise path traversal.
2. **Precomputed Empty Subtree Caching**: Constant-time retrieval of empty node hashes $Z_0 \dots Z_{256}$.
3. **Sub-millisecond Verification**: Verification of both membership and non-membership proofs in $\le 1$ ms.
4. **Deterministic Root Hashing**: Identical key-value sets must yield identical root hashes regardless of insertion order.
5. **Module Line Count Limit**: Strictly $\le 800$ lines.
