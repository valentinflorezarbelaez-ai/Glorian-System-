------------------------------ MODULE CausalMetaLearning ------------------------------
EXTENDS Naturals, Integers

CONSTANTS MaxAudits

VARIABLES
  phase,
  dagAcyclic,
  graphMutilated,
  backdoorBlocked,
  counterfactualValid,
  auditsSealed

vars == <<phase, dagAcyclic, graphMutilated, backdoorBlocked, counterfactualValid, auditsSealed>>

PHASES == {"IDLE", "DAG_VALIDATED", "INTERVENTION_MUTILATED", "BACKDOOR_EVALUATED", "COUNTERFACTUAL_ABDUCED", "POLICY_DISTILLED", "AUDIT_SEALED"}

Init ==
  /\ phase = "IDLE"
  /\ dagAcyclic = TRUE
  /\ graphMutilated = FALSE
  /\ backdoorBlocked = FALSE
  /\ counterfactualValid = FALSE
  /\ auditsSealed = 0

ValidateDag ==
  /\ phase = "IDLE"
  /\ auditsSealed < MaxAudits
  /\ phase' = "DAG_VALIDATED"
  /\ dagAcyclic' = TRUE
  /\ UNCHANGED <<graphMutilated, backdoorBlocked, counterfactualValid, auditsSealed>>

MutilateIntervention ==
  /\ phase = "DAG_VALIDATED"
  /\ phase' = "INTERVENTION_MUTILATED"
  /\ graphMutilated' = TRUE
  /\ UNCHANGED <<dagAcyclic, backdoorBlocked, counterfactualValid, auditsSealed>>

EvaluateBackdoor ==
  /\ phase = "INTERVENTION_MUTILATED"
  /\ phase' = "BACKDOOR_EVALUATED"
  /\ backdoorBlocked' = TRUE
  /\ UNCHANGED <<dagAcyclic, graphMutilated, counterfactualValid, auditsSealed>>

AbduceCounterfactual ==
  /\ phase = "BACKDOOR_EVALUATED"
  /\ phase' = "COUNTERFACTUAL_ABDUCED"
  /\ counterfactualValid' = TRUE
  /\ UNCHANGED <<dagAcyclic, graphMutilated, backdoorBlocked, auditsSealed>>

DistillPolicy ==
  /\ phase = "COUNTERFACTUAL_ABDUCED"
  /\ phase' = "POLICY_DISTILLED"
  /\ UNCHANGED <<dagAcyclic, graphMutilated, backdoorBlocked, counterfactualValid, auditsSealed>>

SealAudit ==
  /\ phase = "POLICY_DISTILLED"
  /\ auditsSealed < MaxAudits
  /\ phase' = "AUDIT_SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<dagAcyclic, graphMutilated, backdoorBlocked, counterfactualValid>>

ResetEngine ==
  /\ phase = "AUDIT_SEALED"
  /\ phase' = "IDLE"
  /\ dagAcyclic' = TRUE
  /\ graphMutilated' = FALSE
  /\ backdoorBlocked' = FALSE
  /\ counterfactualValid' = FALSE
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ ValidateDag
  \/ MutilateIntervention
  \/ EvaluateBackdoor
  \/ AbduceCounterfactual
  \/ DistillPolicy
  \/ SealAudit
  \/ ResetEngine

TypeOK ==
  /\ phase \in PHASES
  /\ dagAcyclic \in BOOLEAN
  /\ graphMutilated \in BOOLEAN
  /\ backdoorBlocked \in BOOLEAN
  /\ counterfactualValid \in BOOLEAN
  /\ auditsSealed \in 0..MaxAudits

AcyclicityPreserved ==
  dagAcyclic = TRUE

CounterfactualSoundness ==
  (phase = "COUNTERFACTUAL_ABDUCED" \/ phase = "POLICY_DISTILLED") => (counterfactualValid = TRUE /\ graphMutilated = TRUE)

BackdoorSoundness ==
  (phase = "BACKDOOR_EVALUATED") => (backdoorBlocked = TRUE)

=============================================================================
