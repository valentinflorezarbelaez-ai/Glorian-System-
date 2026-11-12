# CHANGE-108: Layer-0 HotStuff Pipelined BFT Consensus Core

## 1. Change Metadata

- **Change ID**: `CHANGE-108`
- **Spec ID**: `SPEC-223`
- **Author**: `user:valentin-florez-arbelaez`
- **Reviewers**: `Constitutional-Tribunal`, `EOS-Director`
- **Target Subsystem**: `src/core/eosHotStuffConsensusEngine.ts`
- **Status**: `PROPOSED`

## 2. Motivation

Fleet synchronization across untrusted network links requires Byzantine agreement resilient up to $f < n/3$ malicious or faulty nodes. Standard PBFT exhibits $O(n^2)$ view changes, while HotStuff achieves optimal linear communication $O(n)$ in all phases and provides leader rotation responsiveness without quadratic broadcasting.

## 3. Scope of Work

- Create `src/core/eosHotStuffConsensusEngine.types.ts` ($\le 800$ lines).
- Create `src/core/eosHotStuffConsensusEngine.ts` ($\le 800$ lines) with:
  - Block header, payload, and Quorum Certificate (QC) structures.
  - 3-chain pipelined commit rule (Prepare $\to$ Pre-commit $\to$ Commit $\to$ Decide).
  - High-QC tracking, Lock-QC invariant, and voting safety predicate.
  - Linear Pacemaker view-change with round-robin leader rotation.
  - Slashing condition detector for double voting and equivocation.
- Register subpath export `"./hotstuff": "./src/core/eosHotStuffConsensusEngine.ts"` in `package.json`.
- Export from `src/core/index.ts`.
- Add CLI commands `hotstuff:propose`, `hotstuff:vote`, `hotstuff:status` in `bin/commands/cliHotStuffMesh.mjs`.
- Add MCP actions `hotstuff_propose`, `hotstuff_vote`, `hotstuff_status`.
- Add test suite `test/eosHotStuffConsensusEngine.test.mjs` verifying BDD-1134..BDD-1138.
- Add facade step #35 in `test/eosEnterpriseFacade.test.mjs`.
- Update `docs/DEVELOPER_GUIDE.md`, `openspec-catalog-index.json`, `AGENTS.md`.
