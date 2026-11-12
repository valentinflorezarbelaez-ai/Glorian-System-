# PLAN-110: Implementation Plan for Layer-0 Universal Federated Cross-Fleet Sync & Health Healing Core

- **Change ID**: `CHANGE-110`
- **Spec ID**: `SPEC-225`
- **Component**: `eos-system-control-plane`
- **Owner**: `user:valentin-florez-arbelaez`
- **Target**: `src/core/eosUniversalFleetSyncCore.ts`

## 1. Phase 1: Contract-Driven Architecture & Types

- Define interfaces and types:
  - `FleetProjectRegistryEntry`, `FleetSyncState`, `FleetProjectSyncResult`, `FleetProjectSoundcheck`, `FleetAuditReport`, `FleetHealingResult`, `FleetSyncReceipt`.
- Strictly enforce Node 24 strip-only TS (no enums, no namespaces).
- Target file: `src/core/eosUniversalFleetSyncCore.types.ts` ($\le 800$ lines).

## 2. Phase 2: Core Engine Implementation

- Core class `EosUniversalFleetSyncCore`:
  - `loadRegistry(projectRoot: string): FleetRegistryData`
  - `resolveFleetProjects(projectRoot: string): FleetProjectResolved[]`
  - `syncProject(projectRoot: string, project: FleetProjectResolved, options?: SyncOptions): FleetProjectSyncResult`
  - `syncFleet(projectRoot: string, options?: SyncOptions): FleetSyncReport`
  - `auditProject(projectRoot: string, project: FleetProjectResolved): FleetProjectSoundcheck`
  - `auditFleetHealth(projectRoot: string): FleetAuditReport`
  - `healProject(projectRoot: string, project: FleetProjectResolved): FleetHealingResult`
  - `computeFleetMerkleRoot(digests: string[]): string`
- Enforce DbC with `assertPrecondition`, `assertPostcondition`, and immutable outputs via `deepFreeze`.
- Target file: `src/core/eosUniversalFleetSyncCore.ts` ($\le 800$ lines).

## 3. Phase 3: CLI, Subpath Export & MCP Integration

- Export `"./fleet-sync"` in `package.json` and in `src/core/index.ts`.
- Create `bin/commands/cliFleetMesh.mjs` with subcommands:
  - `fleet:sync-all`
  - `fleet:audit-all`
  - `fleet:heal-all`
- Wire CLI into `cliPlatform.mjs` and `cliKernel.mjs`.
- Register MCP actions `fleet_sync_all` and `fleet_audit_all` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.

## 4. Phase 4: Test Suite & Quality Verification

- Create `test/eosUniversalFleetSyncCore.test.mjs` verifying BDD-1144..BDD-1148.
- Add step #37 in `test/eosEnterpriseFacade.test.mjs` (ensuring file remains $\le 800$ lines).
- Document Módulo 40 in `docs/DEVELOPER_GUIDE.md`.
- Export catalog index (`totalSpecs: 220`) via `EosTacticalCommandEngine.exportOpenSpecsJson()`.
- Update `AGENTS.md` spec count to 220.
- Run `npm run typecheck`, `npm run lint`, `npx prettier --write`, and `node scripts/repo-health.mjs`.
- Commit, seal pin, and push to GitHub.
