# SPEC-061 — SLSA LEVEL 4 PROVENANCE & CYCLONEDX v1.5 SBOM ENGINE
**Version**: 66.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-054  
**Architecture Decision Record**: ADR-066  
**Domain Layer**: Layer-0 System Core (`src/core/eosSlsaProvenanceSbom.ts`)

---

## 1. Executive Summary
Inspired by the OpenSSF (Open Source Security Foundation), Google SLSA (Supply-chain Levels for Software Artifacts), and CISA Cybersecurity Executive Orders, SPEC-061 formalizes the EOS SLSA Level 4 Provenance and CycloneDX v1.5 SBOM Engine. Operating under strict Layer-0 purity with zero external runtime npm dependencies, the engine inventories source components, computes deterministic cryptographic hashes, generates machine-readable CycloneDX v1.5 JSON Software Bill of Materials (SBOM), synthesizes in-toto compliant SLSA Provenance v1.0 statements, and persists tamper-evident receipts into the durable SQLite WAL ledger.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-201: Generación Hermética de SBOM CycloneDX v1.5
**Event-Driven**: CUANDO el usuario o pipeline invoca la auditoría de cadena de suministro (`eos sbom`), EL SISTEMA escaneará el árbol de fuentes del proyecto y generará un manifiesto CycloneDX v1.5 JSON válido con serialNumber UUIDv4, metadatos del componente y digests SHA-256 de cada archivo.

### FR-202: Declaración Formal de 0 Dependencias de Runtime
**Ubiquitous / Permanent**: EL SISTEMA formalizará en el SBOM que la lista de dependencias directas en runtime es estrictamente vacía (`dependencies: {}`), certificando la pureza de Capa 0 de EOS System.

### FR-203: Generación de Declaración de Procedencia SLSA v1.0
**Event-Driven**: CUANDO se solicita la atestación de procedencia (`eos slsa`), EL SISTEMA generará una declaración in-toto estándar (`https://in-toto.io/Statement/v1`) con predicateType `https://slsa.dev/provenance/v1`, registrando el digest del commit, los parámetros del builder y la receta hermética de construcción.

### FR-204: Validación de Integridad Criptográfica de la Cadena de Suministro
**State-Driven**: MIENTRAS se evalúa la atestación SLSA, EL SISTEMA verificará que todos los artefactos sujetos poseen hashes SHA-256 coincidentes bit a bit con los archivos físicos del árbol de trabajo.

### FR-205: Persistencia en Ledger SQLite WAL
**Ubiquitous / Permanent**: EL SISTEMA registrará las atestaciones SBOM y SLSA en `EosDurableSqliteLedger` bajo la categoría `SECURITY_AUDIT` con sello SHA-256 inmutable.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-188: Deterministic CycloneDX v1.5 SBOM Generation
```gherkin
ESCENARIO: Generación de SBOM CycloneDX v1.5 Válido
  DADO un repositorio EOS System con 116 módulos de Capa 0
  CUANDO el motor EosSlsaProvenanceSbom genera el SBOM
  ENTONCES produce un objeto JSON conforme a CycloneDX v1.5
  Y la lista de componentes contiene los módulos clave con sus digests SHA-256
  Y declara 0 dependencias externas de runtime
```

### BDD-189: In-Toto SLSA Provenance v1.0 Attestation
```gherkin
ESCENARIO: Síntesis de Atestación de Procedencia SLSA v1.0
  DADO un commit y árbol de trabajo de EOS System
  CUANDO el motor sintetiza la declaración SLSA
  ENTONCES genera el predicado https://slsa.dev/provenance/v1
  Y vincula los artefactos sujetos con su digest criptográfico
  Y calcula un recibo SHA-256 sellado en el Ledger SQLite WAL
```
