# CHANGE-155: SLSA Level 3/4 Attestations & Cryptographic Provenance Governor

- **Change ID**: `CHANGE-155`
- **Spec Reference**: `SPEC-293`
- **Status**: `PROPOSED`
- **Target Module**: `src/core/eosSlsaProvenanceGovernor.ts`
- **Tier**: Software Supply Chain Security & SLSA Provenance
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Intent & Architectural Justification

Implement an in-process, zero-dependency SLSA Level 3/4 provenance and SBOM engine that mathematically certifies build integrity, source traceability, and artifact authenticity. This eliminates reliance on external binary CLIs (Syft, Cosign) while generating 100% compliant CycloneDX, SPDX, In-Toto, and DSSE artifacts.

---

## 2. Capabilities & Deliverables

1. `src/core/eosSlsaProvenanceGovernor.types.ts` & `src/core/eosSlsaProvenanceGovernor.ts`:
   - `EosSbomGenerator`: Synthesizes CycloneDX v1.5 and SPDX 2.3 documents from repository source files.
   - `EosSlsaAttestor`: Generates in-toto v1 Statement containing SLSA v1.0 Provenance predicate.
   - `EosDsseSigner`: Creates and verifies Dead Simple Signing Envelopes with Ed25519 signatures.
   - `auditProvenancePipeline`: Emits cryptographic SHA-256 sealed receipt to `docs/evidence/SLSA_PROVENANCE_RECEIPT.json`.
2. CLI subcommands in `bin/commands/cliSlsaGovernor.mjs` and delegation in `bin/commands/cliDevOps.mjs`:
   - `toolchain:slsa:sbom`: Generates CycloneDX or SPDX SBOM for repository.
   - `toolchain:slsa:attest`: Issues signed SLSA v1.0 DSSE attestation envelope.
   - `toolchain:slsa:verify`: Verifies cryptographic validity of an attestation envelope.
3. BDD test suite: `test/eosSlsaProvenanceGovernor.test.mjs` verifying BDD-1533..1538.
