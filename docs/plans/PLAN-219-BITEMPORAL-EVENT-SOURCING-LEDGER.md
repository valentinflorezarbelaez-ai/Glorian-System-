# PLAN-219: Architecture Plan for Autonomous Bitemporal Event Sourcing Hyper-Ledger

## 1. Architectural Overview & Context

- **Spec / Change**: `SPEC-357` / `CHANGE-219`
- **Domain**: Bitemporal Event Stores, Immutable Ledgers, LIDR Agentic SDLC Governance
- **Archetype**: Rich Hickey (Datomic Immutable Facts), Greg Young (Event Sourcing & Projections), Álvaro Moya / LIDR (Agentic Engineer Starter), Leslie Lamport (Linearizable State Machines)

---

## 2. Architecture Decisions (ADRs)

### ADR-219-001: Bitemporal 2D Coordinate Space (Transaction-Time vs Valid-Time)

- **Status**: `APPROVED`
- **Context**: In AI-driven agentic engineering, agents make retroactive corrections or discover requirements drift after the fact. Overwriting mutable records destroys historical truth and makes forensic auditing impossible.
- **Decision**: Model every fact as an immutable Datom with two independent time coordinates:
  - **Transaction Time ($T_x$)**: Physical wall-clock / monotonic counter recording when the event was sealed in the ledger.
  - **Valid Time ($V_t$)**: Domain interval `[validFrom, validTo]` indicating when the fact holds true in the business/system universe.
- **Consequences**: Queries can travel back in time along either axis independently (`asOfTx`, `asOfValid`, or joint 2D `asOf(tx, vt)`).

### ADR-219-002: Immutable Append-Only Event Sourcing with Snapshot Projection Engine

- **Status**: `APPROVED`
- **Context**: Full event replay across millions of historical events can become slow without caching.
- **Decision**: Store events in an append-only log with SHA-256 parent hash chaining. Implement an in-memory snapshot projection cache that stores entity state at checkpoint intervals ($K=1000$ txs). Point-in-time queries seek to the nearest snapshot and fold only residual delta events.
- **Consequences**: Constant-time state reconstruction with sub-millisecond query turnaround while preserving 100% mathematical auditability.

---

## 3. Bitemporal 2D Coordinate Plane Blueprint

```text
               Transaction Time (Tx) -> Monotonic System Record Time
              |
              |     o Fact F1 recorded at Tx=100 (Believed valid: [2026-11-01, Infinity))
              |
              |     o Fact F2 recorded at Tx=200: Correction! Retroactively declares
              |       Fact F1 was only valid until 2026-11-10, and F2 valid from 2026-11-10.
              |
              +------------------------------------------------------------>
                                            Valid Time (Vt) -> Real-World Domain Time
```
