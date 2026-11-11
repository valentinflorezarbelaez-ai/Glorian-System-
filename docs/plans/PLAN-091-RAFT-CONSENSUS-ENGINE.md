# PLAN-091: Layer-0 Distributed Raft Consensus Engine with Replicated FSM (SPEC-206)

## Architectural Approach

1. **Node Lifecycle & Roles**:
   - `RaftRole`: `"FOLLOWER" | "CANDIDATE" | "LEADER"`.
   - Node variables:
     - `nodeId`: string identifier
     - `currentTerm`: integer term counter (persisted)
     - `votedFor`: string | null (persisted)
     - `log`: array of `RaftLogEntry` `{ index, term, command, checksum }`
     - `commitIndex`: highest known committed entry
     - `lastApplied`: highest entry applied to state machine
     - `fsmState`: replicated state dictionary `Record<string, unknown>`

2. **Leader Tracking**:
   - `nextIndex: Map<string, number>` (index of next log entry to send)
   - `matchIndex: Map<string, number>` (highest entry known to be replicated)

3. **Message Passing & Simulation Transport**:
   - `RaftMessage`: tagged envelope with sender, receiver, and RPC payload.
   - `EosRaftCluster`:
     - Dispatches RPCs directly between nodes in-memory.
     - Simulates network partitions by isolating subnet groups.
     - Simulates clock ticks to drive election timeouts and leader heartbeats.

4. **Quorum & Commit Logic**:
   - Entry committed when `matchIndex` on a majority of nodes is $\ge N$.
   - Leader applies committed entries to its local state machine and advances `commitIndex` in next heartbeat.

5. **Integrations**:
   - Subpath export `"./raft"` in `package.json` and export in `src/core/index.ts`.
   - CLI commands `raft:cluster` and `raft:status` in `bin/commands/cliPlatform.mjs` & help in `bin/commands/cliKernel.mjs`.
   - MCP actions `raft_cluster` and `raft_propose` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
   - Test suite `test/eosRaftConsensusEngine.test.mjs` (BDD-1049..BDD-1053).
   - Facade test step 18 in `test/eosEnterpriseFacade.test.mjs`.
