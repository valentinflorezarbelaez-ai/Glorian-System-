# TASKS-162: Conflict-Free P2P Mesh Synchronization with Automerge Wasm

- **Tasks ID**: `TASKS-162`
- **Change ID**: `CHANGE-162`
- **Spec Reference**: `SPEC-300`
- **Tier**: Distributed Systems, P2P CRDTs & Delay-Tolerant Networking (Phase 4.1)
- **Status**: `READY`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-15T22:48:00Z

---

## Task Dependency Graph (DAG)

```text
[TASK-162-01: Types Definition]
       │
       ▼
[TASK-162-02: Core CRDT Mesh Implementation]
       │
       ▼
[TASK-162-03: Core Re-export & Typecheck]
       │
       ▼
[TASK-162-04: CLI Subdispatcher Implementation]
       │
       ▼
[TASK-162-05: CLI Router & Catalog Registration]
       │
       ▼
[TASK-162-06: Test Suite (BDD-1575..BDD-1580)]
       │
       ▼
[TASK-162-07: Tip Refresh & Pre-Push Gate Sealing]
```

---

## Detailed Task Breakdown

### TASK-162-01: Types Definition

- Create `src/core/eosAutomergeCrdtMesh.types.ts`.
- Define `CrdtOp`, `CrdtChange`, `CrdtDocumentState`, `CrdtSyncMessage`, `DtnPacket`, `CrdtReceipt`.
- Done Criteria: Clean compilation under `tsc --noEmit`.

### TASK-162-02: Core CRDT Mesh Implementation

- Create `src/core/eosAutomergeCrdtMesh.ts`.
- Implement `CrdtDocument` & `CrdtMeshPeer` classes:
  - Immutable content-addressed change DAG with SHA-256 parent chaining.
  - Lamport timestamp tracking and deterministic tie-breaking.
  - Have/Need differential synchronization protocol (`generateSyncMessage`, `applySyncMessage`).
  - Delay-Tolerant Networking (DTN) store-and-forward outbox buffer.
  - Cryptographic tamper detection (hash mismatch rejection).
  - Audit receipt generation at `docs/evidence/CRDT_MESH_RECEIPT.json`.
- Done Criteria: Module $\le 450$ lines, zero runtime dependencies.

### TASK-162-03: Core Re-export & Typecheck

- Export types and engine in `src/core/index.ts`.
- Run `npm run typecheck`.
- Done Criteria: Exit code 0, 0 type errors.

### TASK-162-04: CLI Subdispatcher Implementation

- Create `bin/commands/cliAutomergeCrdt.mjs`.
- Implement commands:
  - `toolchain:crdt:sync`
  - `toolchain:crdt:merge`
  - `toolchain:crdt:state`
  - `toolchain:crdt:audit`
- Done Criteria: Functional execution returning formatted JSON and human summary.

### TASK-162-05: CLI Router & Catalog Registration

- Wire `toolchain:crdt:` in `bin/commands/cliToolchainRouter.mjs`.
- Register in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md`.
- Run `node bin/eos.mjs hygiene:audit`.
- Done Criteria: 100.00% command parity verified.

### TASK-162-06: Test Suite (BDD-1575..BDD-1580)

- Create `test/eosAutomergeCrdtMesh.test.mjs`.
- Verify scenarios BDD-1575 through BDD-1580.
- Run `node --test test/eosAutomergeCrdtMesh.test.mjs`.
- Done Criteria: 100% tests passing, exit code 0.

### TASK-162-07: Tip Refresh & Pre-Push Gate Sealing

- Run `node scripts/tip-refresh.mjs` to synchronize active spec count (300) and test count (292).
- Format files with prettier.
- Seal freeze pin and push to `origin/main`.
- Done Criteria: All CI gates pass cleanly.
