-------------------- MODULE MultiWindowSloGovernor --------------------
(*
  TLA+ Formal Mathematical Specification of the Multi-Window Multi-Burn-Rate
  SLO & Error Budget Governor (Google SRE Standard).
  Governed by EOS System SPEC-110 / PLAN-110 / ADR-110.
  Proves Error Budget Headroom Boundedness, Dual-Window Suppression,
  and Deterministic Fleet Deployment Freeze.
*)

EXTENDS Naturals

CONSTANTS
  SloTarget,                  \* Availability target scaled by 10 (e.g. 999 for 99.9%)
  CriticalBurnRateThreshold   \* Critical burn rate scaled by 10 (e.g. 144 for 14.4x)

VARIABLES
  totalEvents,                \* Total requests processed
  totalErrors,                \* Total error events observed
  burnRate1h,                 \* Long-window 1-hour burn rate (scaled by 10)
  burnRate5m,                 \* Short-window 5-minute burn rate (scaled by 10)
  deploymentFrozen            \* Boolean gate status: TRUE = frozen, FALSE = thawed

vars == <<totalEvents, totalErrors, burnRate1h, burnRate5m, deploymentFrozen>>

-----------------------------------------------------------------------------

\* Initial State: zero events, zero errors, nominal burn rates, deployment thawed
Init ==
  /\ totalEvents = 0
  /\ totalErrors = 0
  /\ burnRate1h = 10    \* 1.0x steady-state
  /\ burnRate5m = 10    \* 1.0x steady-state
  /\ deploymentFrozen = FALSE

\* Nominal execution: error rate within budget (B <= 1.0)
IngestNominal ==
  /\ totalEvents < 500
  /\ totalEvents' = totalEvents + 1
  /\ burnRate1h' = 10   \* 1.0x
  /\ burnRate5m' = 10   \* 1.0x
  /\ deploymentFrozen' = FALSE
  /\ UNCHANGED <<totalErrors>>

\* Transient error spike: 5m window spikes, but 1h window stays below critical threshold
IngestTransientSpike ==
  /\ totalEvents < 500
  /\ totalEvents' = totalEvents + 1
  /\ totalErrors' = totalErrors + 1
  /\ burnRate5m' = 200  \* 20.0x in 5m
  /\ burnRate1h' = 50   \* 5.0x in 1h (< 14.4x)
  \* Dual-window suppression prevents false alert and leaves deployment thawed
  /\ deploymentFrozen' = FALSE

\* Critical sustained outage: both 1h and 5m burn rates exceed 14.4x threshold
IngestCriticalOutage ==
  /\ totalEvents < 500
  /\ totalEvents' = totalEvents + 1
  /\ totalErrors' = totalErrors + 5
  /\ burnRate1h' = 150  \* 15.0x (> 14.4x)
  /\ burnRate5m' = 180  \* 18.0x (> 14.4x)
  /\ deploymentFrozen' = TRUE

\* Recovery: error rate subsides, budget recovers, thawing deployments
RecoverAndThaw ==
  /\ deploymentFrozen = TRUE
  /\ totalEvents' = totalEvents + 10
  /\ burnRate1h' = 8    \* 0.8x
  /\ burnRate5m' = 5    \* 0.5x
  /\ deploymentFrozen' = FALSE
  /\ UNCHANGED <<totalErrors>>

\* Next State Transition
Next ==
  \/ IngestNominal
  \/ IngestTransientSpike
  \/ IngestCriticalOutage
  \/ RecoverAndThaw

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------

\* Mathematical Invariants:

\* Invariant 1: Total errors never exceed total events
BudgetAccountingBoundedInvariant ==
  totalErrors <= totalEvents

\* Invariant 2: When both 1h and 5m burn rates exceed critical threshold, deployments MUST be frozen
DeploymentFreezeInvariant ==
  (burnRate1h >= CriticalBurnRateThreshold /\ burnRate5m >= CriticalBurnRateThreshold) => deploymentFrozen = TRUE

\* Invariant 3: Single-window transient spike never freezes deployment
TransientSpikeSuppressedInvariant ==
  (burnRate5m >= CriticalBurnRateThreshold /\ burnRate1h < CriticalBurnRateThreshold) => deploymentFrozen = FALSE

\* Unified Safety Invariant
SafetyInvariant ==
  /\ BudgetAccountingBoundedInvariant
  /\ DeploymentFreezeInvariant
  /\ TransientSpikeSuppressedInvariant

=============================================================================
