------------------------------ MODULE LawsonFusionIgnition ------------------------------
EXTENDS Naturals, Integers

VARIABLES
  tripleProductRatioPct,
  p2AsymmetryPermille,
  alphaSelfHeatingActive,
  shotAborted,
  plasmaGainQ

Init ==
  /\ tripleProductRatioPct = 140
  /\ p2AsymmetryPermille = 12
  /\ alphaSelfHeatingActive = TRUE
  /\ shotAborted = FALSE
  /\ plasmaGainQ = 18

EvaluatePulseStep ==
  /\ p2AsymmetryPermille' \in 5..50
  /\ tripleProductRatioPct' \in 60..220
  /\ shotAborted' = (p2AsymmetryPermille' > 35)
  /\ alphaSelfHeatingActive' = (shotAborted' = FALSE /\ tripleProductRatioPct' >= 100)
  /\ plasmaGainQ' = IF shotAborted' THEN 0 ELSE IF alphaSelfHeatingActive' THEN 25 ELSE 4

Next ==
  EvaluatePulseStep

FusionEnergyBounds ==
  plasmaGainQ >= 0 /\ p2AsymmetryPermille >= 0

SymmetryAbortSafetyInvariant ==
  p2AsymmetryPermille > 35 => (shotAborted = TRUE /\ alphaSelfHeatingActive = FALSE)

LawsonIgnitionInvariant ==
  alphaSelfHeatingActive = TRUE => (tripleProductRatioPct >= 100 /\ shotAborted = FALSE)

Spec == Init /\ [][Next]_<<tripleProductRatioPct, p2AsymmetryPermille, alphaSelfHeatingActive, shotAborted, plasmaGainQ>>
====
