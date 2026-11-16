# SPEC-297: Cloudflare Durable Objects Persistent State & Actor Mesh

- **Specification ID**: `SPEC-297`
- **Change ID**: `CHANGE-159`
- **Status**: `APPROVED`
- **Module**: `src/core/eosCloudflareDurableBridge.ts`
- **Tier**: Planetary Edge Coordination, Stateful Actors & Semantic Caching
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-297-01 (Event-Driven Stateful Actor Lifecycle & Hibernation)**: WHEN an actor receives an activation or sleep trigger, THE SYSTEM SHALL execute deterministic state transitions (`INITIALIZED`, `ACTIVE`, `HIBERNATED`, `TERMINATED`) and preserve in-memory WebSocket connections with zero idle compute cost.
- **FR-297-02 (State-Driven Embedded Edge Storage Transactions)**: MIENTRAS actor storage operations execute, THE SYSTEM SHALL provide atomic transactions supporting key-value updates and SQL execution with complete isolation and rollback upon failure.
- **FR-297-03 (State-Driven Semantic Vector Cache Matching)**: MIENTRAS incoming prompt queries are evaluated against cached vectors, THE SYSTEM SHALL return cached responses in $< 5$ ms whenever cosine similarity exceeds the $0.96$ threshold.
- **FR-297-04 (Error / Unwanted Condition: Stale State & Cache Invalidation)**: SI a prompt entry exceeds its configured TTL or undergoes manual purge, ENTONCES EL SISTEMA SHALL evict the vector and record a cache miss.
- **FR-297-05 (Ubiquitous HMAC-SHA256 Edge Security Binding)**: EL SISTEMA SHALL sign and verify every cross-tier payload exchanged between Vercel serverless endpoints and edge actors using HMAC-SHA256 message authentication codes.
- **FR-297-06 (Cryptographic Proof Receipt)**: WHEN a Durable Objects edge pipeline audit completes, THE SYSTEM SHALL emit a verification receipt at `docs/evidence/DURABLE_OBJECTS_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1557 Stateful Actor Lifecycle Transitions and WebSocket Hibernation
  GIVEN an agent actor instance with a unique actor ID
  WHEN messages are dispatched to the actor and dormancy timers trigger
  THEN the actor transitions from INITIALIZED -> ACTIVE -> HIBERNATED
  AND restores state immediately upon receiving subsequent mailbox messages without loss.

SCENARIO: BDD-1558 Transactional Embedded Edge Storage with Rollback
  GIVEN an active actor storage context
  WHEN a multi-key mutation transaction is executed and encounters an intentional error
  THEN the entire transaction rolls back to the pre-transaction state
  AND successful transactions persist state atomically with deterministic versioning.

SCENARIO: BDD-1559 Semantic Vector Prompt Cache Matching with Cosine Similarity
  GIVEN a semantic cache populated with prompt embeddings and completion outputs
  WHEN a new query with cosine similarity >= 0.96 is queried
  THEN SemanticPromptVectorCache returns a cache HIT with latency < 5ms
  AND queries with similarity < 0.96 trigger a cache MISS.

SCENARIO: BDD-1560 Cache Eviction, TTL Expiration, and Invalidation
  GIVEN cached prompt entries with an explicit time-to-live (TTL)
  WHEN TTL expires or explicit purge is triggered
  THEN expired items are automatically evicted and subsequent queries report cache misses.

SCENARIO: BDD-1561 HMAC-SHA256 Authenticated Edge Bridge Dispatch
  GIVEN a control plane request payload and shared secret key
  WHEN EdgeControlPlaneBridge transmits an authenticated request
  THEN it attaches a valid HMAC-SHA256 signature and timestamp header
  AND rejects payloads with forged, tampered, or expired signatures fail-closed.

SCENARIO: BDD-1562 Cryptographic Durable Objects Audit Receipt Generation
  GIVEN an audit executed via toolchain:edge:audit or auditDurableObjectsPipeline
  WHEN the audit completes
  THEN docs/evidence/DURABLE_OBJECTS_RECEIPT.json is written
  AND contains actorsSpawned, transactionsAudited, cacheHitRate, edgeBridgeVerified, and a valid sha256Signature.
```
