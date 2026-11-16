# TASKS-170: Decentralized Cross-Fleet Merkle-CRDT State Replication Protocol Implementation DAG

## Stage 1: Specification & Formal Authorizations

- [x] Task 1.1: Record intake context in `docs/intake/eos-system/INTAKE-170-MERKLE-CRDT-STATE-REPLICATION.md`.
- [x] Task 1.2: Author change proposal in `openspec/changes/CHANGE-170-merkle-crdt-state-replication.md`.
- [x] Task 1.3: Author specification in `openspec/specs/SPEC-308-merkle-crdt-state-replication.md`.
- [x] Task 1.4: Author architecture decision record in `docs/plans/PLAN-170-merkle-crdt-state-replication.md`.
- [x] Task 1.5: Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.

## Stage 2: Operational CI/CD Hardening

- [x] Task 2.1: Add Java 21 (`actions/setup-java@v4`) into `sovereign-gate` job in `.github/workflows/eos-sovereign-cicd.yml`.
- [x] Task 2.2: Refine assertions in `test/eosToolchainControlPlaneAndTlcLocal.test.mjs` to cleanly handle both live TLC execution and deferred runner mode.

## Stage 3: Core Subsystem Implementation

- [x] Task 3.1: Implement formal contracts in `src/core/eosCrdtStateReplicator.types.ts`.
- [x] Task 3.2: Implement Merkle-DAG, CRDT join-semilattices, WASM linear memory vector merge, and anti-entropy sync in `src/core/eosCrdtStateReplicator.ts`.
- [x] Task 3.3: Export contracts in `src/core/index.ts` maintaining line limits ($\le 800$, headroom $\ge 12$).

## Stage 4: Toolchain CLI & Routing Parity

- [x] Task 4.1: Create CLI handler `bin/commands/cliCrdtStateReplicator.mjs`.
- [x] Task 4.2: Wire prefix `toolchain:replicator:` in `bin/commands/cliToolchainRouter.mjs`.
- [x] Task 4.3: Add 4 commands to `bin/commands/cliHelpCatalog.mjs` ($467 \to 471$).
- [x] Task 4.4: Document commands in `docs/DEVELOPER_GUIDE.md` maintaining 471/471 parity.

## Stage 5: Test Suite & Cryptographic Receipt

- [x] Task 5.1: Author comprehensive test suite in `test/eosCrdtStateReplicator.test.mjs` (`BDD-1623`..`BDD-1628`).
- [x] Task 5.2: Execute `node --test test/eosCrdtStateReplicator.test.mjs` verifying 100% pass.
- [x] Task 5.3: Generate cryptographic receipt at `docs/evidence/CRDT_REPLICATION_RECEIPT.json`.

## Stage 6: Verification, Sealing & Remote Release

- [x] Task 6.1: Run `node bin/eos.mjs hygiene:audit` to verify 471/471 CLI parity and line limits.
- [x] Task 6.2: Run `npm run typecheck` to verify 100% TypeScript type safety.
- [x] Task 6.3: Run `node scripts/tip-refresh.mjs` to update documentation consistency.
- [ ] Task 6.4: Git commit, seal freeze pin (`--seal-pin`), and push through 7-stage pre-push gate.
