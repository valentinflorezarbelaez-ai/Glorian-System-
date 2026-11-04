# SPEC-159: Black Projects Triad Operating Doctrine (Skunk Works, DARPA, NRO Software Analogs)

## Metadata
- **SPEC ID**: SPEC-159
- **Status**: APPROVED_WITHIN_TESTED_SCOPE
- **Related**: SPEC-157, SPEC-158, SPEC-030, SPEC-139, SPEC-155
- **Module**: `src/core/eosBlackProjectsTriad.ts`, CLI `eos triad`, `test/eosBlackProjectsTriad.test.mjs`

## Vision (Disciplined & Honest)
Glorian incorporates the apex operational and structural doctrines of the world's most advanced aerospace, research, and reconnaissance organizations:
1. **Lockheed Martin Skunk Works**: Kelly Johnson's 14 Management & Engineering Rules (strict compartmentalization, bounded dependencies, small autonomous execution units, and zero-overhead communication).
2. **DARPA (Defense Advanced Research Projects Agency)**: Autonomous microsecond OODA loop (Observe-Orient-Decide-Act) for continuous closed-loop decision making, heuristic hypothesis evaluation, and formal invariant healing.
3. **NRO (National Reconnaissance Office)**: Multi-spectral Synthetic Aperture Radar (SAR) code penetration across three depth layers (Surface Optics, Atmospheric AST Graph, Subterranean Vulnerability/Secret Radar).

Glorian explicitly does **NOT** claim black-budget classified programs, military hardware, orbital assets, or Level 5 omnipotence; it implements verifiable, high-rigor software engineering analogs.

## EARS Requirements
- **FR-522 (Ubiquitous)**: `THE SYSTEM SHALL` expose Kelly Johnson's 14 Rules auditor that measures codebase discipline, boundary containment, and dependency isolation.
- **FR-523 (Event-Driven)**: `WHEN` an operational telemetry vector is ingested, `THE SYSTEM SHALL` execute a closed-loop DARPA OODA cycle (Observe, Orient, Decide, Act) with best-of-5 latency under 5000 µs, mutation kill-floor gate (>= 80) outside the timed window, and cryptographic attestation.
- **FR-524 (State-Driven)**: `WHILE` performing multi-spectral reconnaissance across target directories, `THE SYSTEM SHALL` execute NRO Synthetic Aperture Radar (SAR) penetration across 3 depths: Surface Manifest, Atmospheric AST, and Subterranean Secrets/Vulnerabilities.
- **FR-525 (Ubiquitous)**: `THE SYSTEM SHALL` include explicit `claimsDenied` in every triad audit report, confirming software engineering scope only.

## BDD Scenarios
```gherkin
SCENARIO: BDD-490 Skunk Works Kelly Johnson Rules Conformance
  GIVEN the EosBlackProjectsTriad engine
  WHEN auditKellyJohnsonRules is executed against the workspace
  THEN the compliance score is at or above 90%
  AND rule evaluations verify zero external runtime dependencies
  AND hermetic compartment bounds are confirmed
  AND a deterministic SHA-256 receipt is emitted

SCENARIO: BDD-491 DARPA Autonomous OODA Loop Execution
  GIVEN an anomalous telemetry state vector
  WHEN executeDarpaOodaCycle is invoked
  THEN the best-of-5 Observe, Orient, Decide, and Act phases complete in < 5000 µs
  AND the decision is deterministically recorded with action receipt
  AND a rollback/compensation snapshot is generated
  AND a mutation kill-floor gate (>= 80) is evaluated outside the timed OODA window

SCENARIO: BDD-492 NRO Synthetic Aperture Radar (SAR) Multi-Layer Penetration
  GIVEN a target workspace directory
  WHEN runNroSarDeepScan is executed
  THEN Surface Optics, Atmospheric AST, and Subterranean Security scans complete
  AND zero plain secrets are verified in the subterranean layer
  AND an orbital multi-spectral radar report with SHA-256 seal is generated
```
