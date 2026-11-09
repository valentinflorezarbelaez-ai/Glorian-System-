# SPEC-161: Webhook Fan-Out Dispatcher with HMAC Signing, Bounded Retries and Dead-Letter Queue

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

External integrations rely on webhooks to receive events, but HTTP delivery is inherently unreliable: networks drop requests, endpoints return transient errors, and consumers process duplicates. This module adopts the delivery discipline used by Stripe and GitHub: an event is fanned out to every registered subscriber, each delivery is authenticated with an HMAC-SHA256 signature, failed attempts are retried with bounded exponential backoff, and deliveries that never succeed are quarantined in a dead-letter queue for later inspection.

Because at-least-once delivery permits duplicates, each delivery is keyed by a deterministic delivery id of the form `subscriberId:event`. Once a subscriber has accepted an event, subsequent dispatches short-circuit and report a synthetic success, enabling idempotent consumers without re-transmitting the payload.

`EosWebhookFanoutDispatcher` is transport-agnostic: the caller injects a `TransportFn` returning a status code, which makes the retry, backoff and dead-letter behavior fully deterministic and testable. It lives in Layer 0 with zero runtime dependencies beyond the Node.js `crypto` primitive used for signing.

## 2. Functional Requirements (EARS Syntax)

- **FR-701 (Ubiquitous - Subscriber Registration and Fan-Out)**: `The EOS System shall register a subscriber only when its secret is at least 8 characters long, rejecting shorter secrets, and shall deliver each dispatched event to every registered subscriber, returning one DeliveryResult carrying deliveryId, subscriberId, attempt, success, statusCode and signature per subscriber.`
- **FR-702 (Event-Driven - HMAC Payload Signing)**: `When a delivery attempt is made, the EOS System shall compute an HMAC-SHA256 signature over the string "<timestamp>.<body>" using the subscriber secret, and the static sign function shall be deterministic, returning the same 64-character lowercase hexadecimal digest for identical inputs.`
- **FR-703 (State-Driven - Bounded Retry with Exponential Backoff)**: `While the attempt count remains below the subscriber's maxAttempts and no 2xx status has been returned, the EOS System shall retry the delivery, waiting a backoff of min(2^attempt, 4) milliseconds between attempts.`
- **FR-704 (Unwanted Condition - Dead-Letter Routing)**: `If all attempts are exhausted without a 2xx response, then the EOS System shall mark the delivery as failed and enqueue a DeadLetter record containing the deliveryId, subscriberId, event, payload, lastError and failedAtMs into the dead-letter queue.`
- **FR-705 (Event-Driven - Idempotent De-duplication)**: `When an event has already been successfully delivered to a subscriber under its deliveryId, the EOS System shall short-circuit the transport and return a synthetic success result with attempt 0, success true and statusCode 200.`
- **FR-706 (Event-Driven - Dead-Letter Drain)**: `When drainDeadLetters is invoked, the EOS System shall return all queued dead letters and clear the queue, so that a subsequent deadLetterCount returns 0.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-701 HMAC Signature Is Deterministic
  GIVEN the static signer of EosWebhookFanoutDispatcher with secret "secret123"
  WHEN sign is called twice with the same timestamp 1700000000 and the same body
  THEN both calls return an identical signature
  AND the signature is exactly 64 hexadecimal characters long
```

```gherkin
SCENARIO: BDD-702 Successful Delivery to All Subscribers
  GIVEN a dispatcher whose transport always returns 200
  AND two registered subscribers each with maxAttempts 3
  WHEN a "user.created" event is dispatched
  THEN the result list contains two delivery results
  AND every result reports success = true
```

```gherkin
SCENARIO: BDD-703 Dead-Letter After Max Attempts Exhausted
  GIVEN a dispatcher whose transport always returns 500
  AND a registered subscriber with maxAttempts 2
  WHEN a "test" event is dispatched
  THEN the subscriber's delivery result reports success = false
  AND the dead-letter queue contains exactly one entry
```

```gherkin
SCENARIO: BDD-704 Retry Succeeds On Second Attempt
  GIVEN a transport that returns 503 on the first call and 200 on the second
  AND a registered subscriber with maxAttempts 3
  WHEN a "retry" event is dispatched
  THEN the delivery result reports success = true
  AND the reported attempt number is 2
```

## 4. Architecture Decision Records (ADRs)

- **ADR-161-1: At-Least-Once Delivery with HMAC Signing and Idempotent Delivery IDs**
  - _Context_: Webhook delivery over HTTP cannot guarantee exactly-once processing, and subscribers must trust payload authenticity.
  - _Decision_: Sign each attempt with HMAC-SHA256 over `<timestamp>.<body>`, and key deliveries by `subscriberId:event` so accepted events are de-duplicated and reported as synthetic successes.
  - _Consequence_: Consumers must verify signatures and tolerate the documented idempotency semantics; re-delivery of the same event to the same subscriber is suppressed.
- **ADR-161-2: Dead-Letter Queue as a Bounded Quarantine**
  - _Context_: Permanently failing deliveries must not stall the fan-out loop, yet must be recoverable for inspection.
  - _Decision_: Route exhausted deliveries to an in-memory dead-letter queue exposed via drainDeadLetters and deadLetterCount.
  - _Consequence_: Failed deliveries are preserved for reprocessing but are not durable across process restarts, which is acceptable for a Layer 0 simulator.

## 5. Atomic Task DAG

1. [x] **TASK-161-1**: Author SPEC-161 (this document) defining the fan-out, signing, retry and dead-letter contracts.
2. [x] **TASK-161-2**: Implement `EosWebhookFanoutDispatcher` in `src/core/eosWebhookFanoutDispatcher.ts` with register, sign, dispatch and drainDeadLetters.
3. [x] **TASK-161-3**: Implement deterministic delivery ids and `min(2^attempt, 4)` backoff.
4. [x] **TASK-161-4**: Verify the behavior with the SPEC-161 scenarios in `test/eosBigTechDistributed.test.mjs`.
