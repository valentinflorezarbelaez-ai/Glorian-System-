# INTAKE-101: Layer-0 Merkle Mountain Range (MMR) & Cryptographic Accumulator Engine (SPEC-216)

## 1. Context & Motivation

Immutable append-only ledgers, blockchain state commitments, lightweight client verification, and audit trail attestation encounter major efficiency bottlenecks when using standard balanced Merkle Trees:

1. **Re-hashing Overhead on Append**: Standard balanced Merkle Trees require recalculating hashes from leaf to root across $O(\log n)$ levels and rebalancing when node counts are not powers of two, modifying internal hashes on every append.
2. **Heavy Historical Proofs**: Verifying historical commitments in standard trees requires maintaining or re-transmitting extensive witness paths, consuming high bandwidth in resource-constrained IoT, edge, or peer-to-peer nodes.
3. **Impossibility of Dynamic Pruning**: In high-throughput streaming environments (e.g. state transitions, financial transactions, telemetry logs), verifying whether an old entry was part of a historical state requires retaining the entire tree structure.

A **Merkle Mountain Range (MMR)** (Todd 2012, Crosby & Wallach 2009) solves these challenges through an append-only sequence of complete binary trees (mountains) arranged by decreasing peak heights corresponding to the binary representation of the leaf count:

1. **Strictly Append-Only**: New leaves are appended without modifying any existing internal nodes or previous peaks.
2. **Logarithmic Peaks ("Bag-of-Peaks")**: The entire structure is committed to a single root by hashing the list of peaks together with the total leaf count.
3. **Succinct Inclusion Proofs**: Proving leaf membership requires only $O(\log n)$ sibling hashes along the mountain to its peak, followed by peak-to-root resolution.
4. **Logarithmic Consistency Proofs**: Proving that an older MMR of size $M$ is an authentic, un-tampered prefix of a larger MMR of size $N$ requires only $O(\log N)$ peak evaluations without revealing intermediate leaves.
5. **Verifiable Historical Pruning**: Unneeded older leaf payloads can be safely pruned while preserving their peak hashes, allowing lightweight nodes to verify new commitments with minimal memory.

External MMR libraries introduce C++, Rust, or heavy npm dependencies violating EOS Law V (Zero External Runtime Dependencies).

Glorian requires a self-contained Layer-0 implementation of:

1. **Deterministic 1-Based or 0-Based Position Indexing**: Bitwise mathematical operations calculating node height, parent, left child, right child, and peak status in $O(1)$.
2. **Append-Only Leaf Ingestion Engine**: Automatic climbing and merging of complete binary subtrees upon appending new leaves.
3. **Bag-of-Peaks Root Accumulator**: Calculating the canonical MMR root commitment $R = \text{SHA256}(\text{size} \,\|\, p_1 \,\|\, p_2 \,\|\, \dots \,\|\, p_k)$.
4. **Succinct Inclusion Proofs**: Generating and verifying $O(\log n)$ opening proofs for arbitrary leaf indices.
5. **Prefix Consistency Proofs**: Proving that state at size $n_1$ is an authentic prefix of state at size $n_2$.
6. **Immutable SHA-256 Execution Receipts**: Emitting cryptographically verifiable receipts for each append, proof generation, and verification.

## 2. Inviolable Architectural Constraints

- **Zero External Runtime Dependencies (Law V)**: Pure Node 24 strip-only TypeScript using only `node:crypto` and core primitives.
- **Node Ceiling (Law VII)**: Zero modules exceeding 800 lines; types factored into a companion `.types.ts` file.
- **Constant $O(1)$ Bit-Manipulation Math**: Peak detection and sibling traversal using bitwise arithmetic without tree rebalancing.
- **Subpath, CLI & MCP First-Class Export**: Available via `./mmr` subpath, CLI `mmr:*`, and MCP `eos_enterprise_workspace` frontier actions.

## 3. Deliverables

1. `openspec/changes/CHANGE-101-MERKLE-MOUNTAIN-RANGE.md`
2. `openspec/specs/SPEC-216-MERKLE-MOUNTAIN-RANGE.md` (FR-1099..FR-1103, BDD-1099..BDD-1103)
3. `docs/plans/PLAN-101-MERKLE-MOUNTAIN-RANGE.md`
4. `docs/tasks/TASKS-101-MERKLE-MOUNTAIN-RANGE.md`
5. `src/core/eosMerkleMountainRangeCore.types.ts` & `src/core/eosMerkleMountainRangeCore.ts`
6. `test/eosMerkleMountainRangeCore.test.mjs` (BDD-1099..BDD-1103)
7. CLI integration in `bin/commands/cliMmrMesh.mjs` (`mmr:append`, `mmr:prove`, `mmr:verify`)
8. MCP tool integration in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`
9. Enterprise facade step #28 in `test/eosEnterpriseFacade.test.mjs`
10. Documentation in `docs/DEVELOPER_GUIDE.md` (Módulo 31) and OpenSpec catalog update (211 specs)
