# CHANGE-102: Layer-0 Verifiable Random Functions (ECVRF RFC 9381) Core

## Metadata

- **Change ID**: `CHANGE-102`
- **Specification**: `SPEC-217`
- **Intake**: `INTAKE-102`
- **Status**: APPROVED
- **Author**: Valentín Flórez Arbeláez
- **Date**: 2026-11-11
- **Target Release**: v75.0.0

---

## 1. Intent

Introduce a Layer-0 Verifiable Random Function (ECVRF) engine adhering to RFC 9381 principles on the secp256k1 curve. Provide cryptographic guarantees of uniqueness, pseudorandomness, collision resistance, and zero-knowledge unforgeability for consensus leader elections, seed generation, and decentralized verifiable lotteries.

## 2. Modifications

- **Core Module**: `src/core/eosVerifiableRandomFunctionCore.ts` and `src/core/eosVerifiableRandomFunctionCore.types.ts`.
- **Subpath Export**: `"./vrf"` in `package.json` and explicit named exports in `src/core/index.ts`.
- **CLI Commands**: `vrf:eval`, `vrf:verify`, `vrf:elect` wired in dedicated module `bin/commands/cliVrfMesh.mjs` and orchestrated in `bin/commands/cliPlatform.mjs` and `bin/commands/cliKernel.mjs`.
- **MCP Frontier Actions**: `vrf_eval`, `vrf_verify`, `vrf_elect` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`.
- **Tests**: `test/eosVerifiableRandomFunctionCore.test.mjs` and step #29 in `test/eosEnterpriseFacade.test.mjs`.
- **Documentation**: Módulo 32 in `docs/DEVELOPER_GUIDE.md` and `docs/specs/openspec-catalog-index.json`.
