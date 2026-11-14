# TASKS-123 — Implementation Checklist (`CHANGE-123` / `SPEC-244`..`SPEC-246`)

- [x] `T-01`: Author `INTAKE-123`, `CHANGE-123`, `SPEC-244`, `SPEC-245`, `SPEC-246`, `PLAN-123`, `TASKS-123`, and record `AUTH-2026-11-13-LIVE-CONTRACT-INTOTO-SWEBENCH-244-246` (`LEVEL 3`).
- [x] `T-02`: Implement Module 59 (`src/core/eosLiveGitContractEvolutionCore.types.ts` & `.ts` — `SPEC-244`).
- [x] `T-03`: Implement Module 60 (`src/core/eosInTotoSlsaEd25519AttestorCore.types.ts` & `.ts` — `SPEC-245`).
- [x] `T-04`: Implement Module 61 (`src/core/eosGoldenSweBenchmarkHarnessCore.types.ts` & `.ts` — `SPEC-246`).
- [x] `T-05`: Export Modules 59–61 in `src/core/index.ts` and expose `./contract-live`, `./intoto-attest`, `./swe-bench` in `package.json`.
- [x] `T-06`: Wire CLI commands `contract:live`, `attest:ship`, `bench:swe`, enrich `ship`, and wire MCP actions `live_contract_evolution`, `intoto_slsa_attest`, `golden_swe_benchmark`.
- [x] `T-07`: Create `test/eosLiveContractAttestSweBench.test.mjs` (`BDD-1241`..`BDD-1255`), extend `test/eosEnterpriseFacade.test.mjs` (step `#50`), and document Modules 59–61 in `docs/DEVELOPER_GUIDE.md`.
- [x] `T-08`: Format with Prettier, sync pins via `scripts/tip-refresh.mjs`, and pass all static checks plus concurrent `node --test` suites.
- [x] `T-09`: Mark all tasks `[x]`, run CLI smoke checks, and commit `SPEC-244..246`.
- [x] `T-10`: Seal Freeze Gate (`tip-refresh`) and push cleanly to `origin/main`.
