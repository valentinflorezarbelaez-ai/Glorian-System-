# PLAN-041 & ADR-054: AGENT TOPOLOGY COMPILER & ZERO-COPY COMMUNICATION MESH

* **Status**: `APPROVED` (`96/100` via `eos_evaluate_decision`)
* **Specification**: `SPEC-048-AGENT-TOPOLOGY-ZERO-COPY-MESH.md`
* **Milestone**: `EOS v54.0.0`

---

## 1. Architectural Decision Record — ADR-054

### Context
In multi-agent systems of high scale (e.g. Google Antigravity running tens of subagents concurrently), whole-file contextual passing leads to token inflation, memory bloat, and uncoordinated file overwrites.

### Decision
Implement `EosAgentTopologyMesh` in pure Layer-0 TypeScript (`src/core/eosAgentTopologyMesh.ts`):
1. **DAG Topology Compiler**: Verifies topological sort via Kahn's algorithm or DFS back-edge detection, ensuring acyclic DAG guarantees and assigning exclusive module ownership per subagent.
2. **Circular Ring Buffer Event Mesh**: Powers of 2 circular buffer ($2^N$) with bitwise masking (`sequence & (capacity - 1)`), zero heap allocation per event, and compact payload schemas (AST delta, node ID, hash receipt).
3. **Topological Scheduler**: Enforces that node $N$ is only triggered when all dependencies have passed verification.
4. **Token Efficiency Meter**: Quantifies token reduction by comparing compact event size against raw file payload size, asserting $\ge 70\%$ reduction.

### Rejected Alternatives
- **External IPC / ZeroMQ / Redis**: Rejected under Law V (0 external runtime dependencies in Layer-0).
- **Unstructured file-passing across subagents**: Rejected due to high token cost and risk of merge collisions.
