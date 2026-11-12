# CHANGE-104: Layer-0 FROST Threshold Schnorr Signatures (RFC 9591) Core

## Metadata

- **Change ID**: `CHANGE-104`
- **Specification**: `SPEC-219`
- **Intake**: `INTAKE-104`
- **Status**: APPROVED
- **Author**: Valentín Flórez Arbeláez
- **Date**: 2026-11-11
- **Target Release**: v75.0.0

---

## 1. Intent

Implement a Layer-0 Flexible Round-Optimized Schnorr Threshold Signature (FROST) engine compliant with RFC 9591 on secp256k1. Provide $(t, n)$ distributed key generation, round-1 nonce commitment generation, anti-ROS binding factor derivation, round-2 partial signature generation with Lagrange coefficients, and signature share aggregation producing canonical Schnorr signatures.

## 2. Modifications

- **Core Module**: `src/core/eosFrostThresholdSignatureCore.ts` and `src/core/eosFrostThresholdSignatureCore.types.ts`.
- **Subpath Export**: `"./frost"` in `package.json` and explicit named exports in `src/core/index.ts`.
- **CLI Commands**: `frost:keygen`, `frost:sign`, `frost:verify` wired in dedicated module `bin/commands/cliFrostMesh.mjs` and orchestrated in `bin/commands/cliPlatform.mjs` and `bin/commands/cliKernel.mjs`.
- **MCP Frontier Actions**: `frost_keygen`, `frost_sign`, `frost_verify` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
- **Tests**: `test/eosFrostThresholdSignatureCore.test.mjs` and step #31 in `test/eosEnterpriseFacade.test.mjs`.
- **Documentation**: Módulo 34 in `docs/DEVELOPER_GUIDE.md` and `docs/specs/openspec-catalog-index.json`.
