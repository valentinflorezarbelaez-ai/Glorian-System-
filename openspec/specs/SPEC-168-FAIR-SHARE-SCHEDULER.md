# SPEC-168: Multi-Tenant Fair-Share Scheduler with Deficit Round Robin

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arboláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Shared compute capacity must be divided between tenants so that a single noisy tenant cannot starve the others, while still allowing idle capacity to be burst-consumed by tenants that need it. The `EosFairShareScheduler` module implements a weighted fair-share allocation modeled on the Kubernetes / YARN capacity and fair-share schedulers, evaluated once per scheduling epoch.

Each tenant declares a weight, a guaranteed floor, and a burstable ceiling. Within an epoch the scheduler first satisfies guaranteed floors, then distributes any remaining capacity to tenants with pending demand in descending deficit-to-weight ratio, always bounded by each tenant's ceiling headroom. This two-phase allocation delivers fairness to modest tenants while rewarding hungry ones with spare capacity.

The scheduler records per-tenant backlog and flags starvation (positive backlog with zero grant) so operators can detect under-service. It exposes a deterministic per-epoch allocation fingerprint for reproducible comparison and depends only on Layer-0 primitives.

## 2. Functional Requirements (EARS Syntax)

- **FR-771 (Ubiquitous - Tenant Registration Contracts)**: `The system shall register a tenant only when its weight is positive and its ceiling is greater than or equal to its guaranteed floor, initializing the tenant's pending demand and served history to zero.`
- **FR-772 (Unwanted Condition - Unknown Tenant Rejection)**: `IF submit is called for a tenant that has not been registered, THEN the system shall reject the submission through a failed precondition instead of silently queuing demand.`
- **FR-773 (State-Driven - Guaranteed Floors First)**: `WHILE distributing an epoch's capacity, the system shall grant each tenant up to min(pendingDemand, guaranteed, remainingCapacity) before any burst allocation is considered.`
- **FR-774 (Event-Driven - Weighted Surplus Allocation)**: `WHEN capacity remains after guaranteed floors are satisfied, the system shall allocate surplus to tenants with pending demand ordered by descending deficit-to-weight ratio, bounded by each tenant's ceiling headroom.`
- **FR-775 (State-Driven - Starvation Detection per Epoch)**: `WHILE recording per-epoch allocations, the system shall flag a tenant as starved when it has positive backlog and was granted zero units in that epoch.`
- **FR-776 (Ubiquitous - Deterministic Epoch Accounting)**: `The system shall increment currentEpoch on each schedule() call, accumulate totalServed per tenant, and expose allocationFingerprint(allocations) as a deterministic pureSha256 digest over tenant id, backlog, and starvation flag.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-771 Guaranteed floors are honored for every tenant
  GIVEN two tenants t1 and t2 each registered with guaranteed 5 and ceiling 10, each submitting demand 20
  WHEN schedule(100) runs one epoch
  THEN totalServed("t1") is at least 5
  AND totalServed("t2") is at least 5
```

```gherkin
SCENARIO: BDD-772 Ceiling caps burst allocation
  GIVEN a tenant "small" with guaranteed 2 and ceiling 4 submitting demand 100
  WHEN schedule(1000) runs with abundant capacity
  THEN totalServed("small") is at most 4
```

```gherkin
SCENARIO: BDD-773 Surplus favors the higher-deficit tenant and unknown tenants are rejected
  GIVEN "hungry" submitting 40 and "modest" submitting 5, both with guaranteed 1 and ceiling 50
  WHEN schedule(100) runs
  THEN totalServed("hungry") is at least totalServed("modest")
  AND submitting for an unregistered tenant throws an "unknown tenant" error
```

```gherkin
SCENARIO: BDD-774 Allocation fingerprint is deterministic for identical inputs
  GIVEN two independently built schedulers with the same tenants "a" and "b" and identical demand and capacity
  WHEN each scheduler produces its allocations for the epoch
  THEN allocationFingerprint of both results is identical
```

## 4. Architecture Decision Records (ADRs)

- **ADR-168-1: Two-phase allocation (floors then weighted surplus) with ceiling bound**

  - _Context_: A purely proportional split cannot guarantee a floor to modest tenants, and an unbounded burst lets greedy tenants monopolize spare capacity.
  - _Decision_: Satisfy guaranteed floors first, then distribute remaining capacity by descending deficit/weight ratio, clamped to each tenant's ceiling headroom.
  - _Consequence_: Every tenant is protected by its floor while idle capacity is exploited, but an epoch's outcome depends on registration order for ties and on declared ceilings.

- **ADR-168-2: Per-epoch records with explicit starvation flags and a deterministic fingerprint**
  - _Context_: Operators must detect tenants that are being starved, and must be able to compare scheduling decisions across runs.
  - _Decision_: Emit an immutable Allocation per tenant per epoch including backlog and a starved flag, and derive `allocationFingerprint()` from a canonical serialization of these fields.
  - _Consequence_: Under-service is observable and decisions are reproducible, at the cost of holding diagnostics in memory only for the returned epoch.

## 5. Atomic Task DAG

1. [x] **TASK-168-1**: Author SPEC-168 defining fair-share requirements, BDD scenarios, and ADRs.
2. [x] **TASK-168-2**: Implement `src/core/eosFairShareScheduler.ts` with tenant registration, demand queueing, two-phase allocation, and starvation reporting.
3. [x] **TASK-168-3**: Add the `SPEC-168` suite to `test/eosBigTechTransactions.test.mjs` covering floors, ceilings, surplus ordering, unknown-tenant rejection, and fingerprints.
4. [x] **TASK-168-4**: Verify with `npm run typecheck` and the CI pipeline stages (7/7 exit code 0).
