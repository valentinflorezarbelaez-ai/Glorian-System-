# TASKS-110: Implementation Checklist for Layer-0 Universal Federated Cross-Fleet Sync & Health Healing Core

- **Change ID**: `CHANGE-110`
- **Spec ID**: `SPEC-225`
- **Component**: `eos-system-control-plane`
- **Target Subsystem**: `src/core/eosUniversalFleetSyncCore.ts`

## 1. Specification & Formal Requirements

- [x] Author INTAKE-110 (`docs/intake/eos-system/INTAKE-110-UNIVERSAL-FLEET-SYNC.md`)
- [x] Author CHANGE-110 (`openspec/changes/CHANGE-110-UNIVERSAL-FLEET-SYNC.md`)
- [x] Author SPEC-225 (`openspec/specs/SPEC-225-UNIVERSAL-FLEET-SYNC.md`) with EARS & Gherkin
- [x] Author PLAN-110 (`docs/plans/PLAN-110-UNIVERSAL-FLEET-SYNC.md`)
- [x] Record AUTH-2026-11-11-UNIVERSAL-FLEET-SYNC-225 in `IMPLEMENTATION_AUTHORIZATION.md`

## 2. Core Implementation

- [x] Create `src/core/eosUniversalFleetSyncCore.types.ts` ($\le 800$ lines)
- [x] Create `src/core/eosUniversalFleetSyncCore.ts` ($\le 800$ lines)
  - [x] Implement registry reading & deterministic path resolution
  - [x] Implement multi-state cross-fleet git synchronization
  - [x] Implement autonomous manifest & structure healing
  - [x] Implement 4-pillar Spotify Soundcheck scoring (0-100) & grade mapping
  - [x] Implement SHA-256 Merkle root computation over fleet digests

## 3. Subsystem Export & Platform Wiring

- [x] Add `"./fleet-sync": "./src/core/eosUniversalFleetSyncCore.ts"` in `package.json`
- [x] Export classes and types in `src/core/index.ts`
- [x] Implement `bin/commands/cliFleetMesh.mjs` ($\le 800$ lines)
- [x] Register CLI commands in `bin/commands/cliPlatform.mjs` and update help in `bin/commands/cliKernel.mjs`
- [x] Register MCP actions `fleet_sync_all` and `fleet_audit_all` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`

## 4. Verification & Documentation

- [x] Implement BDD test suite `test/eosUniversalFleetSyncCore.test.mjs`
- [x] Integrate step #37 in `test/eosEnterpriseFacade.test.mjs` (preserve $\le 800$ lines)
- [x] Document Módulo 40 in `docs/DEVELOPER_GUIDE.md`
- [x] Update `docs/specs/openspec-catalog-index.json` to 220 specs
- [x] Update `AGENTS.md` spec count to 220
- [x] Run repo health verification (`npm run typecheck`, `npm run lint`, `node scripts/repo-health.mjs`)
- [x] Commit, seal pin, and push to `origin main`
