# CHANGE-091: Layer-0 Distributed Raft Consensus Engine with Replicated FSM (SPEC-206)

- **Change ID**: `CHANGE-091`
- **Spec**: `SPEC-206`
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez
- **Status**: APPROVED

---

## Proposed Changes

1. **New Core Engine**:
   - `src/core/eosRaftConsensusEngine.ts`:
     - Class `EosRaftNode`:
       - `handleRequestVote(args: RequestVoteArgs): RequestVoteReply`
       - `handleAppendEntries(args: AppendEntriesArgs): AppendEntriesReply`
       - `startElection(): void`
       - `propose(command: unknown): RaftLogEntry | null`
       - `applyCommittedEntries(): number`
       - `createSnapshot(): RaftSnapshot`
     - Class `EosRaftCluster`:
       - `createCluster(nodeIds: string[]): EosRaftCluster`
       - `proposeCommand(command: unknown): RaftProposalResult`
       - `simulateTick(): void`
       - `partition(groupA: string[], groupB: string[]): void`
       - `healPartition(): void`
       - `getClusterStatus(): RaftClusterStatus`
2. **Package Exports**:
   - Add `"./raft": "./src/core/eosRaftConsensusEngine.ts"` in `package.json`.
   - Export in `src/core/index.ts`.
3. **CLI Commands**:
   - `glorian raft:cluster [--nodes=N] [--propose=CMD] [--json]`
   - `glorian raft:status`
   - Alias: `glorian raft:consensus`.
4. **MCP Actions**:
   - `action: "raft_cluster"`
   - `action: "raft_propose"`
5. **Testing**:
   - `test/eosRaftConsensusEngine.test.mjs` (BDD-1049..BDD-1053).
   - Integration in `test/eosEnterpriseFacade.test.mjs` (step #18).
