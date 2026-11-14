# INTAKE-125 — CLI Catalog Parity & Module Headroom Governor, Help Extraction, & Structural Decompression

## Metadata

- **Intake ID**: INTAKE-125
- **Change Ref**: CHANGE-125
- **Target SPEC**: SPEC-250
- **Date**: 2026-11-13
- **Requester**: Valentín Flórez Arbeláez (System Owner — directive `"si dale con toda"`)
- **Status**: INTAKE_COMPLETE

---

## 1. Context & Problem Statement

Following the rapid delivery of Waves `CHANGE-119` through `CHANGE-124` (`SPEC-234`..`SPEC-249`), an empirical repository hygiene audit identified three structural bottlenecks:

1. **CLI Help Catalog Drift**: `bin/commands/cliKernel.mjs` (`cmd_help_143`) stopped documenting commands after `SPEC-225`, leaving commands from `SPEC-226` through `SPEC-249` (`trace:*`, `ml-dsa:*`, `congestion:*`, `trie:*`, `timelock:*`, `cuckoo:*`, `hll:*`, `vss:*`, `jarvis:*`, `polyglot:*`, `bridge:*`, `staff:*`, `diff:live`, `repomap:build`, `pbt:check`, `contract:diff`, `sarif:export`, `fleet:ship`, `contract:live`, `attest:ship`, `bench:swe`, `eda:prove`, `apollo:bundle`, `aladdin:stress`, `ship`) missing from interactive help output, and keeping `cliKernel.mjs` inflated at `616` lines.
2. **Near-Ceiling Modules**: Three core/MCP modules approached the `800`-line hard limit in `docs/quality/size-budget.json`:
   - `src/core/eosContainerSandbox.ts` (`798` lines — `2` lines below ceiling)
   - `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts` (`792` lines — `8` lines below ceiling)
   - `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts` (`779` lines — `21` lines below ceiling)
3. **Missing Automated Catalog & Headroom Governance (`SPEC-250`)**: While `test/eosModuleSizeBudget.test.mjs` guards only hard `800`-line breaches, no Layer-0 engine continuously enforces 1:1 CLI handler registration parity against the interactive help catalog and developer guide alongside minimum headroom (`>= 12` lines below `800`) across `src/`, `bin/`, and `scripts/`.

---

## 2. Constraints

- **Zero Runtime Dependencies (Law V)**: Layer-0 engines in `src/core/` import only `node:*` built-ins and sibling `./*.ts` modules.
- **Complexity & Size Budget**: Cyclomatic complexity `<= 15` per function and file length `<= 800` lines across `src/`, `bin/`, and `scripts/`, with minimum headroom `>= 12` lines (`<= 788` lines per module).
- **Tier-0 MCP Budget**: Wire `cli_hygiene_audit` under existing `eos_enterprise_workspace` (`46` Tier-0 tools unchanged).
