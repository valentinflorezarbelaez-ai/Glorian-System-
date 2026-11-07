# INTAKE & CONTEXT RECORD: NUBANK INSTITUTIONAL ENGINEERING CODEX (INTAKE-016)

<!-- Standard: IEEE 830 / ISO 29148 — EOS 21-Step Master Pipeline -->

- **Project**: EOS System Control Plane (`eos-system-control-plane`)
- **Date**: 2026-10-25
- **Author**: Valentín Flórez Arbeláez (Principal Architect) & Antigravity (Pair Programmer)
- **Institutional Benchmark**: Nu (Nubank) Engineering Standards — `https://building.nu.com/` (Building Nu)
- **Goal**: Institutionalize within EOS System the exact, end-to-end engineering practices, architectural paradigms, operational culture, and design tenets of Nubank, creating an autonomous codex that enables EOS to operate with perfection under Nu's standards.

---

## 1. Architectural Drivers & Context (building.nu.com)

Nubank serves over 140 million customers across Latin America (Brazil, Mexico, Colombia) with a platform built to fight complexity through functional programming, immutability, and pragmatic simplicity.

### 1.1 The Six Pillars of Nu Engineering Excellence

1. **Fighting Complexity as a Discipline (Rich Hickey & Out of the Tar Pit)**:
   - Complexity is the primary impediment to scaling and maintainability.
   - Separation of "Simple" (unbraided, decoupled, single-responsibility) from "Easy" (familiar, convenient in the short term, disastrous at scale).
   - State and control flow are treated with extreme caution: state is modeled as immutable values changing over time rather than mutable place-oriented entities (CRUD).
2. **Functional Core & Hexagonal Isolation**:
   - Microservices written in functional languages (primarily Clojure) using Hexagonal Architecture (Ports & Adapters).
   - Core domain logic consists of 100% pure, side-effect-free functions operating on immutable data structures (maps, vectors, sets).
   - Infrastructure, databases, Kafka brokers, and HTTP gateways (Finagle/Pedestal) are isolated behind explicit ports.
3. **Datomic as the Immutable, Bitemporal Source of Truth**:
   - The database is treated as a value: data is an append-only collection of immutable facts (Datoms: `[entity, attribute, value, tx, added?]`).
   - Separation of reads and writes: writes are sequentially coordinated by the Transactor, while queries and indexing are distributed across application peers using in-memory caches and Datalog.
   - Bitemporal auditing out-of-the-box: ability to query state `as-of` any historic transaction time (`txTime`) without destructive mutations.
4. **Asynchronous Event-Driven Messaging & Kafka Idempotency**:
   - Microservices interact asynchronously via Apache Kafka.
   - Mandatory idempotency: every event and API mutation requires an idempotent deduplication token to prevent duplicate financial allocations.
   - Partitioning by entity ID (e.g. `account_id`, `customer_id`) guarantees strictly ordered delivery per entity.
5. **Consumer-Driven Contract Testing (The Sachem Pattern)**:
   - Replacement of brittle, expensive staging End-to-End (E2E) testing with automated contract testing based on Clojure Schemas (or Malli).
   - Schemas for Kafka topics and REST endpoints are verified for backward and forward compatibility, preventing breaking changes between independent squads.
6. **Decentralized Autonomous Squads & Operational Rigor**:
   - "You Build It, You Run It": Autonomous cross-functional squads operate as internal startups with full ownership of development, testing, deployment, and on-call rotations.
   - Blameless Postmortems: Incidents (SEV1/SEV2) are investigated focusing on cognitive ergonomics, systemic safeguards, and blast-radius containment—never on human culpability.
   - Continuous Delivery: Multiple daily production deployments via Kubernetes on AWS with canary verification and Prometheus telemetry (RED method).

---

## 2. Inviolable Invariants

1. **Layer-0 Purity**: Zero external runtime dependencies (`dependencies: {}`).
2. **Zero Plaintext Secrets**: No hardcoded API keys, tokens, or credentials.
3. **Deterministic Verification**: Exit code 0 across all unit, lint, and CI/CD stages.
4. **Standard Professional English**: Code, documentation, schemas, and ADRs must be authored in English.
