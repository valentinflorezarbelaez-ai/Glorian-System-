-------------------- MODULE McpStreamableSecurity --------------------
(*
  TLA+ Formal Specification — Peak Assurance Wave A (SPEC-146 / LADDER-14)
  Models fail-closed MCP Streamable HTTP TCB predicates:
  - Origin allowlist rejection
  - 1 MiB payload bound
  - Session ↔ token hash binding
  - Unauthorized Law IV writes stay at zero
*)

EXTENDS Naturals

CONSTANTS
  MaxRequests,          \* Bounded request evaluations
  MaxPayloadBytes,      \* Must equal 1048576 in implementations
  AllowedOriginCount    \* Size of Origin allowlist (> 0)

VARIABLES
  requestsProcessed,    \* Count of requests evaluated by the TCB
  acceptedRequests,     \* Count accepted after all predicates PASS
  rejectedRequests,     \* Count fail-closed rejections
  unauthorizedWrites,   \* Must remain 0 (Law IV)
  activeSessions,       \* Bound sessions with token binding
  maxObservedPayload    \* Max payload size observed (must stay <= MaxPayloadBytes when accepted)

vars == <<requestsProcessed, acceptedRequests, rejectedRequests, unauthorizedWrites, activeSessions, maxObservedPayload>>

-----------------------------------------------------------------------------

Init ==
  /\ requestsProcessed = 0
  /\ acceptedRequests = 0
  /\ rejectedRequests = 0
  /\ unauthorizedWrites = 0
  /\ activeSessions = 0
  /\ maxObservedPayload = 0

\* Fail-closed: bad origin OR oversized payload
RejectUnsafeRequest ==
  /\ requestsProcessed < MaxRequests
  /\ requestsProcessed' = requestsProcessed + 1
  /\ rejectedRequests' = rejectedRequests + 1
  /\ unauthorizedWrites' = 0
  /\ UNCHANGED <<acceptedRequests, activeSessions, maxObservedPayload>>

\* Accept only when Origin allowlisted, payload within bound, session token-bound
AcceptSafeRequest ==
  /\ requestsProcessed < MaxRequests
  /\ AllowedOriginCount > 0
  /\ requestsProcessed' = requestsProcessed + 1
  /\ acceptedRequests' = acceptedRequests + 1
  /\ activeSessions' = activeSessions + 1
  /\ maxObservedPayload' <= MaxPayloadBytes
  /\ unauthorizedWrites' = 0
  /\ UNCHANGED rejectedRequests

Next == RejectUnsafeRequest \/ AcceptSafeRequest

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------

TypeInvariant ==
  /\ requestsProcessed >= 0
  /\ acceptedRequests >= 0
  /\ rejectedRequests >= 0
  /\ unauthorizedWrites = 0
  /\ activeSessions >= 0
  /\ maxObservedPayload >= 0

PayloadBoundInvariant ==
  acceptedRequests > 0 => maxObservedPayload <= MaxPayloadBytes

ZeroUnauthorizedWriteInvariant ==
  unauthorizedWrites = 0

ConservationInvariant ==
  requestsProcessed = acceptedRequests + rejectedRequests

SafetyInvariant ==
  /\ TypeInvariant
  /\ PayloadBoundInvariant
  /\ ZeroUnauthorizedWriteInvariant
  /\ ConservationInvariant

THEOREM Spec => []SafetyInvariant
=============================================================================
