# SPEC-193: Universal Project Doctor & SDLC Acceleration Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Product / Core Tooling
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / Spotify Soundcheck RFC-42 / Google SRE Readiness
- **Module**: `src/core/eosUniversalProjectDoctor.ts`
- **Composes**: SPEC-012 (Polyglot Adapter), SPEC-017 (Spotify Codex), SPEC-186 (Enterprise Facade)

---

## 1. Context and Rationale

Engineering organizations waste significant time bootstrapping, auditing, and maintaining CI/CD, security hygiene, and architectural standards across heterogeneous polyglot repositories. Developers switching between IDEs (Cursor and Google Antigravity) need an instant, non-destructive doctor tool that can evaluate any project directory, pinpoint security vulnerabilities or missing quality gates, and synthesize production-ready CI workflows in milliseconds.

This specification implements `EosUniversalProjectDoctor`, delivering an all-in-one repository diagnostic engine that scores codebase health across 5 pillars, detects credentials, and generates tailored GitHub Actions CI pipelines with zero external runtime npm dependencies.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-984 (Ubiquitous - Polyglot Stack Fingerprinting)**: `THE SYSTEM SHALL inspect target project indicators (package.json, Cargo.toml, go.mod, pyproject.toml, pubspec.yaml, pom.xml, CMakeLists.txt) and classify the project archetype with primary language and package manager.`

- **FR-985 (Ubiquitous - 5-Pillar Soundcheck Scoring)**: `THE SYSTEM SHALL evaluate target projects across 5 dimensions: (1) Security & Secret Hygiene, (2) Testing & Coverage Readiness, (3) CI/CD Automation, (4) Documentation & Governance, and (5) Dependency Health, outputting a composite score between 0 and 100.`

- **FR-986 (Ubiquitous - Secret Vulnerability Scanning)**: `THE SYSTEM SHALL scan unignored repository configuration and source files for plain secrets (AWS keys, private keys, API tokens), deducting score points and emitting specific remediation guidance.`

- **FR-987 (Event-Driven - Tailored CI/CD Synthesis)**: `WHEN requested, THE SYSTEM SHALL synthesize a production-grade, hardened GitHub Actions YAML workflow (.github/workflows/glorian-ci.yml) containing lint, typecheck, and test stages customized to the detected stack.`

- **FR-988 (Ubiquitous - Zero Dependencies)**: `THE SYSTEM SHALL execute all diagnostics, file inspections, and YAML generation using native Node.js standard modules.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-984 Polyglot stack detection across heterogeneous codebases
  GIVEN a repository path containing Cargo.toml
  WHEN diagnoseProject is executed
  THEN detectedArchetype is "RUST_CORE"
  AND primaryLanguage is "Rust"
  AND packageManager is "cargo"

SCENARIO: BDD-985 5-Pillar Soundcheck scoring
  GIVEN a project directory with tests, documentation, and CI workflows
  WHEN the doctor evaluates the repository
  THEN overallScore is between 0 and 100
  AND pillarScores contains scores for Security, Testing, CICD, Documentation, and Hygiene
  AND a deterministic sha256Receipt is generated

SCENARIO: BDD-986 Secret leak detection and score penalty
  GIVEN a project directory containing an AWS secret key pattern in a config file
  WHEN diagnoseProject scans the directory
  THEN securityPillar reflects a penalty
  AND detectedVulnerabilities includes "SECRET_LEAKAGE_DETECTED"

SCENARIO: BDD-987 Tailored GitHub Actions workflow synthesis
  GIVEN a detected Go microservice project
  WHEN generateCiWorkflow is called
  THEN the returned YAML contains "go-version"
  AND contains "go test -v -race ./..."
  AND contains "go vet ./..."

SCENARIO: BDD-988 CLI output and JSON formatting
  GIVEN the command "glorian doctor --json"
  WHEN executed against the current repository
  THEN valid JSON matching DoctorReport schema is emitted
```
