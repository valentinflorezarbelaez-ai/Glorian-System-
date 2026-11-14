------------------------------ MODULE RelativisticBeamTwiss ------------------------------
EXTENDS Naturals, Integers

VARIABLES
  lorentzGamma,
  fodoTraceAbsPermille,
  symplecticDetPermille,
  luminosityUnits,
  synchrotronLossKev,
  magnetDumpTriggered

Init ==
  /\ lorentzGamma = 7247
  /\ fodoTraceAbsPermille = 1410
  /\ symplecticDetPermille = 1000
  /\ luminosityUnits = 240
  /\ synchrotronLossKev = 7
  /\ magnetDumpTriggered = FALSE

StepLatticeCycle ==
  /\ lorentzGamma' \in 1000..8000
  /\ fodoTraceAbsPermille' \in 900..2100
  /\ synchrotronLossKev' \in 4..20
  /\ magnetDumpTriggered' = (fodoTraceAbsPermille' >= 2000 \/ synchrotronLossKev' > 15)
  /\ luminosityUnits' = IF magnetDumpTriggered' THEN 0 ELSE 240
  /\ UNCHANGED <<symplecticDetPermille>>

Next == StepLatticeCycle

LorentzGammaBounds ==
  lorentzGamma > 1

SymplecticDetInvariant ==
  symplecticDetPermille = 1000

LuminosityNonNegativeBounds ==
  luminosityUnits >= 0 /\ (magnetDumpTriggered = TRUE => luminosityUnits = 0)

SynchrotronLossInvariant ==
  synchrotronLossKev >= 0

Spec == Init /\ [][Next]_<<lorentzGamma, fodoTraceAbsPermille, symplecticDetPermille, luminosityUnits, synchrotronLossKev, magnetDumpTriggered>>
====
