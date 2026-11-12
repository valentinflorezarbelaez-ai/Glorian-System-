# INTAKE-108: Layer-0 HotStuff Pipelined BFT Consensus Core

- **Change ID**: `CHANGE-108`
- **Spec ID**: `SPEC-223`
- **Component**: `eos-system-control-plane`
- **Proposer**: `user:valentin-florez-arbelaez`
- **Status**: `PROPOSED`
- **Priority**: `P0-CRITICAL`
- **Timestamp**: `2026-11-12T00:32:00.000Z`

## 1. Problem Statement

The Glorian System federated fleet currently utilizes PBFT (`SPEC-210`, $O(n^2)$ view change messages) and Raft (`SPEC-206`, crash fault tolerance only). When coordinating Byzantine-resilient state transitions across distributed fleet nodes, large node clusters suffer from quadratic message amplification during leader failure, leading to throughput degradation and high network latency.

## 2. Proposed Solution

Implement Layer-0 HotStuff Pipelined Byzantine Fault Tolerant (BFT) Consensus Core (`SPEC-223`) following Yin et al. (VMware Research 2019):

1. **Three-Chain Commit Rule**: A block is committed if it is supported by a 3-chain of certified ancestors with consecutive views (Prepare $\to$ Pre-commit $\to$ Commit $\to$ Decide).
2. **Linear View Change**: Communication complexity strictly bounded to $O(n)$ in both normal execution and view-change phases via Quorum Certificates (QCs).
3. **Pipelining Engine**: Every proposal serves simultaneously as the prepare phase for the current view, pre-commit for the previous view, and commit for two views prior.
4. **Pacemaker Synchronization**: Decoupled leader election and view-synchronization mechanism with deterministic round-robin fallback.
5. **Zero External Dependencies**: Pure TypeScript (Node 24 strip-only), contract-driven validation, and SHA-256 monotonic ledger receipts.

## 3. Architectural Impact

- Primary engine: `src/core/eosHotStuffConsensusEngine.ts` ($\le 800$ lines).
- Type contracts: `src/core/eosHotStuffConsensusEngine.types.ts` ($\le 800$ lines).
- Universal CLI commands: `eos hotstuff:propose`, `eos hotstuff:vote`, `eos hotstuff:commit`, `eos hotstuff:status`.
- MCP tools: actions `hotstuff_propose`, `hotstuff_vote`, `hotstuff_status`.
