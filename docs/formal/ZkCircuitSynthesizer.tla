------------------------------ MODULE ZkCircuitSynthesizer ------------------------------
EXTENDS Naturals

CONSTANTS MaxConstraints, MaxAudits

VARIABLES
  phase,
  constraintsCount,
  witnessAssigned,
  soundnessVerified,
  auditsSealed

vars == <<phase, constraintsCount, witnessAssigned, soundnessVerified, auditsSealed>>

PHASES == {"IDLE", "CIRCUIT_COMPILED", "WITNESS_GENERATED", "CONSTRAINTS_SATISFIED", "AUDIT_SEALED"}

Init ==
  /\ phase = "IDLE"
  /\ constraintsCount = 0
  /\ witnessAssigned = FALSE
  /\ soundnessVerified = FALSE
  /\ auditsSealed = 0

CompileCircuit ==
  /\ phase = "IDLE"
  /\ auditsSealed < MaxAudits
  /\ phase' = "CIRCUIT_COMPILED"
  /\ constraintsCount' = 3
  /\ UNCHANGED <<witnessAssigned, soundnessVerified, auditsSealed>>

SynthesizeWitness ==
  /\ phase = "CIRCUIT_COMPILED"
  /\ phase' = "WITNESS_GENERATED"
  /\ witnessAssigned' = TRUE
  /\ UNCHANGED <<constraintsCount, soundnessVerified, auditsSealed>>

VerifyConstraints ==
  /\ phase = "WITNESS_GENERATED"
  /\ witnessAssigned = TRUE
  /\ phase' = "CONSTRAINTS_SATISFIED"
  /\ soundnessVerified' = TRUE
  /\ UNCHANGED <<constraintsCount, witnessAssigned, auditsSealed>>

SealAudit ==
  /\ phase = "CONSTRAINTS_SATISFIED"
  /\ auditsSealed < MaxAudits
  /\ phase' = "AUDIT_SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<constraintsCount, witnessAssigned, soundnessVerified>>

ResetSynthesizer ==
  /\ phase = "AUDIT_SEALED"
  /\ phase' = "IDLE"
  /\ constraintsCount' = 0
  /\ witnessAssigned' = FALSE
  /\ soundnessVerified' = FALSE
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ CompileCircuit
  \/ SynthesizeWitness
  \/ VerifyConstraints
  \/ SealAudit
  \/ ResetSynthesizer

TypeOK ==
  /\ phase \in PHASES
  /\ constraintsCount \in 0..MaxConstraints
  /\ witnessAssigned \in BOOLEAN
  /\ soundnessVerified \in BOOLEAN
  /\ auditsSealed \in 0..MaxAudits

SoundnessInvariant ==
  (phase = "CONSTRAINTS_SATISFIED") => (witnessAssigned = TRUE /\ soundnessVerified = TRUE)

NonZeroConstraintsInvariant ==
  (phase \in {"CIRCUIT_COMPILED", "WITNESS_GENERATED", "CONSTRAINTS_SATISFIED"}) => (constraintsCount > 0)

=============================================================================
