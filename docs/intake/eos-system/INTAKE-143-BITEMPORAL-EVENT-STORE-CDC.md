# INTAKE-143: Bitemporal Event Store & Change Data Capture (CDC) Governor

## Big Tech Immutable Ledger, Event Sourcing & CDC Stream Architecture (SPEC-281)

---

### 1. Context & Business Need

In modern data and financial architectures (Datomic, Kafka, Debezium, Nubank, Amazon DynamoDB Streams), standard mutable CRUD databases lose historical fidelity when rows are overwritten or deleted.
Key architectural challenges:

1. **Audit & Compliance Blindness**: When state is mutated in-place (`UPDATE users SET balance = 50`), there is no verifiable mathematical proof of past account balances or retroactive corrections.
2. **Temporal Ambiguity (Transaction Time vs Valid Time)**: A transaction recorded today at 17:00 might describe a financial trade or contract amendment that became legally valid yesterday at 09:00. Without two temporal dimensions, historical time-travel queries are fundamentally flawed.
3. **CDC & Real-Time Sync Fragility**: Microservice event replication without strict deduplication, idempotency, and ordered replay suffers from race conditions and split-brain states.

### 2. Big Tech References & Engineering Patterns

- **Richard Snodgrass Bitemporal Data Model (ISO SQL:2011)**: Tracking both `systemTime` (when the fact was recorded in the database) and `validTime` (when the fact occurred in reality).
- **Martin Fowler Event Sourcing & CQRS**: Complete persistence of all domain state changes as an immutable sequence of events; current state is a derived projection of the event stream.
- **Debezium / Kafka Connect CDC**: Change Data Capture streaming row-level mutations (`INSERT`, `UPDATE`, `DELETE`) with before/after state envelopes and exactly-once delivery guarantees via idempotency keys.

### 3. Proposed Core Capabilities

1. **Append-Only Bitemporal Event Log (`appendEvent`)**:
   - Stores immutable domain events with `streamId`, `eventType`, `payload`, `validTime`, `transactionTime`, and `idempotencyKey`.
   - Cryptographic SHA-256 hashing linking events to previous stream state.
2. **Exactly-Once Cryptographic Idempotency**:
   - Rejects or deduplicates duplicate `idempotencyKey` submissions without mutating state.
3. **Deterministic State Replay & Time Travel (`replayEvents`)**:
   - Reconstructs aggregate state at any point in the past along either the `validTime` or `transactionTime` axis.
4. **Change Data Capture (CDC) Stream Engine (`getChangeStream`)**:
   - Emits structured mutation envelopes with `operation` (`CREATE`, `UPDATE`, `DELETE`), `before` state, `after` state, and change diff.
5. **Cryptographic SHA-256 Receipt**:
   - Writes immutable stream proof to `docs/evidence/EVENTSTORE_RECEIPT.json`.
6. **CLI Integration & Parity**:
   - `eos toolchain:events:append <event.json>`: Appends and validates a domain event.
   - `eos toolchain:events:replay <streamId> [--as-of=ISO]`: Reconstructs entity state as of timestamp.
   - `eos toolchain:events:cdc <streamId>`: Emits CDC event feed for stream.

### 4. Constraints

- Pure Layer-0 TypeScript (`dependencies: {}` - Law V).
- Serverless function count remains strictly 12/12 (`SPEC-269`).
- Maximum module lines observed $\le 765$ lines (hard limit 800).
- 100% CLI catalog parity with `hygiene:audit` (375 commands upon completion).
