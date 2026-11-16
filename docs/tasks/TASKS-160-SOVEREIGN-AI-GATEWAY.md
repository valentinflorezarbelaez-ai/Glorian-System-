# TASKS-160: Sovereign Multi-Model AI Gateway & Adversarial Consensus Engine

- **Tasks ID**: `TASKS-160`
- **Change ID**: `CHANGE-160`
- **Spec Reference**: `SPEC-298`
- **Tier**: Edge Coordination, Frontier AI Routing & Cognitive Consensus
- **Status**: `READY`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-15T22:15:00Z

---

## Task Dependency Graph (DAG)

```text
[TASK-160-01: Types Definition]
       │
       ▼
[TASK-160-02: Core Gateway Engine Implementation]
       │
       ▼
[TASK-160-03: Core Re-export & Typecheck]
       │
       ▼
[TASK-160-04: CLI Subdispatcher Implementation]
       │
       ▼
[TASK-160-05: CLI Router & Catalog Registration]
       │
       ▼
[TASK-160-06: Test Suite (BDD-1563..BDD-1568)]
       │
       ▼
[TASK-160-07: Tip Refresh & Pre-Push Gate Sealing]
```

---

## Detailed Task Breakdown

### TASK-160-01: Types Definition

- Create `src/core/eosSovereignAiGateway.types.ts`.
- Define `ModelProviderId`, `TaskIntentCategory`, `ModelRouteConfig`, `CircuitState`, `ConsensusStatus`.
- Define `ConsensusSession`, `SemanticCacheEntry`, `GatewayMetrics`, and `AiGatewayReceipt`.
- Done Criteria: Clean compilation under `tsc --noEmit`.

### TASK-160-02: Core Gateway Engine Implementation

- Create `src/core/eosSovereignAiGateway.ts`.
- Implement `SovereignAiGateway` class:
  - Intent-based routing with cost & latency priority.
  - Dual-model adversarial consensus runner with invariant checks against `ARCHITECTURE-S0.md`.
  - Circuit breaker manager (`CLOSED`, `OPEN`, `HALF_OPEN`) with failover to secondary provider.
  - Semantic prompt vector cache matching cosine similarity $\ge 0.96$ in $< 5$ ms.
  - Token and spend accounting ledger.
  - Evidence audit receipt generation at `docs/evidence/AI_GATEWAY_RECEIPT.json`.
- Done Criteria: Module $\le 450$ lines, zero runtime dependencies.

### TASK-160-03: Core Re-export & Typecheck

- Export types and engine in `src/core/index.ts`.
- Run `npm run typecheck`.
- Done Criteria: Exit code 0, 0 type errors.

### TASK-160-04: CLI Subdispatcher Implementation

- Create `bin/commands/cliAiGateway.mjs`.
- Implement commands:
  - `toolchain:gateway:route`
  - `toolchain:gateway:consensus`
  - `toolchain:gateway:circuit`
  - `toolchain:gateway:audit`
- Done Criteria: Functional execution returning formatted JSON and human summary.

### TASK-160-05: CLI Router & Catalog Registration

- Wire `toolchain:gateway:` in `bin/commands/cliToolchainRouter.mjs`.
- Register in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md`.
- Run `node bin/eos.mjs hygiene:audit`.
- Done Criteria: 100.00% command parity verified.

### TASK-160-06: Test Suite (BDD-1563..BDD-1568)

- Create `test/eosSovereignAiGateway.test.mjs`.
- Verify scenarios BDD-1563 through BDD-1568.
- Run `node --test test/eosSovereignAiGateway.test.mjs`.
- Done Criteria: 100% tests passing, exit code 0.

### TASK-160-07: Tip Refresh & Pre-Push Gate Sealing

- Run `node scripts/tip-refresh.mjs` to synchronize active spec count (298) and test count (290).
- Format files with prettier.
- Seal freeze pin and push to `origin/main`.
- Done Criteria: All CI gates pass cleanly.
