# SPEC-147: Product Delivery Orchestrator (LADDER-15 Big-Tech IDP)

## 1. Specification Metadata
- **Specification ID**: `SPEC-147`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Ladder**: `LADDER-15` / `GATE-15` Product Delivery Orchestrator (A Connect → B Enforce → C Measure)
- **Related Specs**: `SPEC-039`, `SPEC-040`, `SPEC-028`, `SPEC-014`, `SPEC-146`
- **Module Target**: `src/core/eosProductDeliveryOrchestrator.ts`, `test/eosProductDeliveryOrchestrator.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-440 (Event-Driven / Connect)**: `WHEN a ProductManifest is submitted to product:deliver (or eos_product_deliver_run), THE SYSTEM SHALL create a Foundry blueprint, validate hexagonal topology, materialize an SDD draft package under docs/products/<id>/ (or dry-run artifacts), and execute Sovereign Loop INTEL+GOVERNANCE stages.`
- **FR-441 (Unwanted / Law IV)**: `IF dryRun is false AND any Law IV precondition for an external satellite write is incomplete, THEN THE SYSTEM SHALL fail-closed with reason LAW_IV_INCOMPLETE and SHALL NOT write outside the control-plane product docs tree.`
- **FR-442 (Event-Driven / Enforce)**: `WHEN verification stages run, THE SYSTEM SHALL invoke VerificationGatePort adapters for turbo purity, secret-pattern scan, and mutation floor, recording exact exitCode evidence.`
- **FR-443 (Unwanted / Gate Fail)**: `IF any wired verification gate returns exitCode !== 0, THEN THE SYSTEM SHALL mark the stage FAILED, set epistemicState to REMEDIATION_REQUIRED, and SHALL NOT advance to DEPLOYMENT.`
- **FR-444 (Ubiquitous / Dual-Track)**: `THE SYSTEM SHALL route MVP/micro deliveries on FastTrack and ENTERPRISE|MISSION_CRITICAL|PLANETARY on HeavySddTrack.`
- **FR-445 (Ubiquitous / Scorecard)**: `THE SYSTEM SHALL compute ProductQualityScorecard (SpecCoverage, GatePassRate, MutationFloor, Layer0Purity, TimeToGreen, BlastRadiusKnown) with score 0–100 and grade A+|B|C.`
- **FR-446 (Ubiquitous / Mutation Floor)**: `THE SYSTEM SHALL require mutationScore >= 80 on the delivery admit snippet before Wave B seal.`

---

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: BDD-420 Dry-run connects Foundry to Sovereign Loop
  GIVEN a valid ProductManifest for demo-ledger-mvp
  WHEN deliverProduct is invoked with dryRun true
  THEN topology.valid is true
  AND intelGovernanceStagesCompleted >= 9
  AND sha256Receipt is a 64-char hex digest

SCENARIO: BDD-421 Law IV blocks external satellite materialization
  GIVEN dryRun false and lawIvComplete false
  WHEN deliverProduct targets an external satellite path
  THEN status is BLOCKED AND reason is LAW_IV_INCOMPLETE

SCENARIO: BDD-422 Gate failure stops deployment
  GIVEN a VerificationGatePort that returns exitCode 1 for turbo
  WHEN deliverProduct runs enforce mode
  THEN epistemicState is REMEDIATION_REQUIRED
  AND deploymentAttempted is false

SCENARIO: BDD-423 Dual-track routing
  GIVEN tier MVP
  WHEN resolveDeliveryTrack is invoked
  THEN track is FastTrack
  AND GIVEN tier MISSION_CRITICAL THEN track is HeavySddTrack

SCENARIO: BDD-424 Product quality scorecard threshold
  GIVEN a successful hermetic delivery
  WHEN computeProductQualityScorecard runs
  THEN score >= 80 AND grade is A+ or B

SCENARIO: BDD-425 Mutation floor on delivery admit
  GIVEN DELIVERY_MUTATION_TARGET_SNIPPET
  WHEN EosMutationTester evaluates with a strict admit oracle
  THEN mutationScore >= 80
```

---

## 4. Epistemic States

`NOT_INITIALIZED` → `PDO_CONNECTED_WITHIN_SCOPE` (Wave A) → `PDO_GATES_ENFORCED_WITHIN_SCOPE` (Wave B) → `PRODUCT_DELIVERY_ORCHESTRATOR_VERIFIED_WITHIN_SCOPE` (Wave C tip-seal).
