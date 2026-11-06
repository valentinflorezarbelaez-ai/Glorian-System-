# TASKS-058: Byzantine Fault Tolerant (BFT) Agent Swarm & Slashing Hypervisor Task DAG

**Specification**: SPEC-065  
**Change Reference**: CHANGE-058  
**Status**: DONE  

---

## 1. Task Breakdown
- [x] **TASK-058-1**: Formalize SPEC-065 with EARS requirements (FR-225 to FR-230) and BDD scenarios (BDD-196 to BDD-198).
- [x] **TASK-058-2**: Specify formal TLA+ mathematical model `docs/formal/BftAgentSwarmSlashing.tla` and verify with bounded simulation.
- [x] **TASK-058-3**: Implement `EosBftAgentSwarmSlashing` in `src/core/eosBftAgentSwarmSlashing.ts`.
- [x] **TASK-058-4**: Create test suite `test/eosBftAgentSwarmSlashing.test.mjs` verifying supermajority consensus, security veto, and quadratic slashing.
- [x] **TASK-058-5**: Implement CLI command `eos swarm` in `bin/eos.mjs`.
- [x] **TASK-058-6**: Expose MCP tool `eos_bft_swarm_consensus` in `src/mcp/eosMcpServer.ts`.
