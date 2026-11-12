# TASKS-105: Implementation Tasks for KZG Polynomial Commitments Core (SPEC-220)

- **Spec**: `SPEC-220`
- **Change**: `CHANGE-105`
- **Component**: `eos-system-control-plane`
- **Status**: IN PROGRESS

---

## Task Checklist

- [x] **Task 1: Intake & Specifications**
  - [x] Create `docs/intake/eos-system/INTAKE-105-KZG-POLYNOMIAL-COMMITMENTS.md`.
  - [x] Create `openspec/changes/CHANGE-105-KZG-POLYNOMIAL-COMMITMENTS.md`.
  - [x] Create `openspec/specs/SPEC-220-KZG-POLYNOMIAL-COMMITMENTS.md`.
  - [x] Create `docs/plans/PLAN-105-KZG-POLYNOMIAL-COMMITMENTS.md`.
  - [x] Append Level-2 authorization to `IMPLEMENTATION_AUTHORIZATION.md`.

- [ ] **Task 2: Core Domain Models & Implementation**
  - [ ] Implement `src/core/eosKzgPolynomialCommitmentCore.types.ts`.
  - [ ] Implement `src/core/eosKzgPolynomialCommitmentCore.ts`.
  - [ ] Add subpath export `"./kzg"` in `package.json`.
  - [ ] Re-export types and engine in `src/core/index.ts`.

- [ ] **Task 3: CLI & MCP Integration**
  - [ ] Author `bin/commands/cliKzgMesh.mjs` (`kzg:commit`, `kzg:open`, `kzg:verify`, `kzg:batch`).
  - [ ] Wire handler into `bin/commands/cliPlatform.mjs` and `bin/commands/cliKernel.mjs`.
  - [ ] Add MCP actions `kzg_commit`, `kzg_open`, `kzg_verify` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.

- [ ] **Task 4: Testing & Verification**
  - [ ] Author `test/eosKzgPolynomialCommitmentCore.test.mjs` (BDD-1119..BDD-1123).
  - [ ] Add Step #32 to `test/eosEnterpriseFacade.test.mjs` preserving $\le 800$ lines.
  - [ ] Document Módulo 35 in `docs/DEVELOPER_GUIDE.md`.
  - [ ] Export updated `openspec-catalog-index.json` (215 specs).

- [ ] **Task 5: Quality Gate & Release**
  - [ ] Pass `npm run typecheck` and `npm run lint`.
  - [ ] Run `npm run tip-refresh` and format release docs.
  - [ ] Run `node scripts/repo-health.mjs` (15/15 passing).
  - [ ] Commit and push to origin main.
