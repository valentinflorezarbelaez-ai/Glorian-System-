# SPEC-182: Schema Registry With Compatibility Modes

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Services that exchange messages over time must evolve their record schemas without breaking live producers and consumers. The `eosSchemaRegistry` Layer-0 module implements the governance model used by Confluent Schema Registry and Apicurio: schemas are versioned per subject, and each new version is validated against the previous one according to a configurable compatibility mode before it is accepted.

Four modes are supported. `BACKWARD` (the default) guarantees a new reader can read old data, rejecting removal of a required field, a field-type change and addition of a required field without a default. `FORWARD` guarantees an old reader can read new data, rejecting any dropped field and any type change. `FULL` enforces both. `NONE` accepts any evolution and is intended only for deliberately unversioned subjects. An incompatible candidate is rejected with an `incompatible schema` error and the subject history is left untouched.

The module honours Law V (Zero External Runtime Dependencies): it uses only `pureSha256`, `deepFreeze` and `assertPrecondition` from `src/core/eosKernelPrimitives.ts`, sorts fields canonically before hashing, and exposes a registry-level digest that is identical across content-equal registries.

## 2. Functional Requirements (EARS Syntax)

- **FR-911 (Ubiquitous - Versioned Registration)**: `The system shall assign monotonically increasing integer versions per subject, always accept the first registration as version 1, and canonically sort fields by name before computing the content digest.`

- **FR-912 (Event-Driven - Backward Compatibility Enforcement)**: `WHEN a schema is registered under BACKWARD or FULL mode, the system shall reject removal of a required field, any field-type change, and addition of a required field that has no default value.`

- **FR-913 (Event-Driven - Forward Compatibility Enforcement)**: `WHEN a schema is registered under FORWARD or FULL mode, the system shall reject dropping any field present in the previous schema and any field-type change.`

- **FR-914 (State-Driven - NONE Mode Bypass)**: `WHILE a subject is configured with NONE mode, the system shall accept any subsequent schema for that subject without performing compatibility checks.`

- **FR-915 (Unwanted Condition - Incompatible Rollout Rejection)**: `IF a candidate schema violates the active compatibility mode, THEN the system shall abort registration with an "incompatible schema" error and leave the subject's version history unchanged.`

- **FR-916 (Ubiquitous - History and Stable Registry Digest)**: `The system shall expose per-subject version history, the latest record, a sorted subject listing, and a registry-level SHA-256 digest that is identical for content-equal registries.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-911 First Registration Is Always Accepted
  GIVEN an empty schema registry
  WHEN a "user" subject is registered for the first time
  THEN the returned schema has version 1

SCENARIO: BDD-912 BACKWARD Mode Accepts an Added Optional Field
  GIVEN a "user" subject registered with required fields id and name
  WHEN a second schema adds an optional "nickname" field
  THEN the registration succeeds and the new schema is version 2

SCENARIO: BDD-913 BACKWARD Mode Rejects Removal of a Required Field
  GIVEN a "user" subject in BACKWARD mode with a required "name" field
  WHEN a new schema omits the required "name" field
  THEN registration throws an error matching "incompatible schema"
  AND the subject history remains at its previous version

SCENARIO: BDD-914 Field Type Change Always Breaks Compatibility
  GIVEN a "user" subject in FULL mode where field "id" is of type int
  WHEN a new schema changes "id" to type string
  THEN registration throws an error matching "type change"
  AND the new version is not persisted
```

## 4. Architecture Decision Records (ADRs)

- **ADR-182-1: Per-Subject Compatibility Modes With BACKWARD Default**

  - _Context_: Different subjects have different rollout safety requirements; a single global mode is either too strict or too permissive.
  - _Decision_: Compatibility is configured per subject via `setMode`, defaulting to BACKWARD so that safe-by-default evolution requires no explicit configuration.
  - _Consequence_: Fine-grained governance with secure defaults, at the cost of tracking a mode map per registry.

- **ADR-182-2: Canonical Field Sorting Feeds a Content Digest**
  - _Context_: Field order should not affect schema identity, otherwise semantically identical schemas would appear as different versions.
  - _Decision_: Fields are sorted by name before the SHA-256 digest is computed, and the registry digest aggregates the sorted per-subject digests.
  - _Consequence_: Stable, deduplicable identities across content-equal registries.

## 5. Atomic Task DAG

1. [x] **TASK-182-1**: Author this SPEC (EARS + BDD) formalising the four compatibility modes and their violation rules.
2. [x] **TASK-182-2**: Implement `EosSchemaRegistry` in `src/core/eosSchemaRegistry.ts` (setMode, register, checkCompat, compareSchemas, latest, history, listSubjects, registryDigest).
3. [x] **TASK-182-3**: Add the `node:test` suite covering every BDD scenario (first registration, optional add, required removal, type change, NONE bypass, history monotonicity) in `test/eosBigTechCoordination.test.mjs`.
4. [x] **TASK-182-4**: Verify Layer-0 purity (zero external dependencies) and that incompatible registrations leave history unchanged.
