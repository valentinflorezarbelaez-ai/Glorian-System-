# PLAN-159: Cloudflare Durable Objects Persistent State & Actor Mesh

- **Plan ID**: `PLAN-159`
- **Change ID**: `CHANGE-159`
- **Spec Reference**: `SPEC-297`
- **Status**: `APPROVED`
- **Target Module**: `src/core/eosCloudflareDurableBridge.ts`
- **Tier**: Planetary Edge Coordination, Stateful Actors & Semantic Caching
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Architectural Strategy

The Cloudflare Durable Objects Persistent State & Actor Mesh provides planetary low-latency state coordination, stateful agent actor lifecycle management, and semantic vector caching for Glorian System without breaking **Law V** (Zero Runtime Dependencies).

### Pure Layer-0 Architecture (Law V)

1. **Stateful Actor Lifecycle & WebSocket Hibernation (`DurableActorLifecycleManager`)**:
   - Manages single-threaded actor instances addressed by unique 64-bit/UUID identifiers.
   - States: `INITIALIZED`, `ACTIVE`, `HIBERNATED`, `TERMINATED`.
   - Mailbox message queuing with FIFO processing guarantees.
   - WebSocket session tracking with dormancy timeouts; actors enter `HIBERNATED` when idle and wake instantly upon incoming messages with zero lost state.

2. **Embedded Edge Transactional Storage (`EdgeSqliteStorageEngine`)**:
   - In-memory key-value and SQLite-compatible storage implementing the Cloudflare Durable Objects Storage interface (`get`, `put`, `delete`, `transaction`).
   - ACID transaction support with pre-commit snapshots and automatic rollback upon exceptions.
   - Deterministic revision versioning (`version: number`).

3. **Semantic Prompt Vector Cache (`SemanticPromptVectorCache`)**:
   - Embeds prompt text into normalized float vectors using scalar projection or n-gram embedding.
   - Computes cosine similarity between incoming queries and cached vectors:
     $$\text{sim}(u, v) = \frac{u \cdot v}{\|u\| \|v\|}$$
   - Returns cached outputs when $\text{sim}(u, v) \ge 0.96$ in $< 5\text{ms}$.
   - Time-to-Live (TTL) expiration and LRU capacity bounds.

4. **HMAC-SHA256 Authenticated Edge Bridge (`EdgeControlPlaneBridge`)**:
   - Generates and verifies HMAC-SHA256 authorization signatures with timestamp anti-replay windows ($\le 60\text{s}$).
   - Dispatches authenticated requests across Vercel and Cloudflare edges using native `node:crypto` and `node:https`.

5. **Cryptographic Proof Receipt**:
   - Emits verification metadata at `docs/evidence/DURABLE_OBJECTS_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Component Design & Interfaces

```typescript
export type ActorState = "INITIALIZED" | "ACTIVE" | "HIBERNATED" | "TERMINATED";

export interface ActorMessage {
  readonly id: string;
  readonly sender: string;
  readonly payload: unknown;
  readonly timestamp: number;
}

export interface ActorSnapshot {
  readonly actorId: string;
  readonly state: ActorState;
  readonly storageKeys: readonly string[];
  readonly activeWebSockets: number;
  readonly messageCount: number;
}

export interface SemanticCacheEntry {
  readonly prompt: string;
  readonly vector: readonly number[];
  readonly response: unknown;
  readonly createdAt: number;
  readonly ttlMs: number;
}

export interface SemanticMatchResult {
  readonly hit: boolean;
  readonly similarity: number;
  readonly response?: unknown;
  readonly cachedPrompt?: string;
  readonly latencyMs: number;
}
```

---

## 3. Execution Plan

1. Define contracts in `src/core/eosCloudflareDurableBridge.types.ts`.
2. Implement core engine in `src/core/eosCloudflareDurableBridge.ts` ($\le 450$ lines).
3. Export from `src/core/index.ts` and verify with `npm run typecheck`.
4. Create CLI commands in `bin/commands/cliDurableBridge.mjs` and wire delegation into `bin/commands/cliToolchainRouter.mjs`.
5. Register in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` (total 427 commands).
6. Write test suite in `test/eosCloudflareDurableBridge.test.mjs` validating BDD-1557..1562.
7. Run `node scripts/tip-refresh.mjs` and seal the freeze pin.
