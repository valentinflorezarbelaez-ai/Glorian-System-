# SPEC-216: Layer-0 Merkle Mountain Range (MMR) & Cryptographic Accumulator Engine

## Status

- **Status**: APPROVED
- **Change**: `CHANGE-101`
- **Architecture Decision Record**: `ADR-101`
- **Applicable Standards**: IEEE 830 EARS, ISO/IEC/IEEE 29148 BDD, Todd (2012), RFC 6962 / Crosby & Wallach (2009), EOS Inviolable Laws I-VII

---

## Functional Requirements (EARS)

### FR-1099 (Ubiquitous - Bitwise Positional Indexing & Peak Calculation)

THE SYSTEM SHALL implement 0-based or 1-based sequential position indexing for binary Merkle Mountain Ranges, providing constant-time $O(1)$ bit-manipulation primitives to compute node height $h(pos)$, left child, right child, sibling position, and the set of peaks corresponding to the binary representation of the total leaf count without full tree traversals.

### FR-1100 (State-Driven - Append-Only Leaf Ingestion & Peak Merging)

WHEN a new leaf datum is appended, THE SYSTEM SHALL insert a new leaf node at the next position, and WHILE the previous peak has the same height as the current summit, THE SYSTEM SHALL combine the two summit hashes into a parent node at height $h+1$ by computing $\text{parent} = \text{SHA256}(pos_{\text{parent}} \,\|\, \text{leftHash} \,\|\, \text{rightHash})$, preserving all previous node hashes strictly unmodified.

### FR-1101 (Ubiquitous - Bag-of-Peaks Canonical Root Commitment)

THE SYSTEM SHALL compute the canonical MMR root hash by collecting the current mountain peaks $[p_1, p_2, \dots, p_k]$ in descending height order and evaluating the bag-of-peaks digest:
$$R = \text{SHA256}(\text{size} \,\|\, p_1 \,\|\, p_2 \,\|\, \dots \,\|\, p_k)$$
ensuring a unique, collision-resistant 256-bit commitment over the entire append-only history.

### FR-1102 (Event-Driven - Succinct Logarithmic Inclusion Proofs)

WHEN requested for a leaf at position $pos$, THE SYSTEM SHALL generate an inclusion proof comprising the $O(\log n)$ sibling hashes along its mountain to its peak, together with the list of peak hashes for the bag-of-peaks root. THE VERIFIER SHALL reconstruct the root in under 1 millisecond and return `VALID` if and only if the reconstructed digest matches the claimed MMR root.

### FR-1103 (Ubiquitous - Prefix Consistency Proofs, Receipts & Frontier Dispatch)

THE SYSTEM SHALL generate consistency proofs proving that an older MMR of size $M$ is an exact prefix of an MMR of size $N \ge M$ using $O(\log N)$ peak hashes, emit an immutable SHA-256 execution receipt for each operation, and expose CLI commands `mmr:append`, `mmr:prove`, `mmr:verify` and MCP actions `mmr_append`, `mmr_prove`, `mmr_verify`.

---

## BDD Scenarios

### BDD-1099: Bitwise MMR Positional Math and Peak Identification

GIVEN an MMR with 7 leaves (total node size = 11)
WHEN the peak positions are computed
THEN the system MUST identify peaks at heights corresponding to binary decomposition $7 = 4 + 2 + 1$
AND every node's height, parent, and sibling MUST be calculable in $O(1)$ operations.

### BDD-1100: Append-Only Invariant and Non-Destructive Mutations

GIVEN an existing MMR with $N$ elements and canonical root $R_N$
WHEN $K$ new leaves are appended
THEN all existing node positions in $[0, N-1]$ MUST remain strictly unchanged in memory
AND new internal parent nodes MUST only be created at new contiguous indices.

### BDD-1101: Bag-of-Peaks Collision-Resistant Root Calculation

GIVEN two MMRs with identical leaf sequences
WHEN bag-of-peaks roots are evaluated
THEN both roots MUST be byte-for-byte identical
AND WHEN any leaf in the sequence is mutated
THEN the bag-of-peaks root MUST change completely (avalanche effect).

### BDD-1102: Succinct Inclusion Proof Generation and Fast Verification

GIVEN an MMR with 100 appended transaction records
WHEN an inclusion proof is generated for leaf at index 42
THEN the proof path length MUST be $\le 10$ sibling hashes
AND verification against the canonical MMR root MUST complete in $\le 1$ millisecond
AND WHEN a forged leaf payload is tested
THEN verification MUST return FALSE immediately.

### BDD-1103: Prefix Consistency Verification and CLI Dispatch

GIVEN an MMR snapshot at size 50 and a later snapshot at size 100
WHEN a consistency proof is evaluated
THEN verification MUST confirm that size 50 is an authentic historical prefix of size 100
AND CLI command `glorian mmr:prove --leaf=3 --json` MUST output valid JSON with SHA-256 receipt.
