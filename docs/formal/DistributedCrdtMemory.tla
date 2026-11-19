------------------------------ MODULE DistributedCrdtMemory ------------------------------
EXTENDS Naturals

CONSTANTS MaxVal, MaxAudits

VARIABLES
  phase,
  valA,
  valB,
  clockA,
  clockB,
  converged,
  auditsSealed

vars == <<phase, valA, valB, clockA, clockB, converged, auditsSealed>>

PHASES == {"IDLE", "LOCAL_MUTATION", "MERGING", "CONVERGED", "SEALED"}

Init ==
  /\ phase = "IDLE"
  /\ valA = 0
  /\ valB = 0
  /\ clockA = 0
  /\ clockB = 0
  /\ converged = FALSE
  /\ auditsSealed = 0

MutateNodeA ==
  /\ phase = "IDLE"
  /\ auditsSealed < MaxAudits
  /\ phase' = "LOCAL_MUTATION"
  /\ valA' = 1
  /\ clockA' = 1
  /\ UNCHANGED <<valB, clockB, converged, auditsSealed>>

MutateNodeB ==
  /\ phase = "LOCAL_MUTATION"
  /\ phase' = "MERGING"
  /\ valB' = 2
  /\ clockB' = 2
  /\ UNCHANGED <<valA, clockA, converged, auditsSealed>>

MergeDeltas ==
  /\ phase = "MERGING"
  /\ phase' = "CONVERGED"
  /\ valA' = 2
  /\ valB' = 2
  /\ clockA' = 2
  /\ clockB' = 2
  /\ converged' = TRUE
  /\ UNCHANGED <<auditsSealed>>

SealAudit ==
  /\ phase = "CONVERGED"
  /\ auditsSealed < MaxAudits
  /\ phase' = "SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<valA, valB, clockA, clockB, converged>>

ResetCrdt ==
  /\ phase = "SEALED"
  /\ phase' = "IDLE"
  /\ valA' = 0
  /\ valB' = 0
  /\ clockA' = 0
  /\ clockB' = 0
  /\ converged' = FALSE
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ MutateNodeA
  \/ MutateNodeB
  \/ MergeDeltas
  \/ SealAudit
  \/ ResetCrdt

TypeOK ==
  /\ phase \in PHASES
  /\ valA \in 0..MaxVal
  /\ valB \in 0..MaxVal
  /\ clockA \in 0..MaxVal
  /\ clockB \in 0..MaxVal
  /\ converged \in BOOLEAN
  /\ auditsSealed \in 0..MaxAudits

StrongEventualConsistencyInvariant ==
  (phase = "CONVERGED") => (valA = valB /\ clockA = clockB /\ converged = TRUE)

MonotonicClockInvariant ==
  clockA <= MaxVal /\ clockB <= MaxVal

=============================================================================
