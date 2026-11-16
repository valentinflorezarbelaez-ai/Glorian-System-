# INTAKE-155: SLSA Level 3/4 Attestations & Cryptographic Provenance Governor

- **Intake ID**: `INTAKE-155`
- **Change ID**: `CHANGE-155`
- **Spec Reference**: `SPEC-293`
- **Target Module**: `src/core/eosSlsaProvenanceGovernor.ts`
- **Tier**: Software Supply Chain Security & SLSA Provenance
- **Owner**: `user:valentin-florez-arbelaez`
- **Timestamp**: 2026-11-15T21:00:00Z
- **Status**: `INTAKE_COMPLETE`

---

## 1. Business Need & Context

In sovereign engineering environments, supply chain attacks (e.g. SolarWinds, Codecov) require absolute mathematical attestation that software artifacts originate from verified, untampered sources and build processes.
Glorian System requires an integrated, zero-dependency SLSA Level 3/4 provenance and Software Bill of Materials (SBOM) generator that:

1. Synthesizes industry-standard CycloneDX v1.5 and SPDX 2.3 JSON SBOM catalogs across repository assets.
2. Emits in-toto v1 Statement envelopes encapsulating build parameters, source git commit hashes, environment digests, and verification evidence.
3. Implements Dead Simple Signing Envelope (DSSE) and Ed25519 / Sigstore keyless signing abstractions.
4. Verifies provenance statements cryptographically fail-closed before artifact promotion.

---

## 2. Scope & Technical Objectives

- **Pure Layer-0 TypeScript**: Zero npm dependencies (`dependencies: {}`).
- **CycloneDX v1.5 & SPDX 2.3 Generators**: In-process generation of component inventories, license declarations, and content-addressed SHA-256 hashes.
- **In-Toto v1 & SLSA v1.0 Provenance**: Generates predicates adhering to `https://slsa.dev/provenance/v1` with `buildDefinition`, `runDetails`, and `byproducts`.
- **DSSE Signing & Verification**: Signs envelopes using Ed25519 (`node:crypto`) and verifies payloads against public keys.
- **CLI Subcommands**: `toolchain:slsa:sbom`, `toolchain:slsa:attest`, `toolchain:slsa:verify`.
- **Evidence Receipt**: `docs/evidence/SLSA_PROVENANCE_RECEIPT.json`.
