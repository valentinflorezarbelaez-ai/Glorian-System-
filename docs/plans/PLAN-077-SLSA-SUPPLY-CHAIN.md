# PLAN-077: Hermetic Supply-Chain & SLSA Level-4 Provenance Attestation Engine

- **Owner**: Valentín Flórez Arbeláez (Architect & Owner)
- **Status**: APPROVED
- **Date**: 2026-11-10
- **Governed by**: SPEC-192, CHANGE-077

## 1. Architectural Strategy

Implement `src/core/eosSlsaSupplyChainAttestation.ts`:

1. **in-toto v1.0 Statement Builder**: Canonical schema formatting with subject digest arrays and SLSA v1.0 predicate.
2. **Ed25519 Cryptographic Signer & Verifier**:
   - `crypto.generateKeyPairSync('ed25519')`
   - `crypto.sign(null, data, privateKey)`
   - `crypto.verify(null, data, publicKey, signature)`
3. **CycloneDX 1.5 SBOM Builder**: Pure JSON serializer creating compliant SBOM files certifying zero third-party dependencies.
4. **Zero External Dependencies**: Pure TypeScript and `node:crypto`.
