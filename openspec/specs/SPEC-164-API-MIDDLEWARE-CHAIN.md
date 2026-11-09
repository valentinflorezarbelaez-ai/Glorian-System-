# SPEC-164: API Middleware Chain with Ordered Composition, Short-Circuiting and Error Handling

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Cross-cutting API concerns such as authentication, request correlation, timing and structured error reporting should be expressed as small, composable units rather than interleaved into every handler. The middleware pipeline pattern used by Kong, Express and Fastify achieves this by executing an ordered chain in which each unit receives the request context and a `next` continuation; calling `next` advances to the following unit, while declining to call it short-circuits the remainder of the chain. This makes concerns like a 401 authorization gate a natural early exit.

Order is semantically significant, so the pipeline must preserve it exactly and expose a stable identity for regression detection. `EosApiMiddlewareChain` composes middlewares in registration order, propagates a single mutable `RequestContext` through the chain, supports short-circuiting, and routes thrown errors to registered handlers before re-throwing so failures remain observable.

The module also ships three ready-made middlewares used across the fleet: request-id correlation, request timing and bearer-token authentication. It lives in Layer 0 with zero external dependencies.

## 2. Functional Requirements (EARS Syntax)

- **FR-731 (Ubiquitous - Ordered Middleware Composition)**: `The EOS System shall allow middleware to be appended with use and inserted at a position with insert, and shall execute middlewares during handle strictly in their composed order from the first registered to the last.`
- **FR-732 (Event-Driven - Async Context Propagation)**: `When a middleware invokes next, the EOS System shall execute the following middleware with the same RequestContext object, so that mutations made by each middleware accumulate across the chain, and handle shall resolve with that context.`
- **FR-733 (Event-Driven - Short-Circuit Semantics)**: `When a middleware completes its work without invoking next, the EOS System shall skip all downstream middlewares and resolve handle with the current context, such that a middleware setting statusCode 403 prevents any downstream middleware from running.`
- **FR-734 (Unwanted Condition - Structured Error Handling)**: `If a middleware throws, then the EOS System shall invoke each registered error handler with the error and the context, swallowing any fault raised by a handler, and shall re-throw the original error to the handle caller.`
- **FR-735 (Ubiquitous - Deterministic Chain Fingerprint)**: `The EOS System shall expose chainFingerprint as the SHA-256 digest over the ordered middleware names joined by ">", such that two chains containing the same names in a different order produce different fingerprints.`
- **FR-736 (Ubiquitous - Built-in Middleware Semantics)**: `The EOS System shall provide requestIdMiddleware that sets metadata.requestId from the configured header name and falls back to the context requestId, timingMiddleware that sets metadata.durationMs to the elapsed integer milliseconds, and authMiddleware that, on a missing or invalid bearer token, sets statusCode 401 with a deep-frozen unauthorized response and short-circuits without calling next.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-731 Middlewares Execute In Registration Order
  GIVEN an EosApiMiddlewareChain with middlewares "A", "B" and "C" registered in that order, each appending its name and calling next
  WHEN handle is invoked with a fresh context
  THEN the recorded execution order is exactly ["A", "B", "C"]
```

```gherkin
SCENARIO: BDD-732 Short-Circuit Skips Downstream Middlewares
  GIVEN a chain whose first middleware sets statusCode 403 and does not call next
  AND a downstream middleware that would set a reached flag
  WHEN handle is invoked
  THEN the resolved context has statusCode 403
  AND the downstream middleware never runs
```

```gherkin
SCENARIO: BDD-733 Error Handler Runs On Throw
  GIVEN a chain whose middleware throws an error containing "kaboom"
  AND a registered error handler that captures the error
  WHEN handle is invoked
  THEN handle rejects with the thrown error
  AND the captured error text contains "kaboom"
```

```gherkin
SCENARIO: BDD-734 Auth Middleware Rejects Missing Token
  GIVEN a chain using authMiddleware that only accepts the token "secret-token"
  AND a context whose headers contain no authorization token
  WHEN handle is invoked
  THEN the resolved context has statusCode 401
  AND the downstream handler middleware does not execute
```

## 4. Architecture Decision Records (ADRs)

- **ADR-164-1: next()-Driven Composition over Explicit Index Cursors**
  - _Context_: Middleware must be composable, reorderable and capable of short-circuiting without handler-specific code.
  - _Decision_: Expose a `next` continuation to each middleware; absence of a `next` call marks the chain as short-circuited and halts execution, mirroring the Kong / Express / Fastify pipeline model.
  - _Consequence_: Middleware authors control flow explicitly, but a forgotten `next` silently terminates the chain, which is the intended short-circuit semantics.
- **ADR-164-2: Ordered-Name Fingerprint for CI Regression Detection**
  - _Context_: The meaning of the pipeline depends on execution order, so a reordered chain is a behavioral change that must be detectable.
  - _Decision_: Compute chainFingerprint as a SHA-256 digest over the ordered middleware names joined by ">".
  - _Consequence_: Reordering or renaming middlewares changes the fingerprint, enabling CI to flag unintended pipeline mutation.

## 5. Atomic Task DAG

1. [x] **TASK-164-1**: Author SPEC-164 (this document) defining composition, propagation, short-circuit and error-handling contracts.
2. [x] **TASK-164-2**: Implement `EosApiMiddlewareChain` in `src/core/eosApiMiddlewareChain.ts` with use, insert, onError, handle, listNames and chainFingerprint.
3. [x] **TASK-164-3**: Implement the built-in requestId, timing and auth middlewares and the `createContext` factory.
4. [x] **TASK-164-4**: Verify the behavior with the SPEC-164 scenarios in `test/eosBigTechDistributed.test.mjs`.
