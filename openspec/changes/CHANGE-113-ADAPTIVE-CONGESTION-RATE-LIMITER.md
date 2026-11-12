# CHANGE-113 — Layer-0 Adaptive AIMD Congestion Control Rate Limiter

## Metadata

- **Change ID**: CHANGE-113
- **SPEC ID**: SPEC-228
- **Intake ID**: INTAKE-113
- **Status**: APPROVED
- **Date**: 2026-11-12
- **Author**: EOS Engineering System

## Intent

Introduce `EosAdaptiveCongestionRateLimiterCore` — a closed-loop, latency-aware rate limiter
that combines a Token Bucket with AIMD congestion control and a sliding-window P99 latency
histogram estimator. Operates entirely within Layer-0 (zero external runtime dependencies).

## Motivation

The existing `eosAdaptiveRateLimiter` and `eosTokenBucketRateLimiter` modules lack a P99
feedback loop. Under sustained tail-latency pressure the system has no mechanism to multiplicatively
back off admission rate, causing cascade failures. AIMD is the proven algorithm used by TCP
congestion control and modern distributed rate limiters (CoDel, BBR) for fast convergence
under congestion and fair additive recovery.

## Scope of Change

| File                                                         | Action                       |
| ------------------------------------------------------------ | ---------------------------- |
| `src/core/eosAdaptiveCongestionRateLimiterCore.types.ts`     | CREATE — Type definitions    |
| `src/core/eosAdaptiveCongestionRateLimiterCore.ts`           | CREATE — Core implementation |
| `test/eosAdaptiveCongestionRateLimiterCore.test.mjs`         | CREATE — BDD-1159..BDD-1163  |
| `bin/commands/cliCongestionMesh.mjs`                         | CREATE — CLI handlers        |
| `bin/commands/cliPlatform.mjs`                               | MODIFY — Import + dispatch   |
| `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts` | MODIFY — MCP actions         |
| `src/core/index.ts`                                          | MODIFY — Barrel exports      |
| `package.json`                                               | MODIFY — Subpath exports     |
| `docs/DEVELOPER_GUIDE.md`                                    | MODIFY — Module 43 section   |
| `docs/specs/openspec-catalog-index.json`                     | REGENERATE — 223 specs       |
| `openspec/specs/SPEC-228-*`                                  | CREATE — Formal spec         |
| `docs/releases/EOS_FREEZE_GATE_STATUS.md`                    | UPDATE — via tip-refresh     |

## Risk Assessment

- **LOW**: Pure algorithmic module, no I/O, no external deps.
- **MITIGATED**: Sliding histogram uses fixed 1024 buckets; no dynamic allocation after init.
- **TESTED**: All 5 BDD scenarios cover deterministic paths (no random input needed).

## Rollback Plan

Revert commit. No schema migrations, no external state.
