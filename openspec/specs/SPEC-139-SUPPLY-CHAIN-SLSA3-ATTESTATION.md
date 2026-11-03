# SPEC-139: Supply Chain SLSA Level 3 & CycloneDX SBOM Verification

## 1. Specification Metadata
- **Specification ID**: `SPEC-139`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-061`, `SPEC-096`, `SPEC-123`, `SPEC-138`
- **Module Target**: `src/core/eosSlsaProvenanceSbom.ts`, `scripts/eos-generate-sbom.mjs`, `scripts/verify-supply-chain.mjs`, `.github/workflows/eos-sovereign-cicd.yml`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-01 (Ubiquitous / Permanent)**:
  `THE SYSTEM SHALL generate a deterministic CycloneDX v1.5 JSON Software Bill of Materials (SBOM) cataloging all application components and certifying 0 external runtime dependencies without third-party npm libraries.`

- **FR-02 (Ubiquitous / Permanent)**:
  `THE SYSTEM SHALL generate an in-toto Statement v1 with SLSA Provenance v1.0 predicate binding the buildDefinition, builder identity, source repository, and exact subject artifact SHA-256 digests.`

- **FR-03 (State-Driven / Supply Chain Validation)**:
  `WHILE verifying supply-chain attestation via scripts/verify-supply-chain.mjs, THE SYSTEM SHALL validate bit-for-bit SHA-256 congruence between local artifact bytes and provenance subject digests.`

- **FR-04 (Error / Unwanted Condition)**:
  `IF an SBOM or in-toto provenance file is missing, malformed, or has a mismatched SHA-256 subject digest, THEN THE SYSTEM SHALL abort with exit code 1 and record a blocking diagnostic finding.`

- **FR-05 (Event-Driven / OIDC Fork Isolation)**:
  `WHEN running automated CI/CD in GitHub Actions, THE SYSTEM SHALL execute keyless OIDC provenance signing strictly on push events to main, preventing permission failure on fork pull requests.`

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
SCENARIO: BDD-369 Generación Determinista de SBOM CycloneDX v1.5 y Provenance SLSA v1.0
  GIVEN el repositorio Glorian System en un estado limpio
  WHEN se ejecuta scripts/eos-generate-sbom.mjs
  THEN se generan docs/evidence/sbom.cdx.json y docs/evidence/provenance.intoto.jsonl
  AND el SBOM cumple el estándar CycloneDX v1.5 con runtimeDependenciesCount igual a 0
  AND el reporte in-toto Statement v1 contiene el digest SHA-256 exacto de los artefactos sujetos

SCENARIO: BDD-370 Rechazo Fail-Closed de Artefactos Alterados o Falsificados
  GIVEN un archivo de procedencia con un digest SHA-256 alterado o un archivo de código modificado
  WHEN se ejecuta scripts/verify-supply-chain.mjs
  THEN el verificador rechaza la atestación con código de salida 1
  AND emite un mensaje de error explícito indicando la falta de correspondencia criptográfica

SCENARIO: BDD-371 Verificación Soberana de Cadena de Suministro en CI/CD
  GIVEN el pipeline consolidado .github/workflows/eos-sovereign-cicd.yml
  WHEN se evalúa el job de atestación de cadena de suministro
  THEN el job cuenta con permisos id-token: write y attestations: write
  AND se restringe exclusivamente a eventos push sobre la rama main
```

---

## 4. Invariants & Non-Functional Requirements
- **NFR-01 (Layer-0 Pure Standard)**: 0 external runtime npm dependencies (`package.json` -> `dependencies: {}`).
- **NFR-02 (Fail-Closed Semantics)**: Any missing file or cryptographic mismatch causes immediate exit code 1.
- **NFR-03 (EU CRA Compliance)**: Emits compliant CycloneDX v1.5 JSON.
