# CHANGE-125 — CLI Catalog Parity & Module Headroom Governor (`SPEC-250`)

## Metadata

- **Change ID**: CHANGE-125
- **Target SPEC**: SPEC-250
- **Intake Ref**: INTAKE-125
- **Date**: 2026-11-13
- **Status**: APPROVED
- **Layer**: Layer-0 (Zero external runtime dependencies)

---

## 1. Description

Deliver Module 65 (`SPEC-250` — `EosCliCatalogAndHygieneGovernorCore`) alongside structural CLI help extraction and near-ceiling module decompression:

- **Module 65 (`SPEC-250`) — `EosCliCatalogAndHygieneGovernorCore`**: Layer-0 governor (`src/core/eosCliCatalogAndHygieneGovernorCore.types.ts` & `.ts`) that extracts every `HANDLERS["..."]` command registered in `bin/commands/*.mjs`, audits parity against `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md`, and measures line-count headroom across all `.ts` and `.mjs` files in `src/`, `bin/`, and `scripts/` against the `800`-line hard limit with a deterministic SHA-256 governance receipt.
- **CLI Help Catalog Extraction**: Extract `QUICK_HELP_TEXT` and `EXHAUSTIVE_HELP_TEXT` into `bin/commands/cliHelpCatalog.mjs`, bringing `eos help` (`v75.0.0`) and `eos help --all` to 100% parity through `SPEC-250` and slimming `bin/commands/cliKernel.mjs` from `616` to `~425` lines.
- **Near-Ceiling Module Decompression**: Extract `eosContainerSandbox.types.ts` from `src/core/eosContainerSandbox.ts` (`798` -> `<= 755` lines) and delegate `crdt_*`/`mmr_*` and `vss_*` MCP handlers from `eosMcpPhase7EnterpriseFrontierHandlers.ts` (`792` -> `~710` lines) and `eosMcpPhase7EnterpriseFrontierHandlersExt.ts` (`779` -> `~695` lines) into `eosMcpPhase7EnterpriseFrontierHandlersExt2.ts`.
- **Ergonomic Exposure**: Export Module 65 in `src/core/index.ts`, add subpath `./hygiene-governor` and top-level npm convenience scripts (`ship`, `hygiene:audit`, `bench:swe`, `eda:prove`, `apollo:bundle`, `aladdin:stress`) in `package.json`, add `hygiene:audit` CLI command, enrich `ship`, wire MCP `cli_hygiene_audit`, add `BDD-1271`..`BDD-1275`, and update `docs/DEVELOPER_GUIDE.md`.
