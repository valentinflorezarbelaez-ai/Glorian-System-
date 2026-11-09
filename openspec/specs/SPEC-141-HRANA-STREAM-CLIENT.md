# SPEC-141: HRANA Native Stream Client for Distributed libSQL/Turso Replicas

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

EOS agents need to synchronize with libSQL/Turso embedded replicas at the edge without pulling a client SDK into the runtime. `EosHranaStreamClient` (`src/core/eosHranaStreamClient.ts`) implements the Hrana v2 streaming protocol natively over `node:https`/`node:http`, providing zero-dependency synchronization as described in the module header's Horizon-2 Distributed Memory Engine scope.

The client speaks a JSON stream envelope (`type: "stream"`, monotonic `streamId`, per-request `requestId`) over a single POST endpoint, and it protects the pipeline with a three-state circuit breaker (CLOSED → OPEN → HALF_OPEN). Bearer-token authentication is validated end to end, and every request carries deterministic, bounded transport semantics: an explicit timeout, a bounded retry loop with exponential backoff, and fail-fast behavior once the circuit opens.

The design respects Law V (Hexagonal Layer-0 isolation): the engine imports only Node built-ins (`node:https`, `node:http`, `node:crypto`) plus the `eosKernelPrimitives.ts` contract helpers, and exposes a frozen, deterministic report receipt so client state can be attested downstream.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-511 (Ubiquitous - Zero-Dependency Transport)**: `The system shall transport Hrana v2 stream requests using only Node built-in HTTP/HTTPS and crypto modules, with no external runtime dependency.`
- **FR-512 (Event-Driven - Statement Execution)**: `When a non-empty SQL statement is executed, the system shall POST an execute stream request, increment the query counter, and return a frozen parsed result set.`
- **FR-513 (Event-Driven - Batch Execution)**: `When a batch of one or more statements is submitted, the system shall send it as a single atomic batch request and increment the query counter by the number of statements.`
- **FR-514 (State-Driven - Bearer Authentication)**: `While an authentication token is configured, the system shall attach an Authorization Bearer header carrying that token to every HTTP request.`
- **FR-515 (Unwanted Condition - Circuit Breaker Opening)**: `If consecutive transport failures reach the configured circuit-breaker threshold, then the system shall open the circuit and refuse further connection attempts until a cooldown period has elapsed.`
- **FR-516 (Ubiquitous - Deterministic Client Receipt)**: `The system shall expose a frozen client report containing a deterministic 64-character SHA-256 receipt over endpoint, protocol, circuit status, and query counters.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-511 Hello handshake and statement roundtrip
GIVEN a client pointed at a mock Hrana endpoint
WHEN the client pings the endpoint and then executes a SELECT statement
THEN the ping reports ok with the endpoint version
AND the execute result exposes the column names, the row count, and the decoded cell values
```

```gherkin
SCENARIO: BDD-512 Typed argument encoding and bearer authentication
GIVEN a client configured with an authentication token
WHEN it executes a parameterized statement with a numeric argument
THEN the argument is encoded as a typed value in the streamed request body
AND the outgoing request carries the authorization bearer header
```

```gherkin
SCENARIO: BDD-513 Atomic batch execution
GIVEN a client pointed at a mock Hrana endpoint
WHEN it submits a batch of two statements
THEN the batch is sent as a single request
AND the client returns one parsed result per statement
```

```gherkin
SCENARIO: BDD-514 Circuit breaker opens and fails fast
GIVEN a client whose endpoint is unreachable and whose breaker threshold is three
WHEN three statements fail consecutively
THEN the client report shows an OPEN circuit
AND the next execution is rejected without a network attempt
AND an invalid (non-http) endpoint or an empty statement is rejected up front
```

---

## 4. Architecture Decision Records (ADRs)

- **ADR-141-1: Native `node:https` transport for the Hrana v2 protocol**

  - _Context_: A vendored libSQL/Turso SDK would violate Law V and enlarge the trusted runtime surface.
  - _Decision_: Implement the Hrana v2 stream envelope directly over the built-in HTTP/HTTPS modules, encoding typed arguments and decoding typed result cells in-house.
  - _Consequence_: Zero runtime dependencies and full control over retry/timeout semantics; the trade-off is that the wire encoding must track the upstream protocol specification.

- **ADR-141-2: Three-state circuit breaker with fail-fast semantics**
  - _Context_: An unreachable replica must not stall every caller while the transport times out repeatedly.
  - _Decision_: Track consecutive failures and open the circuit at the configured threshold, allowing a half-open probe only after a 30-second cooldown that a successful call closes.
  - _Consequence_: Failures become fast and bounded, protecting the caller; the trade-off is that a caller must tolerate transient rejections while the circuit is open.

---

## 5. Atomic Task DAG

1. [x] **TASK-141-1**: Author this specification (EARS requirements, BDD scenarios, ADR) and link it to the module header.
2. [x] **TASK-141-2**: Implement `EosHranaStreamClient` (`src/core/eosHranaStreamClient.ts`) with the native stream transport and typed codec.
3. [x] **TASK-141-3**: Implement the circuit breaker, retry/backoff loop, and deterministic report receipt.
4. [x] **TASK-141-4**: Add `test/eosHranaStreamClient.test.mjs` covering every BDD scenario against an in-process mock server.
