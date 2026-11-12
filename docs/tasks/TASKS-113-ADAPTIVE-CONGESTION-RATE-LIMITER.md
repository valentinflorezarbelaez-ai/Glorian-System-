# TASKS-113 — Layer-0 Adaptive AIMD Congestion Control Rate Limiter

## Metadata

- **Tasks ID**: TASKS-113
- **Plan ID**: PLAN-113
- **SPEC ID**: SPEC-228
- **Status**: IN_PROGRESS
- **Date**: 2026-11-12

## Atomic Task DAG

```
T-01 (Types)
  └─► T-02 (SlidingHdrHistogram + Core impl)
        └─► T-03 (CLI handler)
        └─► T-04 (MCP wire-up)
        └─► T-05 (Barrel + subpath exports)
        └─► T-06 (Test suite BDD-1159..BDD-1163)
              └─► T-07 (Facade test step #40)
        └─► T-08 (DEVELOPER_GUIDE Module 43)
        └─► T-09 (tip-refresh + catalog regen)
              └─► T-10 (typecheck + test run)
                    └─► T-11 (format + git commit)
                          └─► T-12 (seal-pin commit)
                                └─► T-13 (fleet:audit-all)
                                      └─► T-14 (Engram save)
```

## Task Checklist

- [ ] **T-01**: Create `src/core/eosAdaptiveCongestionRateLimiterCore.types.ts`
  - Done: File exists with `AdmissionDecision`, `RateLimiterConfig`, `RateLimiterStats`, `SampleEntry`
- [ ] **T-02**: Create `src/core/eosAdaptiveCongestionRateLimiterCore.ts`
  - Done: `SlidingHdrHistogram` + `EosAdaptiveCongestionRateLimiterCore` with `admit()`, `complete()`, `stats()`
- [ ] **T-03**: Create `bin/commands/cliCongestionMesh.mjs`
  - Done: `congestion:admit`, `congestion:complete`, `congestion:stats` handlers
- [ ] **T-04**: Wire `cliPlatform.mjs` and `eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
- [ ] **T-05**: Add barrel exports to `src/core/index.ts` and subpath to `package.json`
- [ ] **T-06**: Create `test/eosAdaptiveCongestionRateLimiterCore.test.mjs` — BDD-1159..BDD-1163
- [ ] **T-07**: Add step #40 to `test/eosEnterpriseFacade.test.mjs`
- [ ] **T-08**: Add Module 43 section to `docs/DEVELOPER_GUIDE.md`
- [ ] **T-09**: Run `node scripts/tip-refresh.mjs`, regenerate catalog
- [ ] **T-10**: `npm run typecheck` exit 0; `node --test test/eosAdaptiveCongestionRateLimiterCore.test.mjs` 5/5; facade 9/9; consistency 5/5
- [ ] **T-11**: `npm run format` + `git add . && git commit`
- [ ] **T-12**: `node scripts/tip-refresh.mjs --seal-pin` + format + commit
- [ ] **T-13**: `node bin/eos.mjs fleet:audit-all` → 9/9 A+
- [ ] **T-14**: Save to Engram
