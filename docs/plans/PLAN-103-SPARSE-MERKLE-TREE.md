# PLAN-103: Layer-0 Sparse Merkle Tree (SMT) with Non-Membership Proofs Core

## Plan Metadata

- **Plan ID**: `PLAN-103`
- **Change ID**: `CHANGE-103`
- **Spec ID**: `SPEC-218`
- **Target**: `eos-system-control-plane`
- **Author**: Valentín Flórez Arbeláez
- **Status**: APPROVED

---

## 1. Execution Architecture

1. **SMT Binary Radix Geometry**:
   - Depth: 256 levels (one bit per level from the 256-bit SHA-256 digest of key).
   - Precomputed empty hash table $Z_d$ for $d \in [0, 256]$ where $Z_0 = \text{SHA256}(\text{"eos-smt-empty"})$ and $Z_{d+1} = \text{SHA256}(\text{"eos-smt-node:"} \,\|\, Z_d \,\|\, Z_d)$.
   - Bit indexing: bit at index $i \in [0, 255]$: $(byte \gg (7 - (i \pmod 8))) \& 1$.
   - Compact node representation: `BranchNode(left, right, hash)` and `LeafNode(pathHex, key, value, valueHash, hash)`.

2. **Operations**:
   - `get(key)`: retrieves value in $O(\text{depth})$ path lookup.
   - `set(key, value)`: updates or inserts leaf node, propagates hash updates upwards to root.
   - `delete(key)`: collapses leaf node to empty subtree $Z_d$.
   - `getProof(key)`: generates either `MembershipProof` (if key exists) or `NonMembershipProof` (if key is absent).
   - `verifyProof(root, key, proof)`: verifies proof against root in $\le 1$ ms.

3. **Frontier & Integration**:
   - Subpath export `"./smt"` in `package.json` and explicit exports in `src/core/index.ts`.
   - Dedicated CLI module `bin/commands/cliSmtMesh.mjs` wired into `cliPlatform.mjs` and `cliKernel.mjs`.
   - MCP actions `smt_set`, `smt_prove`, `smt_verify` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
   - Comprehensive test suite in `test/eosSparseMerkleTreeCore.test.mjs`.
