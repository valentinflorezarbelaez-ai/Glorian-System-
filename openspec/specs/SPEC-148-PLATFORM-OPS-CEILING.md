# SPEC-148: Platform Ops Ceiling (LADDER-16)

## 1. Metadata
- **Specification ID**: `SPEC-148`
- **Status**: `APPROVED`
- **Ladder**: `LADDER-16` / `GATE-16`
- **Related**: `SPEC-147`, `SPEC-042`, `SPEC-110`, `SPEC-146`
- **Module**: `src/core/eosPlatformOpsCeiling.ts`, `test/eosPlatformOpsCeiling.test.mjs`

## 2. EARS Requirements

- **FR-450 (Ubiquitous / IDP SLOs)**: `THE SYSTEM SHALL evaluate Platform IDP SLOs for timeToGreenMs, gatePassRate, scorecardScore, and controlPlanePristine with fail-closed freeze when any SLO is breached.`
- **FR-451 (Event-Driven / Canary)**: `WHEN a successful product delivery requests canary promotion, THE SYSTEM SHALL advance EosProgressiveCanaryMesh stages 1%→5%→25%→100% and roll back if error or latency budgets breach.`
- **FR-452 (Ubiquitous / Dogfood)**: `THE SYSTEM SHALL require the hermetic dogfood product docs/products/demo-ledger-mvp to hold scorecard grade A+ or B with score >= 80 before ceiling tip-seal.`
- **FR-453 (Ubiquitous / IV&V Pack)**: `THE SYSTEM SHALL emit an IV&V readiness checklist covering Peak Assurance binder, PDO EVDs, platform SLO report, and canary receipt.`
- **FR-454 (Ubiquitous / Epistemic Honesty)**: `THE SYSTEM SHALL tip-seal epistemic state SOVEREIGN_CEILING_10_OF_10_WITHIN_TESTED_SCOPE and SHALL NOT emit NSA_GRADE, AEROSPACE_CERTIFIED, or ABSOLUTE_UNIVERSAL_PERFECTION.`

## 3. BDD

```gherkin
SCENARIO: BDD-430 IDP SLO nominal
  GIVEN delivery metrics within budget
  WHEN evaluatePlatformSlos runs
  THEN healthState is NOMINAL AND freezeDeployments is false

SCENARIO: BDD-431 IDP SLO breach freezes
  GIVEN gatePassRate below floor
  WHEN evaluatePlatformSlos runs
  THEN freezeDeployments is true AND healthState is not NOMINAL

SCENARIO: BDD-432 Canary promotes to 100% on clean telemetry
  GIVEN successful delivery with runCanary true and clean telemetry
  WHEN runCeilingAttestation executes canary
  THEN finalStage is FULL_PRODUCTION_100_PCT AND verifiedSafe is true

SCENARIO: BDD-433 Canary rolls back on error budget breach
  GIVEN telemetry with high error rate
  WHEN canary advances
  THEN rollbackExecuted is true OR circuitBreakerTripped is true

SCENARIO: BDD-434 Dogfood scorecard ceiling gate
  GIVEN docs/products/demo-ledger-mvp/scorecard.json
  WHEN assertDogfoodCeiling runs
  THEN score >= 80 AND grade in A+|B

SCENARIO: BDD-435 IV&V readiness and epistemic honesty
  GIVEN a complete ceiling attestation
  WHEN getCeilingEpistemicState is read
  THEN state is SOVEREIGN_CEILING_10_OF_10_WITHIN_TESTED_SCOPE
  AND forbiddenClaims do not include NSA_GRADE
```
