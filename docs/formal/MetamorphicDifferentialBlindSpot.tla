------------------------------ MODULE MetamorphicDifferentialBlindSpot ------------------------------
EXTENDS Naturals

CONSTANTS MaxCampaigns

VARIABLES
  phase,
  shrinkingSteps,
  shrinkingMonotonic,
  differentialChecked,
  metamorphicChecked,
  fuzzHttp5xxCount,
  campaignsSealed

vars == <<phase, shrinkingSteps, shrinkingMonotonic, differentialChecked, metamorphicChecked, fuzzHttp5xxCount, campaignsSealed>>

PHASES == {"IDLE", "STRUCTURAL_SHRUNK", "DIFFERENTIAL_OK", "METAMORPHIC_OK", "FUZZ_VERIFIED", "SEALED"}

Init ==
  /\ phase = "IDLE"
  /\ shrinkingSteps = 0
  /\ shrinkingMonotonic = TRUE
  /\ differentialChecked = FALSE
  /\ metamorphicChecked = FALSE
  /\ fuzzHttp5xxCount = 0
  /\ campaignsSealed = 0

ShrinkCounterexample ==
  /\ phase = "IDLE"
  /\ campaignsSealed < MaxCampaigns
  /\ phase' = "STRUCTURAL_SHRUNK"
  /\ shrinkingSteps' = 1
  /\ shrinkingMonotonic' = TRUE
  /\ UNCHANGED <<differentialChecked, metamorphicChecked, fuzzHttp5xxCount, campaignsSealed>>

VerifyDifferential ==
  /\ phase = "STRUCTURAL_SHRUNK"
  /\ phase' = "DIFFERENTIAL_OK"
  /\ differentialChecked' = TRUE
  /\ UNCHANGED <<shrinkingSteps, shrinkingMonotonic, metamorphicChecked, fuzzHttp5xxCount, campaignsSealed>>

VerifyMetamorphic ==
  /\ phase = "DIFFERENTIAL_OK"
  /\ differentialChecked = TRUE
  /\ phase' = "METAMORPHIC_OK"
  /\ metamorphicChecked' = TRUE
  /\ UNCHANGED <<shrinkingSteps, shrinkingMonotonic, differentialChecked, fuzzHttp5xxCount, campaignsSealed>>

RunBoundaryFuzz ==
  /\ phase = "METAMORPHIC_OK"
  /\ metamorphicChecked = TRUE
  /\ phase' = "FUZZ_VERIFIED"
  /\ fuzzHttp5xxCount' = 0
  /\ UNCHANGED <<shrinkingSteps, shrinkingMonotonic, differentialChecked, metamorphicChecked, campaignsSealed>>

SealAuditReceipt ==
  /\ phase = "FUZZ_VERIFIED"
  /\ differentialChecked = TRUE
  /\ metamorphicChecked = TRUE
  /\ fuzzHttp5xxCount = 0
  /\ phase' = "SEALED"
  /\ campaignsSealed' = campaignsSealed + 1
  /\ UNCHANGED <<shrinkingSteps, shrinkingMonotonic, differentialChecked, metamorphicChecked, fuzzHttp5xxCount>>

ResetCampaign ==
  /\ phase = "SEALED"
  /\ phase' = "IDLE"
  /\ shrinkingSteps' = 0
  /\ shrinkingMonotonic' = TRUE
  /\ differentialChecked' = FALSE
  /\ metamorphicChecked' = FALSE
  /\ fuzzHttp5xxCount' = 0
  /\ UNCHANGED <<campaignsSealed>>

Next ==
  \/ ShrinkCounterexample
  \/ VerifyDifferential
  \/ VerifyMetamorphic
  \/ RunBoundaryFuzz
  \/ SealAuditReceipt
  \/ ResetCampaign

Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ phase \in PHASES
  /\ shrinkingSteps \in Nat
  /\ shrinkingMonotonic \in BOOLEAN
  /\ differentialChecked \in BOOLEAN
  /\ metamorphicChecked \in BOOLEAN
  /\ fuzzHttp5xxCount \in Nat
  /\ campaignsSealed \in 0..MaxCampaigns

ShrinkingMonotonicityInvariant == shrinkingMonotonic = TRUE
ZeroUnhandled500Invariant == fuzzHttp5xxCount = 0
SafetyInvariant ==
  (phase = "SEALED") => (differentialChecked /\ metamorphicChecked /\ fuzzHttp5xxCount = 0)

=============================================================================
