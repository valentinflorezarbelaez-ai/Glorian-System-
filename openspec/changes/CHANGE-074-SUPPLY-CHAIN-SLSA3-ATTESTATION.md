# CHANGE-074: Supply Chain SLSA Level 3 & CycloneDX SBOM Verification

## Change Metadata
- **Change ID**: `CHANGE-074`
- **Spec Reference**: `SPEC-139`
- **Component**: `Glorian Control Plane (src/core/, scripts/, .github/)`
- **Author**: Principal Architect Valentín Flórez Arbeláez
- **Status**: `PROPOSED`

## Summary of Delta
1. **Dynamic Pure L0 SBOM & SLSA Engine**:
   - Refactor `src/core/eosSlsaProvenanceSbom.ts` to dynamically inspect `package.json`, eliminate hardcoded `66.0.0` version strings, and bind canonical repository metadata (`https://github.com/valentinflorezarbelaez-ai/Glorian-System-.git`).
2. **Deterministic CLI Generators & Validators**:
   - Create `scripts/eos-generate-sbom.mjs` to synthesize `docs/evidence/sbom.cdx.json` and `docs/evidence/provenance.intoto.jsonl`.
   - Create `scripts/verify-supply-chain.mjs` with fail-closed validation semantics.
3. **Sovereign CI/CD Pipeline Integration**:
   - Add `supply-chain-attestation` job to `.github/workflows/eos-sovereign-cicd.yml` running on `push` to `main` with `permissions: { contents: read, id-token: write, attestations: write }`.
4. **Adversarial Test Suite**:
   - `test/eosSlsa3SupplyChain.test.mjs` verifying BDD-369, BDD-370, BDD-371.
