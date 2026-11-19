# PLAN-210: Distributed Bitemporal CRDT Memory Synchronizer (`SPEC-348`)

- **Change ID**: `CHANGE-210`
- **Spec ID**: `SPEC-348`
- **Status**: `PLAN_APPROVED`
- **Architect**: Valentín Flórez Arbeláez (Principal Architect & System Owner)

---

## 1. Architectural Strategy & ADRs

### ADR-210-001: Pure Layer-0 Delta-State CRDTs vs External Distributed Storage

- **Context**: Autonomous agents in a swarm or edge cluster need low-latency memory synchronization without depending on centralized Redis, DynamoDB, or external distributed database drivers.
- **Decision**: Implement pure TypeScript state-based and delta-state CRDTs (ORSet, LWW-Map, PN-Counter) with bitemporal transaction logs. Delta merges form a mathematical join-semilattice ($\sqcup$) ensuring Strong Eventual Consistency (SEC) across any network topology.
- **Alternatives Rejected**:
  - `automerge` / `yjs` npm packages: Rejected to preserve strict Layer-0 zero-dependency constitutional purity (`dependencies: {}`).
  - Centralized Redis / Postgres locking: Rejected due to single-point-of-failure vulnerabilities, edge network partitions, and network latency.
- **Consequences**: Zero dependencies, sub-millisecond local reads/writes, guaranteed convergence under arbitrary message delays or reorderings.

### ADR-210-002: Bitemporal Vector Clocks & Deterministic Tie-Breaking

- **Context**: Physical clock drift across agent nodes can lead to non-deterministic conflict resolution if naive wall-clock timestamps are used.
- **Decision**: Pair Lamport logical clock sequence numbers with physical UTC timestamps (Hybrid Logical Clock) and use lexicographical node ID comparison as a deterministic tie-breaker for simultaneous writes.
- **Consequences**: Mathematically proven total ordering for all concurrent memory updates.

---

## 2. Component Design & Interfaces

- `src/core/eosDistributedCrdtMemory.types.ts`:
  - `HlcTimestamp`: `millis: number`, `counter: number`, `nodeId: string`
  - `LwwRegister<T>`: `value: T`, `hlc: HlcTimestamp`, `validTime: string`
  - `OrSetElement`: `value: string`, `tag: string`, `hlc: HlcTimestamp`
  - `OrSetState`: `adds: Map<string, OrSetElement>`, `removes: Map<string, OrSetElement>`
  - `PnCounterState`: `positives: Map<string, number>`, `negatives: Map<string, number>`
  - `BitemporalTxRecord`: `txId: string`, `nodeId: string`, `validTime: string`, `txTime: string`, `opType: string`, `key: string`, `payload: unknown`
  - `CrdtMemoryState`: `nodeId: string`, `lwwMap: Map<string, LwwRegister<unknown>>`, `orSets: Map<string, OrSetState>`, `pnCounters: Map<string, PnCounterState>`, `txLog: BitemporalTxRecord[]`
  - `CrdtAuditReceipt`: `spec: string`, `timestamp: string`, `commutativityPassed: boolean`, `idempotencyPassed: boolean`, `orSetAddWinsPassed: boolean`, `bitemporalHistoryPassed: boolean`, `allPassed: boolean`, `sha256: string`

- `src/core/eosDistributedCrdtMemory.ts`:
  - `createCrdtMemoryNode(nodeId: string): EosDistributedCrdtMemoryCore`
  - `putLww(key: string, value: unknown, validTime?: string): void`
  - `getLww(key: string): unknown`
  - `addOrSet(setName: string, element: string): void`
  - `removeOrSet(setName: string, element: string): void`
  - `getOrSet(setName: string): string[]`
  - `incrementCounter(name: string, delta?: number): void`
  - `getCounter(name: string): number`
  - `mergeDelta(remoteState: CrdtMemoryState): void`
  - `queryAsOf(key: string, validTime: string, txTime: string): unknown`
  - `auditDistributedCrdtMemory(root?: string): CrdtAuditReceipt`
