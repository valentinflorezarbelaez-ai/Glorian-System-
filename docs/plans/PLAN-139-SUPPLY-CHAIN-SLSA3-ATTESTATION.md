# PLAN-139: Architecture Plan — Supply Chain SLSA Level 3 & CycloneDX SBOM Verification

## 1. Architectural Decisions (ADR)

### ADR-0170: Pure Layer-0 CycloneDX v1.5 and In-Toto Provenance Synthesis
- **Context**: Modern supply-chain standards (SLSA Level 3, EU CRA 2026/2027, US Executive Order 14028) mandate verifiable Software Bill of Materials (SBOM) and signed build provenance. Traditional solutions rely on heavy CLI wrappers (`cyclonedx-npm`, `syft`, `cosign-installer`) with hundreds of transitive dependencies.
- **Decision**: Synthesize CycloneDX v1.5 JSON and in-toto v1 Statement directly via pure Layer-0 Node.js primitives (`node:crypto`, `node:fs`, `node:path`).
- **Consequences**:
  - Positive: Zero npm runtime dependencies preserved (`dependencies: {}`).
  - Positive: Instantaneous sub-10ms synthesis without network or external CLI binary downloads.
  - Negative: Requires self-contained schema structure maintenance.

### ADR-0171: OIDC Keyless Attestation Fork Isolation
- **Context**: In GitHub Actions, jobs triggered by `pull_request` from forks run with read-only tokens and lack the `id-token: write` permission required for Sigstore OIDC keyless signing. Attempting to sign inside generic PR gates causes intermittent failures on open-source contributions.
- **Decision**: Restrict the OIDC signing and provenance publication job to `push` events on `branches: [main]` (and tagged releases), while enforcing local byte-verification on PR gates without OIDC.
- **Consequences**:
  - Positive: 100% reliable CI/CD without fork permission crashes.
  - Positive: High cryptographic assurance on published releases and master artifacts.

---

## 2. Component Layout & Responsibilities
| Component | File | Responsibility |
|---|---|---|
| Core Engine | `src/core/eosSlsaProvenanceSbom.ts` | Dynamic CycloneDX v1.5 and In-toto v1 generator |
| Generator Script | `scripts/eos-generate-sbom.mjs` | Synthesizes `sbom.cdx.json` and `provenance.intoto.jsonl` |
| Verifier Script | `scripts/verify-supply-chain.mjs` | Fail-closed bit-for-bit SHA-256 validator |
| CI/CD Pipeline | `.github/workflows/eos-sovereign-cicd.yml` | Dedicated `supply-chain-attestation` job |
| Test Suite | `test/eosSlsa3SupplyChain.test.mjs` | Adversarial test cases (BDD-369 to BDD-371) |
