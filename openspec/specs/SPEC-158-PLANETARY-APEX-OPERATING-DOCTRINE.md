# SPEC-158: Planetary Apex Operating Doctrine (Software Drills)

## Metadata
- **SPEC ID**: SPEC-158
- **Status**: APPROVED_WITHIN_TESTED_SCOPE
- **Related**: SPEC-030, SPEC-139, SPEC-155, SPEC-156, Apex Doctrine Scorecard
- **Module**: `src/core/eosPlanetaryApexDoctrine.ts`, CLI `eos doctrine`, `test/eosPlanetaryApexDoctrine.test.mjs`

## Vision (honest)
Glorian borrows **operating doctrines** from civilizational bottleneck organizations (ASML timing discipline, SpaceX TMR, DeepMind evidence rigor, DARPA isolation, NSA-style attestation hygiene).

Glorian does **not** claim physical monopolies, orbital capability, black-budget parity, or Level 5.

## EARS Requirements
- **FR-518 (Ubiquitous)**: `THE SYSTEM SHALL` expose a planetary apex doctrine drill that measures software-analog pillars with cryptographic receipts.
- **FR-519 (State-Driven)**: `WHILE` adjudicating three independent vectors, `THE SYSTEM SHALL` apply TMR 2-of-3 consensus and report dissent.
- **FR-520 (Error)**: `IF` Layer-0 runtime dependencies are non-zero OR CORE_TIER0 tools are not registry-migrated OR SLSA/SBOM evidence is missing, `THEN THE SYSTEM SHALL` mark the corresponding pillar non-compliant.
- **FR-521 (Ubiquitous)**: `THE SYSTEM SHALL` deny Level 5 / physical monopoly / black-budget claims in every apex report (`claimsDenied`).

## BDD Scenarios
```gherkin
SCENARIO: BDD-488 Planetary Apex Doctrine validates multi-pillar conformance
  GIVEN the EosPlanetaryApexDoctrine engine
  WHEN auditPillars is executed
  THEN status is APEX_DRILL_PASS within tested scope
  AND epistemicState is APEX_DRILL_WITHIN_TESTED_SCOPE
  AND claimsDenied includes Level 5
  AND all 5 pillars are compliant with measurable evidence
  AND sha256Receipt is a 64-character hex digest

SCENARIO: BDD-489 SpaceX TMR Consensus Adjudication
  GIVEN three independent calculation vectors
  WHEN one vector suffers a simulated Byzantine fault
  THEN the TMR adjudicator selects the 2-of-3 supermajority
  AND reports the dissenting node
```
