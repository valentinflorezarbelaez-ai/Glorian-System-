# TASKS-038: ATOMIC TASK DAG — EOS v51.0.0 GENTLEMAN EVERGREEN AUTO-UPDATER

- [x] **T-038-1**: Formalize `INTAKE-038`, `SPEC-045`, `CHANGE-038`, `PLAN-038` (`ADR-051`), `GentlemanAutoUpdateEngine.tla`, and `AUTH-2026-10-30-GENTLEMAN-EVERGREEN-AUTOUPDATE-045` (`LEVEL 3`).
  - *Done Criteria*: Complete specification package present and authorized.
- [x] **T-038-2**: Register `verifyGentlemanAutoUpdateModel()` in `scripts/verify-formal-tla.mjs`.
  - *Done Criteria*: `node scripts/verify-formal-tla.mjs` passes 11/11 bounded JS simulations (`2400` steps).
- [x] **T-038-3**: Implement `src/core/eosGentlemanAutoUpdater.ts` (Layer-0 SemVer discovery, `checksums.txt` SHA-256 verifier, Windows NTFS `.bak` hot-swap + rollback, safe `agent-teams-lite` skill sync preserving `eos-*` skills & `AGENTS.md` SHA-256, lockfile + TTL state, SQLite WAL receipt).
  - *Done Criteria*: `0` runtime npm dependencies; `npm run typecheck` passes with `0` errors.
- [x] **T-038-4**: Implement `scripts/install-gentleman-autoupdate.mjs` (silent `wscript.exe` `SW_HIDE` wrapper + Windows Task Scheduler `EOS-Gentleman-Stack-AutoUpdate` every 6 hours), wire detached stale-TTL background check into `integrations/antigravity/eos-governance/scripts/eos-hook.mjs`, expose MCP tool `eos_gentleman_update` and CLI `eos gentleman update` / `eos gentleman autoupdate:*`, and bump version to `51.0.0`.
  - *Done Criteria*: Task `EOS-Gentleman-Stack-AutoUpdate` registered and verified via `schtasks /Query`; live `eos gentleman update --apply` upgraded `engram` from `3.2.1` to `3.6.0` (`EOS-LEDGER-000002-e5925b21fd`) and kept `eos gentleman doctor` at `100/100`.
- [x] **T-038-5**: Author `test/eosGentlemanAutoUpdater.test.mjs` covering `BDD-133` through `BDD-137`, run full 7-stage `npm run test` (`52` suites, `11` TLA+ simulations) + `node bin/eos.mjs turbo`, seal dual receipts (`eos_sqlite_ledger` + `engram` `mem_save`), commit, and push `v51.0.0` to `origin/main`.
  - *Done Criteria*: 7/7 stages exit 0; Windows Scheduled Task active; `origin/main` updated cleanly.
