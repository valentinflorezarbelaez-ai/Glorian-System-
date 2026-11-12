# TASKS-115 — Layer-0 Cryptographic Time-Lock Puzzle Engine

## Metadata

- **Tasks ID**: TASKS-115
- **Plan ID**: PLAN-115
- **SPEC ID**: SPEC-230
- **Status**: IN_PROGRESS
- **Date**: 2026-11-12

## Atomic Task DAG

```
T-01 (Types)
  └─► T-02 (RSW96 + Sloth Core impl)
        └─► T-03 (CLI handler)
        └─► T-04 (MCP wire-up)
        └─► T-05 (Barrel + subpath exports)
        └─► T-06 (Test suite BDD-1169..BDD-1173)
              └─► T-07 (Facade test step #42)
        └─► T-08 (DEVELOPER_GUIDE Module 45)
        └─► T-09 (tip-refresh + catalog regen)
              └─► T-10 (typecheck + test run)
                    └─► T-11 (format + git commit)
                          └─► T-12 (seal-pin commit)
                                └─► T-13 (fleet:audit-all)
                                      └─► T-14 (Engram save)
```

## Task Checklist

- [ ] **T-01**: Create `src/core/eosTimeLockPuzzleCore.types.ts`
- [ ] **T-02**: Create `src/core/eosTimeLockPuzzleCore.ts`
- [ ] **T-03**: Create `bin/commands/cliTimeLockMesh.mjs`
- [ ] **T-04**: Wire `bin/commands/cliPlatform.mjs` and `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
- [ ] **T-05**: Export in `src/core/index.ts` and `package.json`
- [ ] **T-06**: Write `test/eosTimeLockPuzzleCore.test.mjs` (BDD-1169..BDD-1173)
- [ ] **T-07**: Add step #42 to `test/eosEnterpriseFacade.test.mjs`
- [ ] **T-08**: Update `docs/DEVELOPER_GUIDE.md` (Module 45)
- [ ] **T-09**: Run `scripts/tip-refresh.mjs` + export OpenSpecs catalog
- [ ] **T-10**: `npm run typecheck` + `npm test` passing
- [ ] **T-11**: Format + Git commit for SPEC-230
- [ ] **T-12**: Seal Freeze Pin commit
- [ ] **T-13**: Verify fleet audit 9/9 A+
- [ ] **T-14**: Save architectural memory to Engram
