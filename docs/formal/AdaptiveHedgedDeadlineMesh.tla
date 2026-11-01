------------------- MODULE AdaptiveHedgedDeadlineMesh -------------------
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS MaxRequests, MaxHedgeCapPercent

VARIABLES 
  requestsDispatched,
  hedgesDispatched,
  shedRequests,
  completedRequests,
  runningP95Ms

vars == <<requestsDispatched, hedgesDispatched, shedRequests, completedRequests, runningP95Ms>>

TypeOK ==
  /\ requestsDispatched \in 0..MaxRequests
  /\ hedgesDispatched \in 0..MaxRequests
  /\ shedRequests \in 0..MaxRequests
  /\ completedRequests \in 0..MaxRequests
  /\ runningP95Ms \in 10..500

Init ==
  /\ requestsDispatched = 0
  /\ hedgesDispatched = 0
  /\ shedRequests = 0
  /\ completedRequests = 0
  /\ runningP95Ms = 40

DispatchFastPrimary ==
  /\ requestsDispatched < MaxRequests
  /\ requestsDispatched' = requestsDispatched + 1
  /\ completedRequests' = completedRequests + 1
  /\ UNCHANGED <<hedgesDispatched, shedRequests, runningP95Ms>>

DispatchLaggingPrimaryWithHedge ==
  /\ requestsDispatched < MaxRequests
  /\ ((hedgesDispatched + 1) * 100) <= ((requestsDispatched + 1) * MaxHedgeCapPercent)
  /\ requestsDispatched' = requestsDispatched + 1
  /\ hedgesDispatched' = hedgesDispatched + 1
  /\ completedRequests' = completedRequests + 1
  /\ UNCHANGED <<shedRequests, runningP95Ms>>

DispatchExpiredDeadlineShed ==
  /\ requestsDispatched < MaxRequests
  /\ requestsDispatched' = requestsDispatched + 1
  /\ shedRequests' = shedRequests + 1
  /\ UNCHANGED <<hedgesDispatched, completedRequests, runningP95Ms>>

HedgingStormSuppressed ==
  /\ requestsDispatched < MaxRequests
  /\ ((hedgesDispatched + 1) * 100) > ((requestsDispatched + 1) * MaxHedgeCapPercent)
  /\ requestsDispatched' = requestsDispatched + 1
  /\ completedRequests' = completedRequests + 1
  /\ UNCHANGED <<hedgesDispatched, shedRequests, runningP95Ms>>

Next ==
  \/ DispatchFastPrimary
  \/ DispatchLaggingPrimaryWithHedge
  \/ DispatchExpiredDeadlineShed
  \/ HedgingStormSuppressed

HedgingRateBoundedInvariant ==
  /\ (hedgesDispatched * 100) <= (requestsDispatched * MaxHedgeCapPercent)

DeadlineMonotonicInvariant ==
  /\ shedRequests <= requestsDispatched

CompletionConservationInvariant ==
  /\ completedRequests + shedRequests = requestsDispatched

SafetyInvariant ==
  /\ TypeOK
  /\ HedgingRateBoundedInvariant
  /\ DeadlineMonotonicInvariant
  /\ CompletionConservationInvariant

=============================================================================
