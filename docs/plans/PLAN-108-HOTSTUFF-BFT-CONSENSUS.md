# PLAN-108: Implementation Plan for Layer-0 HotStuff Pipelined BFT Consensus Core

- **Change ID**: `CHANGE-108`
- **Spec ID**: `SPEC-223`
- **Component**: `eos-system-control-plane`
- **Owner**: `user:valentin-florez-arbelaez`
- **Target**: `src/core/eosHotStuffConsensusEngine.ts`

## 1. Phase 1: Contract-Driven Architecture & Types

- Define `HotStuffNodeId`, `HotStuffView`, `HotStuffBlockHash`, `HotStuffVote`, `HotStuffBlock`, `HotStuffQuorumCertificate`, `HotStuffState`, `HotStuffReceipt`.
- Ensure strict compliance with Node 24 strip-only TS (no enums, no namespaces).
- Target file: `src/core/eosHotStuffConsensusEngine.types.ts` ($\le 800$ lines).

## 2. Phase 2: Engine Implementation

- Core class `EosHotStuffConsensusEngine`:
  - `constructor(nodeId: string, clusterNodes: string[], options?: HotStuffOptions)`
  - Block creation: `createProposal(payload: any, highQC: HotStuffQuorumCertificate): HotStuffBlock`
  - Vote creation: `vote(proposal: HotStuffBlock): HotStuffVote | null`
  - Vote processing & QC assembly: `receiveVote(vote: HotStuffVote): HotStuffQuorumCertificate | null`
  - Block processing & 3-chain rule: `processBlock(block: HotStuffBlock): HotStuffCommitResult`
  - Linear Pacemaker view change: `advanceView(): HotStuffViewChangeResult`
  - Slashing & equivocation detection: `detectEquivocation(v1: HotStuffVote, v2: HotStuffVote): boolean`
- Target file: `src/core/eosHotStuffConsensusEngine.ts` ($\le 800$ lines).

## 3. Phase 3: CLI, Subpath Export & MCP Integration

- Export `"./hotstuff"` in `package.json` and in `src/core/index.ts`.
- Create `bin/commands/cliHotStuffMesh.mjs` with subcommands:
  - `hotstuff:propose`
  - `hotstuff:vote`
  - `hotstuff:status`
- Wire CLI into `cliPlatform.mjs` and `cliKernel.mjs`.
- Register MCP actions `hotstuff_propose`, `hotstuff_vote`, `hotstuff_status` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.

## 4. Phase 4: Test Suite & Quality Verification

- Create `test/eosHotStuffConsensusEngine.test.mjs` verifying BDD-1134..BDD-1138.
- Add step #35 in `test/eosEnterpriseFacade.test.mjs` (ensure file remains $\le 800$ lines).
- Run `npm run typecheck`, `npm run lint`, `npx prettier --write`.
- Regenerate catalog index (`totalSpecs: 218`) and refresh freeze gate.
- Commit, seal pin, and push to GitHub.
