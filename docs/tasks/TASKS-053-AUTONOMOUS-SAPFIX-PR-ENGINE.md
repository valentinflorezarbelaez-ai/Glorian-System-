# TASKS-053: Autonomous SapFix PR & Auto-Merge Engine Task DAG

**Specification**: SPEC-060  
**Change Reference**: CHANGE-053  
**Status**: DONE  

---

## 1. Task Breakdown
- [x] **TASK-053-1**: Formalize SPEC-060 with EARS requirements (FR-195 to FR-200) and BDD scenarios (BDD-185 to BDD-187).
- [x] **TASK-053-2**: Implement `EosSapFixAutoshipper` in `src/core/eosSapFixAutoshipper.ts` with zero external dependencies.
- [x] **TASK-053-3**: Create test suite `test/eosSapFixAutoshipper.test.mjs` verifying worktree isolation, surgical remediation, zero regression, and fail-closed rollback.
- [x] **TASK-053-4**: Implement CLI interface `eos sapfix` in `bin/eos.mjs`.
- [x] **TASK-053-5**: Integrate MCP tool `eos_sapfix_autoshipper` in `src/mcp/eosMcpServer.ts`.
