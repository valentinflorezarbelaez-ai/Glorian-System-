# TASKS-114 — Layer-0 Modified Merkle Patricia Trie (MPT) Engine

## Metadata

- **Tasks ID**: TASKS-114
- **Plan ID**: PLAN-114
- **SPEC ID**: SPEC-229
- **Status**: IN_PROGRESS
- **Date**: 2026-11-12

## Atomic Task DAG

```
T-01 (Types)
  └─► T-02 (MPT Core + RLP + HexPrefix impl)
        └─► T-03 (CLI handler)
        └─► T-04 (MCP wire-up)
        └─► T-05 (Barrel + subpath exports)
        └─► T-06 (Test suite BDD-1164..BDD-1168)
              └─► T-07 (Facade test step #41)
        └─► T-08 (DEVELOPER_GUIDE Module 44)
        └─► T-09 (tip-refresh + catalog regen)
              └─► T-10 (typecheck + test run)
                    └─► T-11 (format + git commit)
                          └─► T-12 (seal-pin commit)
                                └─► T-13 (fleet:audit-all)
                                      └─► T-14 (Engram save)
```

## Task Checklist

- [ ] **T-01**: Create `src/core/eosMerklePatriciaTrieCore.types.ts`
- [ ] **T-02**: Create `src/core/eosMerklePatriciaTrieCore.ts`
- [ ] **T-03**: Create `bin/commands/cliTrieMesh.mjs`
- [ ] **T-04**: Wire `bin/commands/cliPlatform.mjs` and `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
- [ ] **T-05**: Export in `src/core/index.ts` and `package.json`
- [ ] **T-06**: Write `test/eosMerklePatriciaTrieCore.test.mjs` (BDD-1164..BDD-1168)
- [ ] **T-07**: Add step #41 to `test/eosEnterpriseFacade.test.mjs`
- [ ] **T-08**: Update `docs/DEVELOPER_GUIDE.md` (Module 44)
- [ ] **T-09**: Run `scripts/tip-refresh.mjs` + export OpenSpecs catalog
- [ ] **T-10**: `npm run typecheck` + `npm test` passing
- [ ] **T-11**: Format + Git commit for SPEC-229
- [ ] **T-12**: Seal Freeze Pin commit
- [ ] **T-13**: Verify fleet audit 9/9 A+
- [ ] **T-14**: Save architectural memory to Engram
