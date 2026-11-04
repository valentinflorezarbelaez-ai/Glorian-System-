# PLAN-154: Glorian ↔ Gentleman Gentle-AI Co-Governance Bind

## ADR-0193: Align Gentle AI on preferred ensure, do not fork binaries

- **Decision**: Call `EosGentlemanStackBridge.auditStack` during `ensurePreferredIdeSession` and persist a compact `gentlemanAlignment` blob on `.eos/state/agent-sessions.json`. SessionStart injects `CO_GOVERNANCE_PROTOCOL`.
- **Rejected**: Re-implementing Engram/GGA inside Glorian Layer-0. Glorian gates; Gentle AI remembers, routes ODD, and reviews.
- **Rejected**: Making `eos_gentleman_audit` a mandatory DAG tool on every micro-edit (too heavy). Alignment is advisory + injected; write gate remains the SPEC-152 MCP DAG.
