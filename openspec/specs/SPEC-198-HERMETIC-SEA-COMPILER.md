# SPEC-198: Hermetic Single-Executable Application (SEA) Binary Compiler

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Product / Core Tooling
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / Node.js 24 SEA / SLSA Level-4
- **Module**: `src/core/eosHermeticSeaCompiler.ts`
- **Composes**: SPEC-098 (SEA Packager), SPEC-192 (SLSA Supply Chain), SPEC-067 (Hermetic Release Sealer)

---

## 1. Context and Rationale

In sovereign, air-gapped, defense, and edge computing environments (satellite payloads, bare-metal servers, distroless microVMs), requiring an ambient Node.js installation or package manager creates runtime vulnerabilities and operational friction.

`EosHermeticSeaCompiler` implements a deterministic pipeline that compiles Glorian into a single standalone binary executable, embeds the application blob, signs the executable with Ed25519 digital signatures, and seals it with in-toto SLSA Level-4 provenance under strict zero-dependency invariants.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-1009 (Ubiquitous - Declarative SEA Configuration & Blob Compilation)**: `THE SYSTEM SHALL generate sea-config.json and compile an uncompressed Node.js Single Executable Application blob with experimental warning disabled.`

- **FR-1010 (Event-Driven - Standalone Native Executable Synthesis)**: `WHEN compileStandaloneBinary is invoked, THE SYSTEM SHALL clone the platform host runtime to dist/glorian-[platform], inject the SEA blob into the binary segment, set executable permissions, and verify execution integrity.`

- **FR-1011 (Event-Driven - Ed25519 Digital Signature Sealing)**: `WHEN signing is enabled, THE SYSTEM SHALL generate or utilize an Ed25519 keypair, sign the compiled binary digest, and embed the detached cryptographic signature.`

- **FR-1012 (Event-Driven - SLSA Level-4 Provenance Generation)**: `THE SYSTEM SHALL generate an in-toto v1.0 / SLSA Provenance v1.0 statement certifying the binary subject SHA-256 digest, builder ID, and hermetic build environment.`

- **FR-1013 (Ubiquitous - Cryptographic Receipt Generation)**: `THE SYSTEM SHALL emit a tamper-evident SHA-256 compiler receipt containing output path, binary size in bytes, SHA-256 digest, and signature metadata.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-1009 Declarative SEA config and blob generation
  GIVEN the project source tree
  WHEN compileBlob is executed
  THEN dist/glorian.blob is generated
  AND its SHA-256 checksum is recorded

SCENARIO: BDD-1010 Standalone native executable synthesis
  GIVEN a valid SEA blob
  WHEN compileStandaloneBinary is invoked for the current platform
  THEN an executable binary dist/glorian-[platform] is synthesized
  AND the binary has execute permissions (mode 0o755)
  AND the binary file size is greater than 10MB

SCENARIO: BDD-1011 Ed25519 digital signature sealing
  GIVEN a synthesized native binary
  WHEN signBinary is executed
  THEN an Ed25519 signature is generated and verified against the binary's SHA-256 digest

SCENARIO: BDD-1012 SLSA Level-4 Provenance generation
  GIVEN a signed standalone binary
  WHEN generateProvenance is invoked
  THEN a valid in-toto v1.0 statement is emitted with predicateType "https://slsa.dev/provenance/v1"
  AND the binary subject matches the output executable digest

SCENARIO: BDD-1013 End-to-end CLI invocation
  GIVEN the Glorian CLI
  WHEN glorian compile --dry-run --json is executed
  THEN a valid JSON compilation report is emitted with targetPlatform, binaryPath, and sha256Receipt
```

---

## 4. Architectural Invariants

1. **Law I (Zero Vibe Coding)**: Binary synthesis and resource injection are strictly deterministic.
2. **Law V (Zero Runtime Dependencies)**: Operates using Node.js standard modules (`node:fs`, `node:path`, `node:crypto`, `node:child_process`).
3. **Law VII (Layer-0 Isolation)**: Compiler outputs are hermetically confined to `dist/`.
