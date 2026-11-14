# INTAKE-122 — API Contract Semantic Diff, SARIF 2.1.0 Patcher, Fleet Ship Orchestrator & Windows/p95 Hardening

## Metadata

- **Intake ID**: INTAKE-122
- **Change Ref**: CHANGE-122
- **Target SPECs**: SPEC-241, SPEC-242, SPEC-243
- **Date**: 2026-11-13
- **Requester**: Valentín Flórez Arbeláez (System Owner — directive `"todo y mas"`)
- **Status**: INTAKE_COMPLETE

---

## 1. Context & Problem Statement

After sealing `CHANGE-121` (`SPEC-238`..`SPEC-240`), live verification exposed two internal engineering gaps and three high-leverage enterprise governance capabilities:

1. **Windows Concurrency & Telemetry p95 Hygiene**:
   - `test/eosReleaseDocConsistency.test.mjs` overwrote `docs/releases/EOS_FREEZE_GATE_STATUS.md` in place during `tip-refresh --seal-pin`, causing transient Windows file-lock failures (`errno: -4094 UNKNOWN`) when executed concurrently with other suites reading the freeze doc.
   - `EosPerformanceRegressionTracker` retained multi-hour sleep/hibernation outlier samples (`> 300,000 ms`) and emitted stale p95 advisories for suites absent from the active JUnit report.
2. **Semantic API Contract Diff (`SPEC-241`)**: Detecting breaking changes across exported functions, required parameters, and required interface fields before shipping, advising semver bump (`MAJOR`/`MINOR`/`PATCH`) and Expand-and-Contract remediation.
3. **OASIS SARIF 2.1.0 & Patch Synthesizer (`SPEC-242`)**: Translating verification findings into machine-readable OASIS SARIF 2.1.0 reports plus unified diff remediation hunks with confined persistence under `projectRoot`.
4. **Fleet Multi-Repo Ship Orchestrator (`SPEC-243`)**: Evaluating all registered fleet projects in `docs/projects/registry.json` against EOS Law IV preconditions and computing fleet-wide ship readiness and cryptographic digests.

---

## 2. Constraints

- **Zero Runtime Dependencies (Law V)**: Layer-0 modules in `src/core/` MUST import only `node:*` built-ins and sibling `./*.ts` modules.
- **Complexity & File Size Budget**: Every function MUST keep cyclomatic complexity `<= 15`, and every `src/`, `bin/`, and `scripts/` file MUST stay `<= 800` lines.
- **Tier-0 MCP Budget**: Expose new actions under `eos_enterprise_workspace` without increasing the Tier-0 MCP tool count above `46`.
