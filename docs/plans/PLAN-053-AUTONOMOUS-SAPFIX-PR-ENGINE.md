# PLAN-053: Autonomous SapFix PR & Auto-Merge Engine Architecture Plan

**Specification**: SPEC-060  
**Status**: APPROVED  
**Architecture Decision Record**: ADR-065  

---

## 1. Architectural Approach
- **Ephemeral Worktree Isolation**: Uses Git worktree primitives to isolate repair branches without dirtying the working directory.
- **AST Surgical Remediation**: Reuses `EosSurgicalSelfHealingKernel` to generate targeted patches.
- **Fail-Closed Regression Barrier**: Re-runs test suites; if any pre-existing tests fail, rolls back worktree immediately.
- **Cryptographic Attestation**: Produces SHA-256 receipt persisted in `EosDurableSqliteLedger`.

## 2. Alternatives Considered & Rejected
- *In-Place Mutation on Working Directory*: Rejected because it risks corrupting active developer work without isolated rollbacks.
- *LLM Improvisation without AST Validation*: Rejected per Law I (Zero Vibe Coding).
