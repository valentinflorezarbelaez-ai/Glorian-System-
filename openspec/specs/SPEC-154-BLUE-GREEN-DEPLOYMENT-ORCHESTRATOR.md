# SPEC-154: Blue-Green Deployment Orchestrator with Validated Traffic Shifting and Rollback

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Releasing new service versions into the EOS fleet must never incur downtime or expose users to an unvalidated build. A release needs a deterministic, auditable sequence that stages the new version, validates it against health probes, shifts traffic progressively, and rolls back automatically when the validation gate fails. Without an enforced state machine, ad-hoc deployments allow illegal transitions and partial traffic states that corrupt availability.

This module adopts the production pattern of Netflix Spinnaker and Spotify Wingbeat: a finite state machine drives the cycle `IDLE → DEPLOYING_GREEN → VALIDATING → SHIFTING → PROMOTED → CLEANUP → IDLE`, where every transition is guarded so that an invalid move cannot occur. The `EosBlueGreenOrchestrator` class owns this machine.

Successful cycles emit a deterministic SHA-256 receipt over the canonical result so that each deployment is cryptographically evidence-able, satisfying Law III (Epistemic Evidence). The module carries zero external dependencies per Law V, relying only on the kernel primitives.

## 2. Functional Requirements (EARS Syntax)

- **FR-631 (Ubiquitous - Guarded Finite State Machine)**: `The EOS Blue-Green Orchestrator shall permit only transitions declared in its valid-transition table, raising a precondition failure when any illegal state change is attempted.`
- **FR-632 (Event-Driven - Staged Deploy and Validation Loop)**: `When a deploy cycle starts, the system shall transition to DEPLOYING_GREEN and then to VALIDATING, executing up to validationAttempts health-check probes of the green version at the configured interval.`
- **FR-633 (Unwanted Condition - Automatic Rollback on Health Failure)**: `If any health probe reports an unhealthy green version or an error rate above rollbackHealthThreshold, then the system shall transition to ROLLING_BACK, restore traffic to 100% blue / 0% green, and return a non-successful result without promotion.`
- **FR-634 (State-Driven - Progressive Traffic Shift and Promotion)**: `While validation is in progress and passes, the system shall shift trafficShiftPercent of routing to green (capped at 100), then transition through PROMOTED to place 100% of traffic on green before cleanup.`
- **FR-635 (Ubiquitous - Recorded Step Ledger)**: `The system shall record each transition as a step carrying the target state, a timestamp, the current traffic weights, and a human-readable message, exposing the full ordered sequence in the deploy result.`
- **FR-636 (Ubiquitous - Deterministic SHA-256 Receipt)**: `The system shall compute and return a SHA-256 receipt over the canonical result representation, and deeply freeze the resulting deploy result object.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-631 Successful deployment ends in IDLE
GIVEN an EosBlueGreenOrchestrator and a health check that always reports healthy with 0% error
WHEN a deploy cycle completes with validationAttempts 2 and trafficShiftPercent 100
THEN the result reports success true
AND the final state is IDLE
AND at least 5 steps were recorded

SCENARIO: BDD-632 Unhealthy green triggers ROLLING_BACK
GIVEN an EosBlueGreenOrchestrator with rollbackHealthThreshold 1
WHEN a deploy cycle runs a health check reporting unhealthy with 15% error
THEN the result reports success false
AND the final state is ROLLING_BACK

SCENARIO: BDD-633 Illegal transitions are rejected
GIVEN a fresh EosBlueGreenOrchestrator whose current state is IDLE
WHEN a transition to a state not reachable from IDLE is attempted
THEN the precondition guard fails
AND the orchestrator state remains unchanged

SCENARIO: BDD-634 Deployment emits a deterministic SHA-256 receipt
GIVEN a completed successful deploy cycle
WHEN the deploy result is inspected
THEN the result carries a non-empty sha256Receipt
AND the result object and its steps are frozen
```

## 4. Architecture Decision Records (ADRs)

- **ADR-154-1: Explicit finite state machine with a valid-transition table**
  - _Context_: Free-form deployment code permits illegal sequences (e.g., promoting a version that never validated) that silently corrupt traffic routing.
  - _Decision_: Model the lifecycle as a state machine and route every change through a guarded `transition()` that checks a declarative valid-transition table.
  - _Consequence_: Only well-formed deploy sequences are executable; illegal moves raise a precondition error before any state mutation.
- **ADR-154-2: Health-driven rollback inside the validation gate**
  - _Context_: A green version may pass deployment yet fail under real probe traffic, and letting it reach promotion would breach availability.
  - _Decision_: Evaluate health and the error-rate threshold during the validation loop and roll back to 100% blue immediately on any failure.
  - _Consequence_: Failed releases never receive prod traffic; rollback cost is one guarded transition back to a stable blue state.

## 5. Atomic Task DAG

1. [x] **TASK-154-1**: Author SPEC-154 with EARS requirements FR-631..FR-636 and BDD scenarios BDD-631..BDD-634.
2. [x] **TASK-154-2**: Implement the `EosBlueGreenOrchestrator` module (FSM, validation loop, traffic shifting, rollback, receipt).
3. [x] **TASK-154-3**: Add unit tests covering successful deployment, unhealthy rollback and receipt determinism.
4. [x] **TASK-154-4**: Integrate the scenario into the Big Tech Resilience test suite and confirm zero external dependencies.
