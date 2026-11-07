# OPENSPEC CHANGE PROPOSAL: NUBANK INSTITUTIONAL ENGINEERING CODEX (CHANGE-016)

- **Specification**: `SPEC-023-NUBANK-INSTITUTIONAL-CODEX.md`
- **Status**: APPROVED
- **Author**: Valentín Flórez Arbeláez & Antigravity
- **Date**: 2026-10-25
- **Target Version**: v31.0.0

## 1. Summary of Changes

- Add `src/core/eosNubankCodex.ts` implementing the full institutional standard of Nubank (`https://building.nu.com/`).
- Integrate 6 Building Nu pillars: Fighting Complexity, Hexagonal Functional Core, Datomic Bitemporality, Sachem Contract Checking, Kafka Idempotency, and Blameless Postmortems.
- Expose MCP tools (`eos_nubank_audit`, `eos_nubank_postmortem`, `eos_nubank_sachem_verify`, `eos_nubank_datomic_transact`) in `src/mcp/eosMcpServer.ts`.
- Expose CLI command `eos nubank` in `bin/eos.mjs`.
- Elevate `AGENTS.md` to permanently instruct all agents on Nubank's institutional operating procedures.
- Author unit & verification test suite in `test/eosNubankCodex.test.mjs`.
