------------------- MODULE AdaptiveConcurrencyGovernor -------------------
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS MinLimit, MaxLimit, EmergencyHeadroom

VARIABLES 
  concurrencyLimit,
  inFlight,
  baselineRttMs,
  currentRttMs,
  admittedCritical,
  admittedNormal,
  shedBestEffort,
  shedQueueExpired

vars == <<concurrencyLimit, inFlight, baselineRttMs, currentRttMs, admittedCritical, admittedNormal, shedBestEffort, shedQueueExpired>>

TypeOK ==
  /\ concurrencyLimit \in MinLimit..MaxLimit
  /\ inFlight \in 0..(MaxLimit + EmergencyHeadroom)
  /\ baselineRttMs \in 10..500
  /\ currentRttMs \in 10..2000
  /\ admittedCritical \in Nat
  /\ admittedNormal \in Nat
  /\ shedBestEffort \in Nat
  /\ shedQueueExpired \in Nat

Init ==
  /\ concurrencyLimit = 50
  /\ inFlight = 0
  /\ baselineRttMs = 20
  /\ currentRttMs = 20
  /\ admittedCritical = 0
  /\ admittedNormal = 0
  /\ shedBestEffort = 0
  /\ shedQueueExpired = 0

AdmitNormalBelowLimit ==
  /\ inFlight < concurrencyLimit
  /\ inFlight' = inFlight + 1
  /\ admittedNormal' = admittedNormal + 1
  /\ UNCHANGED <<concurrencyLimit, baselineRttMs, currentRttMs, admittedCritical, shedBestEffort, shedQueueExpired>>

AdmitCriticalWithHeadroom ==
  /\ inFlight >= concurrencyLimit
  /\ inFlight < concurrencyLimit + EmergencyHeadroom
  /\ inFlight' = inFlight + 1
  /\ admittedCritical' = admittedCritical + 1
  /\ UNCHANGED <<concurrencyLimit, baselineRttMs, currentRttMs, admittedNormal, shedBestEffort, shedQueueExpired>>

ShedBestEffortAtLimit ==
  /\ inFlight >= concurrencyLimit
  /\ shedBestEffort' = shedBestEffort + 1
  /\ UNCHANGED <<concurrencyLimit, inFlight, baselineRttMs, currentRttMs, admittedCritical, admittedNormal, shedQueueExpired>>

ShedQueueExpiredCoDel ==
  /\ shedQueueExpired' = shedQueueExpired + 1
  /\ UNCHANGED <<concurrencyLimit, inFlight, baselineRttMs, currentRttMs, admittedCritical, admittedNormal, shedBestEffort>>

ContractOnLatencySpike ==
  /\ currentRttMs < 1000
  /\ currentRttMs' = currentRttMs + 40
  /\ concurrencyLimit' = IF (concurrencyLimit * baselineRttMs) \div (currentRttMs + 40) < MinLimit
                         THEN MinLimit
                         ELSE (concurrencyLimit * baselineRttMs) \div (currentRttMs + 40)
  /\ UNCHANGED <<inFlight, baselineRttMs, admittedCritical, admittedNormal, shedBestEffort, shedQueueExpired>>

ExpandOnLatencyRecovery ==
  /\ currentRttMs > baselineRttMs
  /\ currentRttMs' = baselineRttMs
  /\ concurrencyLimit' = IF concurrencyLimit + 3 > MaxLimit
                         THEN MaxLimit
                         ELSE concurrencyLimit + 3
  /\ UNCHANGED <<inFlight, baselineRttMs, admittedCritical, admittedNormal, shedBestEffort, shedQueueExpired>>

CompleteExecution ==
  /\ inFlight > 0
  /\ inFlight' = inFlight - 1
  /\ UNCHANGED <<concurrencyLimit, baselineRttMs, currentRttMs, admittedCritical, admittedNormal, shedBestEffort, shedQueueExpired>>

Next ==
  \/ AdmitNormalBelowLimit
  \/ AdmitCriticalWithHeadroom
  \/ ShedBestEffortAtLimit
  \/ ShedQueueExpiredCoDel
  \/ ContractOnLatencySpike
  \/ ExpandOnLatencyRecovery
  \/ CompleteExecution

LimitBoundedInvariant ==
  /\ concurrencyLimit >= MinLimit
  /\ concurrencyLimit <= MaxLimit

InFlightBoundedInvariant ==
  /\ inFlight <= concurrencyLimit + EmergencyHeadroom

SafetyInvariant ==
  /\ TypeOK
  /\ LimitBoundedInvariant
  /\ InFlightBoundedInvariant

=============================================================================
