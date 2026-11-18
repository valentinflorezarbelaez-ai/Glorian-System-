------------------------------ MODULE ClosedLoopRepoAutopilot ------------------------------
EXTENDS Naturals

CONSTANTS MaxCycleCount

VARIABLES
  phase,
  ingestedArtifacts,
  causalBackdoorValid,
  checkpointCaptured,
  simulationClean,
  harnessApproved,
  promotedCount

vars == <<phase, ingestedArtifacts, causalBackdoorValid, checkpointCaptured, simulationClean, harnessApproved, promotedCount>>

PHASES == {"IDLE", "INGESTED", "DIAGNOSED", "SIMULATED", "HARNESS_VERIFIED"}

Init ==
  /\ phase = "IDLE"
  /\ ingestedArtifacts = 0
  /\ causalBackdoorValid = FALSE
  /\ checkpointCaptured = FALSE
  /\ simulationClean = FALSE
  /\ harnessApproved = FALSE
  /\ promotedCount = 0

IngestOntology ==
  /\ phase = "IDLE"
  /\ promotedCount < MaxCycleCount
  /\ phase' = "INGESTED"
  /\ ingestedArtifacts' = 3
  /\ UNCHANGED <<causalBackdoorValid, checkpointCaptured, simulationClean, harnessApproved, promotedCount>>

DiagnoseCausal ==
  /\ phase = "INGESTED"
  /\ ingestedArtifacts > 0
  /\ phase' = "DIAGNOSED"
  /\ causalBackdoorValid' = TRUE
  /\ UNCHANGED <<ingestedArtifacts, checkpointCaptured, simulationClean, harnessApproved, promotedCount>>

SimulatePreFlight ==
  /\ phase = "DIAGNOSED"
  /\ causalBackdoorValid = TRUE
  /\ phase' = "SIMULATED"
  /\ checkpointCaptured' = TRUE
  /\ simulationClean' = TRUE
  /\ UNCHANGED <<ingestedArtifacts, causalBackdoorValid, harnessApproved, promotedCount>>

VerifyHarnessAndPromote ==
  /\ phase = "SIMULATED"
  /\ checkpointCaptured = TRUE
  /\ simulationClean = TRUE
  /\ phase' = "HARNESS_VERIFIED"
  /\ harnessApproved' = TRUE
  /\ promotedCount' = promotedCount + 1
  /\ UNCHANGED <<ingestedArtifacts, causalBackdoorValid, checkpointCaptured, simulationClean>>

ResetCycle ==
  /\ phase = "HARNESS_VERIFIED"
  /\ phase' = "IDLE"
  /\ ingestedArtifacts' = 0
  /\ causalBackdoorValid' = FALSE
  /\ checkpointCaptured' = FALSE
  /\ simulationClean' = FALSE
  /\ harnessApproved' = FALSE
  /\ UNCHANGED <<promotedCount>>

Next ==
  \/ IngestOntology
  \/ DiagnoseCausal
  \/ SimulatePreFlight
  \/ VerifyHarnessAndPromote
  \/ ResetCycle

TypeOK ==
  /\ phase \in PHASES
  /\ ingestedArtifacts \in Nat
  /\ causalBackdoorValid \in BOOLEAN
  /\ checkpointCaptured \in BOOLEAN
  /\ simulationClean \in BOOLEAN
  /\ harnessApproved \in BOOLEAN
  /\ promotedCount \in 0..MaxCycleCount

CausalDiagnosisRequiresIngestion ==
  causalBackdoorValid = TRUE => ingestedArtifacts > 0

SimulationRequiresDiagnosis ==
  simulationClean = TRUE => causalBackdoorValid = TRUE

VerificationRequiresCheckpoint ==
  harnessApproved = TRUE => (checkpointCaptured = TRUE /\ simulationClean = TRUE)

ZeroUnverifiedPromotion ==
  phase = "HARNESS_VERIFIED" => (ingestedArtifacts > 0 /\ causalBackdoorValid /\ checkpointCaptured /\ simulationClean /\ harnessApproved)

Spec == Init /\ [][Next]_vars
=============================================================================
