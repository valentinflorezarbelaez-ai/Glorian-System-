------------------- MODULE TailBasedTraceSampler -------------------
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS MaxActiveTraces, LatencyThresholdMs

VARIABLES 
  activeTraces,
  totalSpansReceived,
  tracesCompleted,
  tracesSampledErrors,
  tracesSampledLatency,
  tracesSampledResilience,
  tracesSampledNominal,
  tracesDroppedNominal,
  tracesEvicted

vars == <<activeTraces, totalSpansReceived, tracesCompleted, tracesSampledErrors, tracesSampledLatency, tracesSampledResilience, tracesSampledNominal, tracesDroppedNominal, tracesEvicted>>

TypeOK ==
  /\ activeTraces \in 0..MaxActiveTraces
  /\ totalSpansReceived \in Nat
  /\ tracesCompleted \in Nat
  /\ tracesSampledErrors \in Nat
  /\ tracesSampledLatency \in Nat
  /\ tracesSampledResilience \in Nat
  /\ tracesSampledNominal \in Nat
  /\ tracesDroppedNominal \in Nat
  /\ tracesEvicted \in Nat

Init ==
  /\ activeTraces = 0
  /\ totalSpansReceived = 0
  /\ tracesCompleted = 0
  /\ tracesSampledErrors = 0
  /\ tracesSampledLatency = 0
  /\ tracesSampledResilience = 0
  /\ tracesSampledNominal = 0
  /\ tracesDroppedNominal = 0
  /\ tracesEvicted = 0

IngestSpanNewTrace ==
  /\ activeTraces < MaxActiveTraces
  /\ activeTraces' = activeTraces + 1
  /\ totalSpansReceived' = totalSpansReceived + 1
  /\ UNCHANGED <<tracesCompleted, tracesSampledErrors, tracesSampledLatency, tracesSampledResilience, tracesSampledNominal, tracesDroppedNominal, tracesEvicted>>

IngestSpanExistingTrace ==
  /\ activeTraces > 0
  /\ totalSpansReceived' = totalSpansReceived + 1
  /\ UNCHANGED <<activeTraces, tracesCompleted, tracesSampledErrors, tracesSampledLatency, tracesSampledResilience, tracesSampledNominal, tracesDroppedNominal, tracesEvicted>>

CompleteTraceWithError ==
  /\ activeTraces > 0
  /\ activeTraces' = activeTraces - 1
  /\ tracesCompleted' = tracesCompleted + 1
  /\ tracesSampledErrors' = tracesSampledErrors + 1
  /\ UNCHANGED <<totalSpansReceived, tracesSampledLatency, tracesSampledResilience, tracesSampledNominal, tracesDroppedNominal, tracesEvicted>>

CompleteTraceWithHighLatency ==
  /\ activeTraces > 0
  /\ activeTraces' = activeTraces - 1
  /\ tracesCompleted' = tracesCompleted + 1
  /\ tracesSampledLatency' = tracesSampledLatency + 1
  /\ UNCHANGED <<totalSpansReceived, tracesSampledErrors, tracesSampledResilience, tracesSampledNominal, tracesDroppedNominal, tracesEvicted>>

CompleteTraceWithResilienceEvent ==
  /\ activeTraces > 0
  /\ activeTraces' = activeTraces - 1
  /\ tracesCompleted' = tracesCompleted + 1
  /\ tracesSampledResilience' = tracesSampledResilience + 1
  /\ UNCHANGED <<totalSpansReceived, tracesSampledErrors, tracesSampledLatency, tracesSampledNominal, tracesDroppedNominal, tracesEvicted>>

CompleteTraceNominalSampled ==
  /\ activeTraces > 0
  /\ activeTraces' = activeTraces - 1
  /\ tracesCompleted' = tracesCompleted + 1
  /\ tracesSampledNominal' = tracesSampledNominal + 1
  /\ UNCHANGED <<totalSpansReceived, tracesSampledErrors, tracesSampledLatency, tracesSampledResilience, tracesDroppedNominal, tracesEvicted>>

CompleteTraceNominalDropped ==
  /\ activeTraces > 0
  /\ activeTraces' = activeTraces - 1
  /\ tracesCompleted' = tracesCompleted + 1
  /\ tracesDroppedNominal' = tracesDroppedNominal + 1
  /\ UNCHANGED <<totalSpansReceived, tracesSampledErrors, tracesSampledLatency, tracesSampledResilience, tracesSampledNominal, tracesEvicted>>

EvictStaleTrace ==
  /\ activeTraces > 0
  /\ activeTraces' = activeTraces - 1
  /\ tracesEvicted' = tracesEvicted + 1
  /\ UNCHANGED <<totalSpansReceived, tracesCompleted, tracesSampledErrors, tracesSampledLatency, tracesSampledResilience, tracesSampledNominal, tracesDroppedNominal>>

Next ==
  \/ IngestSpanNewTrace
  \/ IngestSpanExistingTrace
  \/ CompleteTraceWithError
  \/ CompleteTraceWithHighLatency
  \/ CompleteTraceWithResilienceEvent
  \/ CompleteTraceNominalSampled
  \/ CompleteTraceNominalDropped
  \/ EvictStaleTrace

Spec == Init /\ [][Next]_vars

ConservationInvariant ==
  tracesCompleted = tracesSampledErrors + tracesSampledLatency + tracesSampledResilience + tracesSampledNominal + tracesDroppedNominal

BufferCapacityInvariant ==
  activeTraces <= MaxActiveTraces

NonNegativeCountsInvariant ==
  /\ totalSpansReceived >= 0
  /\ tracesCompleted >= 0
  /\ tracesEvicted >= 0

=============================================================================
