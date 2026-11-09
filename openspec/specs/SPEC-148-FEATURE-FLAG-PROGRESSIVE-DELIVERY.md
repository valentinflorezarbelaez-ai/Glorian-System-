# SPEC-148: Feature Flag Progressive Delivery Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Deploying a capability to every entity at once couples release risk to blast radius: a single defect becomes a full outage. Progressive delivery decouples deployment from release by exposing changes to a growing fraction of traffic, with an operator-controlled kill switch. The module header of `src/core/eosFeatureFlagEngine.ts` cites the **Uber Magma / LaunchDarkly pattern** as the governing doctrine.

The `EosFeatureFlagEngine` provides deterministic percentage-based rollout. The assignment of an entity to a cohort must be stable across calls and processes so that a given user consistently sees the same variant; this is achieved by hashing `flagKey:entityId` with SHA-256 and reducing the first four bytes modulo 100 into a bucket in `[0, 99]`. The engine supports the flag states DISABLED, CANARY, GRADUAL and FULL.

The approach is a purely in-process, zero-dependency engine: it validates flag preconditions, enforces an immediate kill switch that overrides any rollout percentage, and returns an immutable evaluation with a SHA-256 receipt for auditability. Unknown flags are handled without throwing, returning an explicit `NOT_FOUND` reason.

## 2. Functional Requirements (EARS Syntax)

- **FR-571 (Ubiquitous - Deterministic Bucket Assignment)**: The system shall assign each `(flagKey, entityId)` pair to a bucket in the range 0-99 by computing SHA-256 of `"flagKey:entityId"`, reading the first four bytes as an unsigned 32-bit integer, and taking it modulo 100, such that repeated evaluations yield identical buckets and variants.
- **FR-572 (Event-Driven - Kill Switch Override)**: When `killSwitch(key)` is invoked on a registered flag, the system shall set its `killSwitch` flag to true, force its state to `DISABLED` and its `rolloutPercent` to 0, so that subsequent evaluations return variant `"off"` with reason `KILL_SWITCH` regardless of the previous percentage.
- **FR-573 (State-Driven - Percentage Rollout Evaluation)**: While a flag is enabled with a percentage strictly between 0 and 100, the system shall return variant `"on"` when the entity bucket is less than the rollout percentage and `"off"` otherwise, with reason `PERCENTAGE`; a percentage of 100 shall return `"on"` with reason `FULL_ROLLOUT`.
- **FR-574 (Unwanted Condition - Unknown Flag Handling)**: If `evaluate` is called with a flag key that is not registered, then the system shall return variant `"off"` with reason `NOT_FOUND` and bucket 0 rather than throwing.
- **FR-575 (Event-Driven - Flag Mutation and Precondition Validation)**: When `setFlag` is invoked, the system shall reject any flag whose `rolloutPercent` is outside 0-100 or whose `key` is empty; `setRollout` and `killSwitch` shall reject operations on unregistered keys.
- **FR-576 (Ubiquitous - Immutable Evaluation with Audit Receipt)**: The system shall return every flag definition and evaluation as a deep-frozen object, and each evaluation shall include a `sha256Receipt` computed over the canonical string `"flagKey|entityId|variant|reason|bucket"`.

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-571 Deterministic bucketing for the same entity
  GIVEN a GRADUAL flag "f1" with rolloutPercent 50
  WHEN the same entity "user-abc" is evaluated twice
  THEN both evaluations report the same bucket value
  AND both evaluations report the same variant
```

```gherkin
SCENARIO: BDD-572 Kill switch overrides the rollout percentage
  GIVEN a FULL flag "k1" with rolloutPercent 100 whose evaluation returns variant "on"
  WHEN killSwitch("k1") is invoked and the flag is evaluated again
  THEN the variant becomes "off"
  AND the evaluation reason equals "KILL_SWITCH"
```

```gherkin
SCENARIO: BDD-573 Zero percent disables everyone and 50 percent hits roughly half
  GIVEN a DISABLED flag "z" with rolloutPercent 0 and a GRADUAL flag "half" with rolloutPercent 50
  WHEN 20 entities are evaluated against "z" and 1000 entities against "half"
  THEN every evaluation of "z" returns variant "off"
  AND the number of "on" variants for "half" is between 400 and 600 inclusive
```

```gherkin
SCENARIO: BDD-574 Unknown flag returns NOT_FOUND safely
  GIVEN an engine with no flag named "missing"
  WHEN "missing" is evaluated for entity "u"
  THEN the result reason equals "NOT_FOUND"
  AND the result variant equals "off"
```

## 4. Architecture Decision Records (ADRs)

- **ADR-148-1: Stable SHA-256 bucketing instead of random assignment**

  - _Context_: A user must not flip between variants across evaluations or processes, and stored flag evaluations must be reproducible and auditable.
  - _Decision_: Derive the bucket from SHA-256 of `flagKey:entityId` reduced modulo 100, and attach a SHA-256 receipt to every evaluation.
  - _Consequence_: Cohort membership is deterministic and verifiable, at the cost of an unavoidable statistical variance around the target percentage.

- **ADR-148-2: Kill switch as an absolute override**
  - _Context_: During an incident operators must disable a capability immediately, independent of rollout state.
  - _Decision_: `killSwitch` forces `killSwitch=true`, `state="DISABLED"` and `rolloutPercent=0`, and evaluation short-circuits to reason `KILL_SWITCH`.
  - _Consequence_: Operators regain a guaranteed off-path without redeploying, while the flag definition remains inspectable.

## 5. Atomic Task DAG

1. [x] **TASK-148-1**: Author this specification defining FR-571..FR-576 and BDD-571..BDD-574 for progressive delivery.
2. [x] **TASK-148-2**: Implement `src/core/eosFeatureFlagEngine.ts` with `EosFeatureFlagEngine`, deterministic bucketing and kill-switch semantics.
3. [x] **TASK-148-3**: Implement BDD tests `BDD-470`..`BDD-474` in `test/eosBigTechObservability.test.mjs` (`describe("SPEC-148: ...")`).
