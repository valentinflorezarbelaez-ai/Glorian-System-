# SPEC-151: CycloneDX SBOM Generator

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Software supply-chain assurance requires a machine-readable inventory of what composes a release, so consumers and auditors can verify provenance and detect tampering. The NTIA minimum elements and the Google SLSA Level 3 doctrine — cited in the module header of `src/core/eosCycloneDxSbomGenerator.ts` — call for a Software Bill of Materials in a standard format. CycloneDX 1.5 is the chosen target format because it is JSON-native and widely consumable.

The `generateCycloneDxSbom` function performs a filesystem scan of the local `src/core` directory rather than querying any external registry. Because the project has zero runtime npm dependencies, the SBOM documents the internal Layer-0 modules themselves as components, each identified by a purl and a content digest. This keeps the bill of materials truthful about what actually ships.

The approach derives, for every TypeScript module, a component with a normalized name, a `pkg:npm/glorian/...` purl, a SHA-256 hash of the file contents, and a dependency edge extracted from its relative imports. The top-level component identity and version come from the project `package.json`, producing a self-contained, verifiable CycloneDX document.

## 2. Functional Requirements (EARS Syntax)

- **FR-601 (Ubiquitous - CycloneDX 1.5 Document Structure)**: The system shall produce a `CycloneDXSbom` whose `bomFormat` equals `"CycloneDX"`, whose `specVersion` equals `"1.5"`, whose `serialNumber` begins with `"urn:uuid:"`, and whose `version` equals 1.
- **FR-602 (Ubiquitous - Module Component Enumeration)**: The system shall enumerate every `.ts` file in the `src/core` directory of the supplied project root and emit one component per file with `type` `"library"` and a `name`/`purl` of the form `glorian:<name>` / `pkg:npm/glorian/<name>@1.0.0`, where `<name>` is the filename with the `.ts` suffix, a leading `eos` prefix and a `.types` suffix removed.
- **FR-603 (Ubiquitous - Content Integrity Hashing)**: The system shall compute a SHA-256 digest of each module's file contents and attach it as a single hash entry whose `alg` equals `"SHA-256"` and whose `content` is the 64-character hexadecimal digest.
- **FR-604 (Event-Driven - Dependency Graph Extraction from Imports)**: When a module imports another module via a relative `"./<name>.ts"` specifier that exists among the scanned files and is not `index`, the system shall record a dependency edge from the importing module's purl to the imported module's purl, de-duplicated.
- **FR-605 (Ubiquitous - Root Component and Tool Metadata)**: The system shall set `metadata.component` to an application named `"glorian-system"` with the version read from the project `package.json`, and shall record the generating tool as vendor `"Glorian"`, name `"eos-sbom-generator"`, version `"1.0.0"` along with an ISO timestamp.
- **FR-606 (Unwanted Condition - Absent Source Directory Handling)**: If the `src/core` directory does not exist under the supplied project root, then the system shall emit an empty `components` array instead of failing.

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-601 Generated document is a valid CycloneDX 1.5 structure
  GIVEN the project working directory
  WHEN generateCycloneDxSbom is invoked on it
  THEN bomFormat equals "CycloneDX" and specVersion equals "1.5"
  AND serialNumber starts with "urn:uuid:"
  AND metadata.component.name equals "glorian-system"
```

```gherkin
SCENARIO: BDD-602 Every internal module is a hashed library component
  GIVEN the SBOM generated from the project working directory
  WHEN its components are inspected
  THEN there are at least 150 components
  AND every component has type "library" and a purl starting with "pkg:npm/glorian/"
  AND every component's first hash has alg "SHA-256" and a 64-character content digest
```

```gherkin
SCENARIO: BDD-603 The dependency graph is populated
  GIVEN the SBOM generated from the project working directory
  WHEN its dependencies array is inspected
  THEN the array is not empty
```

```gherkin
SCENARIO: BDD-604 Component names and identifiers are normalized from filenames
  GIVEN a module file named "eosKernelPrimitives.ts" under src/core
  WHEN the SBOM is generated
  THEN its component name is "glorian:KernelPrimitives"
  AND its purl and bom_ref both equal "pkg:npm/glorian/KernelPrimitives@1.0.0"
```

## 4. Architecture Decision Records (ADRs)

- **ADR-151-1: Internal filesystem inventory instead of registry queries**

  - _Context_: The project declares zero runtime npm dependencies, so a registry-driven SBOM would be empty or misleading, and offline reproducibility is required.
  - _Decision_: Scan local `src/core` TypeScript modules and describe them as components with file-content hashes.
  - _Consequence_: The SBOM truthfully reflects the shipped source and needs no network, but it describes source modules rather than resolved package artifacts.

- **ADR-151-2: Purl scheme `pkg:npm/glorian/...` with SHA-256 digests**
  - _Context_: Consumers need a stable, unique identifier and a tamper-evidence digest per component.
  - _Decision_: Use `pkg:npm/glorian/<name>@1.0.0` as both `bom_ref` and `purl`, and attach `{ alg: "SHA-256", content: <64 hex> }` hashes.
  - _Consequence_: Components are uniformly addressable and verifiable, aligned with NTIA minimum-element expectations.

## 5. Atomic Task DAG

1. [x] **TASK-151-1**: Author this specification defining FR-601..FR-606 and BDD-601..BDD-604 for SBOM generation.
2. [x] **TASK-151-2**: Implement `src/core/eosCycloneDxSbomGenerator.ts` with `generateCycloneDxSbom`, module enumeration, hashing and dependency extraction.
3. [x] **TASK-151-3**: Implement BDD tests `BDD-500`..`BDD-501` in `test/eosBigTechObservability.test.mjs` (`describe("SPEC-151: ...")`).
