# CHANGE-123 — Live Git Contract Evolution, In-Toto Ed25519 SLSA Attestor & Golden SWE Benchmark Harness

## Metadata

- **Change ID**: CHANGE-123
- **Target SPECs**: SPEC-244, SPEC-245, SPEC-246
- **Intake Ref**: INTAKE-123
- **Date**: 2026-11-13
- **Status**: APPROVED
- **Layer**: Layer-0 (Zero external runtime dependencies)

---

## 1. Description

Implement Modules 59, 60, and 61 in pure Layer-0 TypeScript plus CLI, MCP, SDD, and BDD coverage:

- **Module 59 (`SPEC-244`) — `EosLiveGitContractEvolutionCore`**: Confines live repository inspection to `projectRoot`, validates `baseRef`, reads changed TypeScript files under `src/`, compares `git show <baseRef>:<path>` against current disk content via `EosApiContractSemanticDiffCore`, and aggregates overall semver bump and breaking counts.
- **Module 60 (`SPEC-245`) — `EosInTotoSlsaEd25519AttestorCore`**: Synthesizes OASIS/OpenSSF **In-Toto Statement v1** with **SLSA Provenance v1.0**, signs DSSE PAE payloads using native **Ed25519** (`node:crypto`), supports independent cryptographic signature verification, and confines optional persistence to `projectRoot`.
- **Module 61 (`SPEC-246`) — `EosGoldenSweBenchmarkHarnessCore`**: Executes an 8-scenario clean + adversarial corpus across live diff, contract diff, shrinking PBT, and Law IV fleet governance, reporting deterministic confusion-matrix metrics (`precision`, `recall`, `f1Score`, `falsePositiveRate`, `accuracy`).
- **Unified Orchestration**: Wires `contract:live`, `attest:ship`, `bench:swe`, extends `ship`, exposes MCP actions `live_contract_evolution`, `intoto_slsa_attest`, `golden_swe_benchmark`, and subpath exports `./contract-live`, `./intoto-attest`, `./swe-bench`.
