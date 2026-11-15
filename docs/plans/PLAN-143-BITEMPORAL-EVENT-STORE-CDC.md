# PLAN-143: Bitemporal Event Store & Change Data Capture (CDC) Governor

## Event Sourcing, Bitemporal Architecture & CDC Streaming (SPEC-281)

---

### 1. Architectural Strategy

- **Layer-0 Bitemporal Event Store (`src/core/eosBitemporalEventStore.ts`)**:
  - Implements an in-memory, append-only log partitioned by `streamId`.
  - Every event carries:
    - `streamId: string`
    - `sequenceNumber: number` (1, 2, 3...)
    - `eventType: string`
    - `payload: Record<string, unknown>`
    - `validTime: string` (caller supplied ISO timestamp)
    - `transactionTime: string` (system recorded monotonic ISO timestamp)
    - `idempotencyKey?: string`
    - `previousEventHash: string`
    - `eventHash: string` (SHA-256 of `{ streamId, sequenceNumber, eventType, payload, validTime, transactionTime, previousEventHash }`)
- **Exactly-Once Deduplication**:
  - Global lookup map `idempotencyIndex: Map<string, BitemporalEvent>` guaranteeing $O(1)$ duplicate resolution.
- **Bitemporal Projection / Time Travel**:
  - `replayEvents(streamId, options?: { asOfValidTime?: string; asOfTransactionTime?: string; reducer?: (state, event) => state; initialState?: any })`:
    - Filters events where `event.validTime <= asOfValidTime` and `event.transactionTime <= asOfTransactionTime`.
    - Reduces filtered events into final reconstructed state snapshot.
- **Change Data Capture (CDC) Engine**:
  - `getChangeStream(streamId)`:
    - Iterates over events and derives `CdcEnvelope`:
      - `operation: "CREATE" | "UPDATE" | "DELETE"`
      - `sequenceNumber: number`
      - `timestamp: string`
      - `before: Record<string, unknown> | null`
      - `after: Record<string, unknown> | null`
      - `diff: Record<string, { before: unknown; after: unknown }>`
- **CLI Subcommand Delegation**:
  - Dedicated CLI module in `bin/commands/cliEventStore.mjs` ($\le 140$ lines).
  - Subcommands `toolchain:events:append`, `toolchain:events:replay`, `toolchain:events:cdc` wired into `bin/commands/cliDevOps.mjs`.

### 2. File Invariants

- `src/core/eosBitemporalEventStore.ts` ($\le 380$ lines).
- `bin/commands/cliEventStore.mjs` ($\le 140$ lines).
- `test/eosBitemporalEventStore.test.mjs` ($\le 250$ lines).
- Event stream template in `templates/events/sample-bitemporal-event-stream.json`.
