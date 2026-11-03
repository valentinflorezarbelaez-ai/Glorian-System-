# INTAKE-139: Supply Chain SLSA Level 3 & CycloneDX SBOM Verification

## 1. Context & Strategic Intent
- **System**: Glorian System (EOS Control Plane Core).
- **Driver**: Elevate Glorian System's software supply-chain security to Big Tech (Google, Palantir, Anduril) and regulatory standards (EU Cyber Resilience Act 2026-2027).
- **Core Principle**: "A local assertion is a claim; a cryptographically bound in-toto statement with keyless OIDC provenance is verifiable evidence."
- **Problem Statement**:
  - `EosSlsaProvenanceSbom` existed as an in-process class in `src/core/eosSlsaProvenanceSbom.ts`, but was not connected to an automated release pipeline or local verification gate.
  - Previous SBOM metadata had hardcoded version strings (`66.0.0`) and legacy repository URLs.
  - No fail-closed validator existed to verify that an artifact's physical bytes match the subject digests in the in-toto Statement and CycloneDX BOM.
  - GitHub Actions lacked a dedicated keyless OIDC supply-chain attestation job isolated to push/release events.

## 2. Scope of Work (Horizon 2 - Motor 4)
1. **Dynamic Pure Layer-0 SBOM & Provenance Generator**:
   - Modernize `EosSlsaProvenanceSbom.ts` to dynamically resolve version (`pkg.version`), repository metadata, and full file inventories.
   - Script `scripts/eos-generate-sbom.mjs` emitting `docs/evidence/sbom.cdx.json` and `docs/evidence/provenance.intoto.jsonl`.
2. **Fail-Closed Supply-Chain Validator**:
   - Pure L0 verification script `scripts/verify-supply-chain.mjs` verifying:
     - CycloneDX v1.5 schema and SHA-256 integrity.
     - In-toto Statement v1 with SLSA v1.0 predicate.
     - Bit-for-bit SHA-256 match between actual files and subject/component digests.
     - Exits with code 1 if files are tampered, missing, or mismatched.
3. **GitHub Actions Sovereign Supply-Chain Job**:
   - Extend `.github/workflows/eos-sovereign-cicd.yml` with a dedicated `supply-chain-attestation` job running strictly on `push` to `main` (isolated from unprivileged fork PRs).
   - Generates SBOM, validates provenance, and publishes evidence.
4. **Adversarial Regression Test Suite**:
   - `test/eosSlsa3SupplyChain.test.mjs` asserting:
     - BDD-369: Valid SBOM and Provenance generation matching commit digest.
     - BDD-370: Fail-closed rejection of tampered files or forged subject digests.
     - BDD-371: CLI verification gate execution.

## 3. Epistemic Status
- Current: `INSPECTION_COMPLETE`
- Target: `PRODUCTION_READY`
