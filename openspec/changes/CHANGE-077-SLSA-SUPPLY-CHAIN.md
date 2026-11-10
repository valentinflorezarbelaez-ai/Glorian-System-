# CHANGE-077: Hermetic Supply-Chain & SLSA Level-4 Provenance Attestation Engine

## Intent

Equip Glorian System with native SLSA Level-4 (Supply-chain Levels for Software Artifacts) provenance generation, in-toto v1.0 statements, Ed25519 cryptographic signing, and CycloneDX-compatible software bill of materials (SBOM) under zero runtime npm dependencies.

## Scope

- SPEC-192 + `src/core/eosSlsaSupplyChainAttestation.ts`
- Barrel export in `src/core/index.ts`
- Subpath export `"./provenance"` in `package.json`
- Verification suite in `test/eosSlsaSupplyChainAttestation.test.mjs`

## Non-goals

- No reliance on external cosign binary (native `node:crypto` Ed25519 signing/verification)
- Zero external runtime npm dependencies (`dependencies: {}`)

## Status

APPROVED — owner directive to implement Linux Foundation/CNCF supply chain excellence.
