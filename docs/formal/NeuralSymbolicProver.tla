------------------------------ MODULE NeuralSymbolicProver ------------------------------
EXTENDS Naturals

CONSTANTS MaxRefinements, MaxAudits

VARIABLES
  phase,
  consecutionValid,
  safetyAdequate,
  refinementSteps,
  auditsSealed

vars == <<phase, consecutionValid, safetyAdequate, refinementSteps, auditsSealed>>

PHASES == {"IDLE", "TRACE_INGESTION", "INVARIANT_SYNTHESIZED", "CEGAR_REFINED", "PROVEN", "SEALED"}

Init ==
  /\ phase = "IDLE"
  /\ consecutionValid = FALSE
  /\ safetyAdequate = FALSE
  /\ refinementSteps = 0
  /\ auditsSealed = 0

IngestTraces ==
  /\ phase = "IDLE"
  /\ auditsSealed < MaxAudits
  /\ phase' = "TRACE_INGESTION"
  /\ UNCHANGED <<consecutionValid, safetyAdequate, refinementSteps, auditsSealed>>

SynthesizeCandidate ==
  /\ phase = "TRACE_INGESTION"
  /\ phase' = "INVARIANT_SYNTHESIZED"
  /\ consecutionValid' = FALSE
  /\ safetyAdequate' = TRUE
  /\ UNCHANGED <<refinementSteps, auditsSealed>>

ApplyCegarRefinement ==
  /\ phase = "INVARIANT_SYNTHESIZED"
  /\ refinementSteps < MaxRefinements
  /\ phase' = "CEGAR_REFINED"
  /\ refinementSteps' = refinementSteps + 1
  /\ consecutionValid' = TRUE
  /\ UNCHANGED <<safetyAdequate, auditsSealed>>

VerifyProof ==
  /\ phase \in {"INVARIANT_SYNTHESIZED", "CEGAR_REFINED"}
  /\ consecutionValid = TRUE
  /\ safetyAdequate = TRUE
  /\ phase' = "PROVEN"
  /\ UNCHANGED <<consecutionValid, safetyAdequate, refinementSteps, auditsSealed>>

SealAudit ==
  /\ phase = "PROVEN"
  /\ auditsSealed < MaxAudits
  /\ phase' = "SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<consecutionValid, safetyAdequate, refinementSteps>>

ResetProver ==
  /\ phase = "SEALED"
  /\ phase' = "IDLE"
  /\ consecutionValid' = FALSE
  /\ safetyAdequate' = FALSE
  /\ refinementSteps' = 0
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ IngestTraces
  \/ SynthesizeCandidate
  \/ ApplyCegarRefinement
  \/ VerifyProof
  \/ SealAudit
  \/ ResetProver

TypeOK ==
  /\ phase \in PHASES
  /\ consecutionValid \in BOOLEAN
  /\ safetyAdequate \in BOOLEAN
  /\ refinementSteps \in 0..MaxRefinements
  /\ auditsSealed \in 0..MaxAudits

InductiveSoundnessInvariant ==
  (phase = "PROVEN") => (consecutionValid = TRUE /\ safetyAdequate = TRUE)

BoundedRefinementInvariant ==
  refinementSteps <= MaxRefinements

=============================================================================
