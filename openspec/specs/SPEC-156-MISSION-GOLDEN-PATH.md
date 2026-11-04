# SPEC-156: Mission Golden Path (Natural Language → Fail-Closed Big-Tech SDLC)

## Metadata
- **SPEC ID**: SPEC-156
- **Status**: APPROVED
- **Related**: SPEC-024, SPEC-044, SPEC-147, SPEC-152, SPEC-154, SPEC-155, North Star Spotify/Nubank
- **Module**: `src/core/eosMissionGoldenPathOrchestrator.ts`, MCP `eos_mission_run`, `test/eosMissionGoldenPath.test.mjs`

## EARS
- **FR-510 (Event-Driven)**: WHEN `eos_mission_run` receives a non-empty natural-language directive, THE SYSTEM SHALL execute ordered stages: amplify → mission direction → architecture → constitutional tribunal → Spotify institutional probe → domain Nubank probe (hard when fintech) → turbo verify → ledger seal.
- **FR-511 (Error)**: IF any mandatory stage fails, THEN THE SYSTEM SHALL return status BLOCKED or FAILED, SHALL NOT claim DONE, and SHALL include the failing stage id.
- **FR-512 (Ubiquitous)**: THE SYSTEM SHALL treat Spotify audio BS.1770 as N/A-pass for non-audio domains and SHALL hard-fail Nubank gates only for fintech/nubank domains.
- **FR-513 (Ubiquitous)**: THE SYSTEM SHALL NOT claim Level 5 or absolute perfection; epistemic label is MISSION_GOLDEN_PATH_WITHIN_TESTED_SCOPE.

## BDD
```gherkin
SCENARIO: BDD-480 Nominal mission on eos-system succeeds within tested scope
  GIVEN project root Eos-System with catalog-info.yaml and OpenSpec
  WHEN eos_mission_run runs directive "audit control plane health"
  THEN status is SUCCESS
  AND every mandatory stage exitCode is 0
  AND sha256Receipt matches /^[a-f0-9]{64}$/

SCENARIO: BDD-481 Empty directive fail-closed
  GIVEN EosMissionGoldenPathOrchestrator
  WHEN runMission is called with empty directive
  THEN status is FAILED
  AND failingStage is INPUT_VALIDATION

SCENARIO: BDD-482 Fintech domain applies Nubank hard gate
  GIVEN domainHint nubank
  WHEN runMission executes
  THEN stages include NUBANK_INSTITUTIONAL
  AND that stage is mandatory
```
