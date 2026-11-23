# TASKS-241: Byzantine Quorum Attestation & Idempotent Verification Gate Implementation DAG

## Stage 1: Specification & Formal Authorizations

- [x] Task 1.1: Record intake context in `docs/intake/eos-system/INTAKE-241-BYZANTINE-QUORUM-ATTESTATION.md`.
- [x] Task 1.2: Author change proposal in `openspec/changes/CHANGE-241-byzantine-quorum-attestation.md`.
- [x] Task 1.3: Author specification in `openspec/specs/SPEC-379-BYZANTINE-QUORUM-ATTESTATION.md` (`FR-379-01`..`FR-379-06`, `BDD-2065`..`BDD-2070`).
- [x] Task 1.4: Author architecture decision record in `docs/plans/PLAN-241-BYZANTINE-QUORUM-ATTESTATION.md`.
- [x] Task 1.5: Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.

## Stage 2: Operational Verification Idempotency & Fleet Sync Hardening

- [x] Task 2.1: Harden `scripts/run-tlc.mjs` with `-metadir` in `os.tmpdir()`, verified receipt anti-downgrade preservation, idempotent `timestampIso` retention, and read-only `EPERM` resilience.
- [x] Task 2.2: Harden `scripts/verify-cicd-pipeline.mjs` and `test/eosToolchainControlPlaneAndTlcLocal.test.mjs` for tmpdir receipt isolation, canonical TLC jar release digests, and read-only sandbox resilience.
- [x] Task 2.3: Fix handler return boolean (`return true`) in `bin/commands/cliCrdtStateReplicator.mjs` and fall-through dispatch in `bin/commands/cliToolchainRouter.mjs`.
- [x] Task 2.4: Synchronize `eos-system` `headCommitSha` and `registrySha256` in `docs/projects/registry.json`.

## Stage 3: Core Byzantine Quorum Governor Implementation (`SPEC-379`)

- [x] Task 3.1: Implement formal contracts in `src/core/eosByzantineQuorumGovernor.types.ts`.
- [x] Task 3.2: Implement BFT quorum geometry, cryptographic vote verification, equivocation slasher, WASM linear memory bitmask popcount, and pipeline auditor in `src/core/eosByzantineQuorumGovernor.ts`.
- [x] Task 3.3: Export contracts in `src/core/index.ts` while compacting multi-line re-exports to increase line headroom ($\le 800$ lines, headroom $= 34$).

## Stage 4: Toolchain CLI & Documentation Parity (`471 -> 475`)

- [x] Task 4.1: Create CLI handler `bin/commands/cliByzantineQuorum.mjs` (`toolchain:quorum:propose`, `toolchain:quorum:attest`, `toolchain:quorum:slash`, `toolchain:quorum:audit`).
- [x] Task 4.2: Wire prefix `toolchain:quorum:` in `bin/commands/cliToolchainRouter.mjs`.
- [x] Task 4.3: Register 4 commands in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` maintaining 100% parity (`475/475`).

## Stage 5: Test Suite & Cryptographic Receipt

- [x] Task 5.1: Author BDD test suite in `test/eosByzantineQuorumGovernor.test.mjs` (`BDD-2065`..`BDD-2070`).
- [x] Task 5.2: Generate cryptographic receipt at `docs/evidence/BYZANTINE_QUORUM_RECEIPT.json`.

## Stage 6: Verification, Tip-Refresh & Freeze Pin Seal

- [x] Task 6.1: Run `node bin/eos.mjs hygiene:audit` to confirm `475/475` CLI parity and module headroom.
- [x] Task 6.2: Run TypeScript strict typecheck (`tsc --project tsconfig.typecheck.json`) and test suites.
- [x] Task 6.3: Run `node scripts/tip-refresh.mjs` and seal `EOS_FREEZE_GATE_STATUS.md` and `RELEASE_CAPABILITY_MATRIX.md`.
