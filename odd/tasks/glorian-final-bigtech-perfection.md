# ODD Feature: Glorian Final Big-Tech Perfection Pass (T1–T4)

Objective: Close the remaining four engineering, distribution, security-boundary, and empirical-validation items on `feat/glorian-final-bigtech-perfection` while keeping zero runtime npm dependencies, `636` `src/core/*.ts` modules, `<= 788` lines per module, and sealed landing assets untouched.
Branch: `feat/glorian-final-bigtech-perfection` | Delivery: `ask-on-risk` | Runner: `node --test`

## Specs

- **S1 — Worktree Cleanup, Hermetic Evidence Isolation & Coverage Reporter (`SPEC-342`)**:
  - User request verbatim: `"dejemos todo perfecto"`
  - Scope: `package.json`, `bin/commands/cliSapFix.mjs`, `scripts/verify-cicd-pipeline.mjs`, `scripts/lib/cicdStage4Runner.mjs`, `scripts/lib/cicdCoverageReporter.mjs`, `scripts/lib/trackedEvidence.mjs`, `test/lib/testEvidence.mjs`, modified `src/core/*.ts` & `test/*.mjs`, `IMPLEMENTATION_AUTHORIZATION.md`, and `odd/tasks/glorian-final-bigtech-perfection.md`.
  - Acceptance: Prune abandoned `.qoder` worktrees/branches so `git worktree list` contains only the primary checkout; isolate generated test receipts via `test/lib/testEvidence.mjs` and `resolveEvidencePath` so `npm test` and `verify:strict` preserve all tracked `docs/evidence/` files bit-for-bit; pass `coverage-ratchet`, `typecheck`, `lint`, `format:check`, `boundary:check` (`636/636`), and `consumers:audit` (`636/636`).
  - Checks: `node --import ./test/lib/testEvidence.mjs --test <modified test files>`, `node scripts/coverage-ratchet.mjs`, `npm run lint`, `npm run format:check`.

- **S2 — Signed SEA Release Binaries & gVisor (`runsc`) Documentation (`SPEC-061`, `SPEC-098`, `SPEC-198`, `README.md`)**:
  - User request verbatim: `"dejemos todo perfecto"`
  - Scope: `scripts/build-sea-binary.mjs`, `.github/workflows/eos-sovereign-cicd.yml`, `README.md`, `test/eosHermeticSeaCompiler.test.mjs`.
  - Acceptance: Support `--bundle-release` in `scripts/build-sea-binary.mjs` to produce platform standalone executables (`dist/glorian-<platform>`) + Ed25519 `.sig` + `dist/SHA256SUMS.txt` alongside `dist/eos.blob`; extend `slsa-provenance` in `.github/workflows/eos-sovereign-cicd.yml` to synthesize/smoke-test standalone SEA release assets, attest them via `actions/attest-build-provenance`, and attach binary/checksum/SBOM/provenance artifacts to GitHub Release `v${VERSION}`; document `--runtime=runc|runsc|auto` and GitHub Releases verification in `README.md` without violating `SPEC-131` or `SPEC-177`.
  - Checks: `node scripts/build-sea-binary.mjs --bundle-release`, `node --import ./test/lib/testEvidence.mjs --test test/eosNightlyDeepGates.test.mjs test/eosHermeticSeaCompiler.test.mjs test/eosSingleExecutablePackager.test.mjs`.

- **S3 — Experimental Cryptographic Security Perimeter on `EosVerifiableSecretSharingCore` (`SPEC-233`)**:
  - User request verbatim: `"dejemos todo perfecto"`
  - Scope: `src/core/eosVerifiableSecretSharingCore.types.ts`, `src/core/eosVerifiableSecretSharingCore.ts`, `test/eosVerifiableSecretSharingCore.test.mjs`.
  - Acceptance: Stamp every `VssDeal` and `VssReconstructionResult` with `securityPosture: "EXPERIMENTAL_NON_CONSTANT_TIME_BIGINT"` and `approvedForProductionSecrets: false`, expose static posture constants on `EosVerifiableSecretSharingCore`, and fail closed on `splitSecret` / `reconstruct` when `EOS_VSS_DISALLOW_EXPERIMENTAL === "1"`.
  - Checks: `node --import ./test/lib/testEvidence.mjs --test test/eosVerifiableSecretSharingCore.test.mjs`, `node scripts/coverage-ratchet.mjs`.

- **S4 — Empirical 3-Repository External Fleet Pilot & Telemetry (`SPEC-124`, `docs/USABILITY-PILOT.md`)**:
  - User request verbatim: `"dejemos todo perfecto"`
  - Scope: `scripts/run-external-fleet-pilot.mjs`, `test/eosExternalFleetPilot.test.mjs`, `docs/evidence/EXTERNAL_FLEET_PILOT_RECEIPT.json`, `README.md`, `docs/USABILITY-PILOT.md`.
  - Acceptance: Clone 3 external fleet repositories ephemerally into `os.tmpdir()` (zero writes to sibling checkouts), measure full `inspect → plan → guard → start → validate → review → tamper-reject → apply → revert → close` latencies and reversibility, record `validationBackend` (`DOCKER_ENGINE` vs `HOST_SUBPROCESS_DOCKER_OFFLINE`) honestly in `docs/evidence/EXTERNAL_FLEET_PILOT_RECEIPT.json`, cover with `test/eosExternalFleetPilot.test.mjs`, and document measured results alongside the distinct 5-human onboarding gate in `README.md` and `docs/USABILITY-PILOT.md`.
  - Checks: `node --import ./test/lib/testEvidence.mjs --test test/eosExternalFleetPilot.test.mjs`, `node scripts/run-external-fleet-pilot.mjs --live-fleet --write-receipt`.

## Tasks

- [x] **T1** (`S1`) | Route: `inline+3-parallel-test-writers` | Risk: `High (item 3: shared test/CI harness & 27 src/core modules)` | Status: `done` | Evidence: `coverage-ratchet 27/27 PASS (>=87.5%L/>=80%B), typecheck/lint/format/boundary/consumers exit 0, docs/evidence clean`
- [x] **T2** (`S2`) | Route: `inline` | Risk: `High (item 5: GitHub Release CI & SEA packaging workflow)` | Status: `done` | Evidence: `build-sea-binary.mjs --bundle-release (6 SHA256SUMS entries), 20/20 tests PASS, lint/format exit 0, sea-config.json clean`
- [x] **T3** (`S3`) | Route: `inline` | Risk: `High (item 2 & 3: experimental crypto boundary types)` | Status: `done` | Evidence: `coverage-ratchet PASS (98.02%L / 96%B), typecheck/lint/format exit 0, BDD-1189..1190 PASS`
- [ ] **T4** (`S4`) | Route: `inline` | Risk: `High (item 1 & 3: external clone harness, canonical receipt & docs)` | Status: `in_progress` | Evidence: pending

## Log

- **L1 (2026-11-24)**: User request verbatim: `"dejemos todo perfecto"`. Pruned abandoned `.qoder` worktrees (`agent-general-purpose-9e89d043`, `agent-supply-chain-sbom`) and created `feat/glorian-final-bigtech-perfection` from `1a7fc6e8`.
