------------------------------ MODULE NeuromorphicPlanner ------------------------------
EXTENDS Naturals, Integers

CONSTANTS MaxAudits

VARIABLES
  phase,
  membranePotential,
  inRefractory,
  synapticWeight,
  selectedHeuristic,
  auditsSealed

vars == <<phase, membranePotential, inRefractory, synapticWeight, selectedHeuristic, auditsSealed>>

PHASES == {"IDLE", "SENSORY_ENCODED", "SPIKE_DISCHARGED", "PLASTICITY_APPLIED", "ACTION_SELECTED", "AUDIT_SEALED"}
HEURISTICS == {"NONE", "BATCH_COALESCE", "SPECULATIVE_DEDUP", "PROACTIVE_BACKPRESSURE", "CACHE_PREWARM", "LOAD_SHED"}

Init ==
  /\ phase = "IDLE"
  /\ membranePotential = -70
  /\ inRefractory = FALSE
  /\ synapticWeight = 50
  /\ selectedHeuristic = "NONE"
  /\ auditsSealed = 0

EncodeSensory ==
  /\ phase = "IDLE"
  /\ auditsSealed < MaxAudits
  /\ phase' = "SENSORY_ENCODED"
  /\ membranePotential' = -54
  /\ UNCHANGED <<inRefractory, synapticWeight, selectedHeuristic, auditsSealed>>

DischargeSpike ==
  /\ phase = "SENSORY_ENCODED"
  /\ membranePotential >= -55
  /\ phase' = "SPIKE_DISCHARGED"
  /\ membranePotential' = -70
  /\ inRefractory' = TRUE
  /\ UNCHANGED <<synapticWeight, selectedHeuristic, auditsSealed>>

ApplyPlasticity ==
  /\ phase = "SPIKE_DISCHARGED"
  /\ phase' = "PLASTICITY_APPLIED"
  /\ inRefractory' = FALSE
  /\ synapticWeight' = IF synapticWeight + 10 <= 100 THEN synapticWeight + 10 ELSE 100
  /\ UNCHANGED <<membranePotential, selectedHeuristic, auditsSealed>>

SelectAction ==
  /\ phase = "PLASTICITY_APPLIED"
  /\ phase' = "ACTION_SELECTED"
  /\ selectedHeuristic' = "PROACTIVE_BACKPRESSURE"
  /\ UNCHANGED <<membranePotential, inRefractory, synapticWeight, auditsSealed>>

SealAudit ==
  /\ phase = "ACTION_SELECTED"
  /\ auditsSealed < MaxAudits
  /\ phase' = "AUDIT_SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<membranePotential, inRefractory, synapticWeight, selectedHeuristic>>

ResetPlanner ==
  /\ phase = "AUDIT_SEALED"
  /\ phase' = "IDLE"
  /\ membranePotential' = -70
  /\ inRefractory' = FALSE
  /\ synapticWeight' = 50
  /\ selectedHeuristic' = "NONE"
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ EncodeSensory
  \/ DischargeSpike
  \/ ApplyPlasticity
  \/ SelectAction
  \/ SealAudit
  \/ ResetPlanner

TypeOK ==
  /\ phase \in PHASES
  /\ membranePotential \in -100..0
  /\ inRefractory \in BOOLEAN
  /\ synapticWeight \in 10..100
  /\ selectedHeuristic \in HEURISTICS
  /\ auditsSealed \in 0..MaxAudits

LIFRefractorySafety ==
  (inRefractory = TRUE) => (membranePotential = -70)

SynapticWeightBounds ==
  /\ synapticWeight >= 10
  /\ synapticWeight <= 100

ActionSelectionSoundness ==
  (phase = "ACTION_SELECTED") => (selectedHeuristic # "NONE")

=============================================================================
