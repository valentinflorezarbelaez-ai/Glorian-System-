# CHANGE-143: Bitemporal Event Store & Change Data Capture (CDC) Governor (SPEC-281)

## 1. Metadata

- **Change ID**: `CHANGE-143`
- **Specification ID**: `SPEC-281`
- **Domain**: Event Sourcing, Bitemporal Data Architecture & Change Data Capture
- **Status**: `PROPOSED`
- **Target Release**: `v76.0.0`
- **Author**: Glorian Control Plane Core Team

## 2. Intent & Scope

Introduces enterprise-grade bitemporal event sourcing and Change Data Capture (CDC) streaming:

- Immutable append-only log with dual temporal coordinates (`validTime` and `transactionTime`).
- Exactly-once cryptographic idempotency enforcement via `idempotencyKey` and SHA-256 event chaining.
- Deterministic event replay with time-travel queries across both temporal dimensions.
- Change Data Capture (CDC) streaming engine emitting structured `CREATE`, `UPDATE`, and `DELETE` event envelopes with state diffs.
- CLI commands: `toolchain:events:append`, `toolchain:events:replay`, `toolchain:events:cdc`.
- Cryptographic SHA-256 verifiable receipts in `docs/evidence/EVENTSTORE_RECEIPT.json`.

## 3. Invariants Preserved

- `dependencies: {}` maintained (pure Layer-0 TypeScript).
- Exactly 12/12 serverless functions in `/api/`.
- All modules strictly $\le 765$ lines.
- 100% CLI catalog parity (375 commands).
- Cryptographic SHA-256 verifiable receipts in `docs/evidence/EVENTSTORE_RECEIPT.json`.
