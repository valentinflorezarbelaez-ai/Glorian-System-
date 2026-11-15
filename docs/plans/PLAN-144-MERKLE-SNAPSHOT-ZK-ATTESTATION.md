# Architecture Plan: PLAN-144 — Zero-Knowledge State Attestation & Merkle Tree Snapshot Governor

- **Change Reference**: `CHANGE-144`
- **Spec Reference**: `SPEC-282`
- **Intake Reference**: `INTAKE-144`
- **Target**: `src/core/eosMerkleSnapshotGovernor.ts`
- **Date**: 2026-11-15

---

## 1. Architectural Strategy

We implement a zero-dependency, high-throughput Merkle Tree engine in pure Layer-0 TypeScript.

### Cryptographic Domain Separation

To protect against second-preimage collision attacks (CVE-standard attack where an intermediate interior node hash is presented as a leaf hash):

- Leaf hash: $\text{SHA-256}(0x00 \parallel \text{data})$
- Interior node hash: $\text{SHA-256}(0x01 \parallel \text{leftHash} \parallel \text{rightHash})$

### Perfect Binary Tree Representation

When leaf count $N$ is not a power of 2, the rightmost leaf is duplicated at each level up to the root, guaranteeing a balanced binary tree of depth $\lceil \log_2 N \rceil$.

### Inclusion Proof Structure

```typescript
export interface MerkleProofStep {
  position: "LEFT" | "RIGHT";
  siblingHash: string;
}

export interface MerkleInclusionProof {
  leafIndex: number;
  leafHash: string;
  rootHash: string;
  proof: MerkleProofStep[];
}
```

### Modular CLI Architecture

To ensure `bin/commands/cliDevOps.mjs` remains well within the 800-line ceiling (current line count: 760, headroom: 40), we create a dedicated modular command handler `bin/commands/cliMerkleSnapshot.mjs` and delegate cleanly with under 10 lines added to `cliDevOps.mjs`.
