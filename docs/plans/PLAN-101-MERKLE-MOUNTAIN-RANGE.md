# PLAN-101: Layer-0 Merkle Mountain Range (MMR) & Cryptographic Accumulator Engine Architecture

## 1. Architectural Intent

Establish an in-memory, zero-dependency Layer-0 Merkle Mountain Range (MMR) accumulator (`EosMerkleMountainRangeCore`). It provides append-only immutable state logging, logarithmic inclusion and consistency proofs, and lightweight client verification under the 7 Inviolable Laws of EOS.

## 2. Mathematical Foundation: Peter Todd's Binary Merkle Mountain Range

1. **Topology and Post-Order Layout**:
   In a binary MMR, nodes are indexed sequentially in post-order traversal (0-based or 1-based).
   Example for 4 leaves (7 nodes):
   ```
          2 (h=2, Peak)
        /   \
       0     1 (h=1)
      / \   / \
     0   1 2   3 (Leaves)
   Positions (1-based):
         7
        / \
       3   6
      / \ / \
     1  2 4  5
   ```
2. **Height and Position Bit-Manipulation**:
   - Leaf count $k$: Any leaf count can be uniquely written in binary:
     $$k = 2^{h_1} + 2^{h_2} + \dots + 2^{h_m} \quad (h_1 > h_2 > \dots > h_m)$$
   - Each binary digit 1 corresponds to a complete binary tree (mountain) of height $h_i$ with peak $p_i$.
   - The total number of nodes in an MMR with $k$ leaves is $2k - \text{popcount}(k)$.
   - Peak positions can be located directly in $O(\log k)$ steps by jumping across mountain sizes $(2^{h+1} - 1)$.
3. **Bag-of-Peaks Canonical Root**:
   Since an MMR generally consists of multiple peaks (unless the leaf count is a power of 2), a single canonical root is obtained by bagging the peaks together:
   $$R = \text{SHA256}(\text{size} \,\|\, p_1 \,\|\, p_2 \,\|\, \dots \,\|\, p_m)$$
   Or by folding peaks from right to left: $\text{bag} = \text{SHA256}(p_{i-1} \,\|\, \text{bag})$.
   Hashing with total leaf count ensures no collision between different tree sizes.
4. **Logarithmic Inclusion Proofs**:
   To prove leaf $L$ at position $pos$:
   - Collect sibling hashes along the path from $pos$ to the peak of its mountain (at most $h$ hashes).
   - Collect all other peak hashes $[p_1, \dots, p_{j-1}, p_{j+1}, \dots, p_m]$.
   - Total proof size: $O(\log n)$ hashes.
   - Verifier hashes $L$ with its siblings to compute peak $p_j$, then bags $p_j$ with the other peaks to verify the root.
5. **Prefix Consistency Proofs**:
   Given an MMR of size $M$ and an MMR of size $N > M$:
   - Every peak of $M$ is either a peak in $N$ or a left-subchild of a peak in $N$.
   - A consistency proof provides the minimal sibling nodes needed to reconstruct the peaks of $M$ and $N$ from common ancestor subtrees in $O(\log N)$ operations.

## 3. Layer-0 Hexagonal Isolation

- `src/core/eosMerkleMountainRangeCore.types.ts`: Pure types, node schemas, proof structures, and receipt definitions.
- `src/core/eosMerkleMountainRangeCore.ts`: Core class with DbC assertions (`assertPrecondition`, `deepFreeze`), bitwise positional math, peak computation, leaf append, inclusion/consistency provers and verifiers.
- Subpath: `"./mmr"` in `package.json`.
- CLI: `bin/commands/cliMmrMesh.mjs` (`mmr:*`).
- MCP: `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts` (`mmr_*`).

## 4. Alternative Trade-offs Considered & Rejected

- **Sparse Merkle Trees (SMT)**: Excellent for key-value maps with empty default leaves, but require fixed 256-level trees ($O(256)$ hashing per update) and large storage. MMR is strictly append-only, orders of magnitude faster ($O(\log n)$ vs 256), and compact.
- **Classic Balanced Merkle Trees**: Invalidate previous internal hashes on every leaf append. MMR never invalidates existing internal hashes.
