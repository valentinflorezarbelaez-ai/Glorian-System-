# SPEC-218: Layer-0 Sparse Merkle Tree (SMT) with Non-Membership Proofs Core

## Status

- **Status**: APPROVED
- **Change**: `CHANGE-103`
- **Architecture Decision Record**: `ADR-103`
- **Applicable Standards**: IEEE 830 EARS, ISO/IEC/IEEE 29148 BDD, Dahlberg et al. (2016), RFC 6962, EOS Inviolable Laws I-VII

---

## Functional Requirements (EARS)

### FR-1109 (Ubiquitous - 256-Bit Binary Trie Geometry & Empty Subtree Caching)

THE SYSTEM SHALL implement a 256-level binary radix trie where each leaf is positioned at the 256-bit path determined by $\text{path} = \text{SHA256}(key)$, precomputing and caching default empty node hashes $Z_d$ for each depth $d \in [0, 256]$ where $Z_0 = \text{SHA256}(\text{"eos-smt-empty"})$ and $Z_{d+1} = \text{SHA256}(\text{"eos-smt-node:"} \,\|\, Z_d \,\|\, Z_d)$, enabling $O(1)$ representation of unpopulated subtrees without explicit node allocation.

### FR-1110 (State-Driven - Key-Value Ingestion, Update & Deletion)

WHEN a key-value pair $(k, v)$ is inserted or updated, THE SYSTEM SHALL traverse the 256-bit path, compute leaf hash $H_{\text{leaf}} = \text{SHA256}(\text{"eos-smt-leaf:"} \,\|\, path \,\|\, \text{SHA256}(v))$, update sibling nodes upwards along the path, and recompute the canonical root hash $R \in \{0, 1\}^{256}$. WHEN a key is deleted ($v = \text{null}$), THE SYSTEM SHALL collapse the path back to the canonical empty node $Z_d$.

### FR-1111 (Event-Driven - Succinct Membership Proof Generation & Fast Verification)

WHEN requested for an existing key $k$, THE SYSTEM SHALL generate a membership proof comprising the leaf path, leaf value hash, and the list of sibling hashes $S = [s_0, s_1, \dots, s_{depth-1}]$ along its path. THE VERIFIER SHALL reconstruct the root by folding siblings according to the path bits and return `VALID` if and only if the reconstructed hash matches the claimed SMT root in $\le 1$ millisecond.

### FR-1112 (Event-Driven - Succinct Non-Membership (Exclusion) Proof Generation)

WHEN requested for a non-existent key $k$, THE SYSTEM SHALL generate an exclusion proof verifying either (a) that the leaf path terminates at a default empty subtree $Z_d$, or (b) that another key with divergent path shares the common prefix. THE VERIFIER SHALL evaluate the proof and return `VALID_NON_MEMBER` if and only if the key is provably absent from the authenticated state.

### FR-1113 (Ubiquitous - Execution Receipts, Frontier Dispatch & CLI/MCP Interface)

THE SYSTEM SHALL emit an immutable SHA-256 execution receipt for each trie mutation and proof verification, and expose CLI commands `smt:set`, `smt:prove`, `smt:verify` and MCP actions `smt_set`, `smt_prove`, `smt_verify`.

---

## BDD Scenarios

### BDD-1109: 256-Level Radix Trie Invariants and Empty Subtree Caching

GIVEN an empty Sparse Merkle Tree of depth 256
WHEN the root hash is requested
THEN the root hash MUST equal the precomputed default empty root $Z_{256}$
AND memory allocation for the empty tree MUST be $O(1)$ with 0 dynamic nodes.

### BDD-1110: Deterministic State Commitment and Non-Destructive Mutations

GIVEN two empty Sparse Merkle Trees
WHEN identical sets of 10 key-value pairs are inserted in different permutations
THEN both trees MUST yield the exact same 256-bit canonical root hash
AND WHEN a key is updated with a new value
THEN the root hash MUST change deterministically and previous node references MUST remain immutable.

### BDD-1111: Fast Membership Proof Generation and Verification

GIVEN a Sparse Merkle Tree populated with 50 key-value pairs
WHEN an inclusion proof is generated for key `"account:user-001"`
THEN the proof MUST verify as `VALID` against the current root in $\le 1$ millisecond
AND WHEN the value or any sibling in the proof is altered
THEN verification MUST return `FALSE` immediately.

### BDD-1112: Cryptographic Proof of Non-Membership (Exclusion Proofs)

GIVEN a Sparse Merkle Tree containing active certificates
WHEN an exclusion proof is requested for revoked key `"cert:revoked-042"` that does not exist in the state
THEN the proof MUST return type `"NON_MEMBERSHIP"`
AND verification against the root MUST confirm with mathematical certainty that the key is absent from the state.

### BDD-1113: Frontier CLI and MCP Dispatch

GIVEN the Glorian CLI and MCP control plane
WHEN `glorian smt:set --key="tenant-alpha" --value="active" --json` is invoked
THEN the command MUST update the SMT, print new root hash, and output a valid SHA-256 receipt.
