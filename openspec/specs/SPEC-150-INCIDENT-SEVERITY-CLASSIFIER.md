# SPEC-150: Incident Severity Classifier

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Escalation decisions made under stress are inconsistent: identical incidents get paged, ticketed or ignored depending on who is on call. A deterministic classifier converts objective incident signals into a severity tier and a fixed set of escalation actions, removing human judgement from the first triage step. The module header of `src/core/eosIncidentSeverityClassifier.ts` cites the **Google SRE / PagerDuty incident taxonomy** as the governing doctrine.

The `EosIncidentSeverityClassifier` maps an `IncidentSignal` — burn-rate multiplier, blast-radius percentage, duration in minutes, data-loss indicator, customer-facing flag and remaining error budget — onto one of five severities P0 through P4. Each severity carries a fixed set of escalation actions, an auto-revert flag, a war-room requirement and a post-mortem requirement, in addition to a human-readable rationale.

The approach evaluates an ordered rule list and selects the first matching rule, with P4 as a catch-all that guarantees a classification for every input. The classifier is dependency-free, freezes its input and output, and attaches a SHA-256 receipt so that any triage decision is reproducible and auditable.

## 2. Functional Requirements (EARS Syntax)

- **FR-591 (State-Driven - P0 Critical Classification)**: While an incident signal indicates data loss, or is customer-facing with a blast radius of at least 50 percent and a burn-rate multiplier of at least 14.4, the system shall classify it as P0 with actions `PAGE_ONCALL`, `ESCALATE_LEAD`, `TICKET`, with auto-revert, war-room and post-mortem all required.
- **FR-592 (State-Driven - P1 Major Classification)**: While an incident signal is customer-facing and has either a blast radius of at least 20 percent or a burn-rate multiplier of at least 6, and does not match P0, the system shall classify it as P1 with actions `PAGE_ONCALL` and `TICKET`, requiring auto-revert, war-room and post-mortem.
- **FR-593 (State-Driven - P2 Moderate Classification)**: While an incident signal has a blast radius of at least 5 percent, or a burn-rate multiplier of at least 1, or a remaining error budget below 25 percent, and does not match a higher severity, the system shall classify it as P2 with actions `ESCALATE_LEAD` and `TICKET` and a post-mortem requirement, without auto-revert or war-room.
- **FR-594 (State-Driven - P3 Minor Classification)**: While an incident signal has a blast radius of at least 1 percent or a remaining error budget below 50 percent, and does not match a higher severity, the system shall classify it as P3 with actions `TICKET` and `LOG_ONLY`.
- **FR-595 (Unwanted Condition - P4 Catch-All for Noise)**: If an incident signal matches none of the P0-P3 rules, then the system shall classify it as P4 with the single action `LOG_ONLY`, without auto-revert, war-room or post-mortem.
- **FR-596 (Ubiquitous - Immutable Classification with Audit Receipt and Rule Introspection)**: The system shall freeze the input signal and the returned `SeverityClassification`, attach a `sha256Receipt` computed over the canonical `{ severity, burnRate, blast }` summary, and expose the severity-to-rationale mapping through `getRules()`.

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-591 Data loss forces P0 with on-call paging and auto-revert
  GIVEN a signal with burnRateMultiplier 1, blastRadiusPercent 10, durationMinutes 5, dataLoss true, customerFacing false and errorBudgetRemaining 50
  WHEN the classifier classifies the signal
  THEN the severity equals "P0"
  AND autoRevert is true
  AND the actions include "PAGE_ONCALL"
```

```gherkin
SCENARIO: BDD-592 Large customer blast at fast-burn rate forces P0
  GIVEN a customer-facing signal with burnRateMultiplier 20, blastRadiusPercent 60 and errorBudgetRemaining 5
  WHEN the classifier classifies the signal
  THEN the severity equals "P0"
```

```gherkin
SCENARIO: BDD-593 Customer-facing moderate blast classifies as P1
  GIVEN a customer-facing signal with burnRateMultiplier 6, blastRadiusPercent 30 and errorBudgetRemaining 20
  WHEN the classifier classifies the signal
  THEN the severity equals "P1"
```

```gherkin
SCENARIO: BDD-594 Low blast with healthy budget falls through to P4 noise
  GIVEN a non-customer-facing signal with burnRateMultiplier 0.1, blastRadiusPercent 0, dataLoss false and errorBudgetRemaining 95
  WHEN the classifier classifies the signal
  THEN the severity equals "P4"
  AND the actions equal exactly ["LOG_ONLY"]
```

## 4. Architecture Decision Records (ADRs)

- **ADR-150-1: Ordered first-match rule list with a P4 catch-all**

  - _Context_: Classification must always terminate with a defined severity, and severity boundaries must be unambiguous.
  - _Decision_: Evaluate rules in descending severity order and select the first match; the final P4 rule matches unconditionally.
  - _Consequence_: Every signal receives a deterministic severity, and precedence between overlapping conditions is explicit rather than emergent.

- **ADR-150-2: Severity carries fixed action, revert, war-room and post-mortem sets**
  - _Context_: Incident responders should not have to infer escalation behaviour from a numeric tier alone.
  - _Decision_: Bind each severity to a constant `actions` tuple plus `autoRevert`, `warRoomRequired` and `postMortemRequired` flags, and freeze the output with a SHA-256 receipt.
  - _Consequence_: Escalation is fully determined and auditable from the classification output, at the cost of a fixed policy that must be updated in code to change.

## 5. Atomic Task DAG

1. [x] **TASK-150-1**: Author this specification defining FR-591..FR-596 and BDD-591..BDD-594 for incident severity classification.
2. [x] **TASK-150-2**: Implement `src/core/eosIncidentSeverityClassifier.ts` with `EosIncidentSeverityClassifier.classify` and the ordered P0-P4 rule table.
3. [x] **TASK-150-3**: Implement BDD tests `BDD-490`..`BDD-494` in `test/eosBigTechObservability.test.mjs` (`describe("SPEC-150: ...")`).
