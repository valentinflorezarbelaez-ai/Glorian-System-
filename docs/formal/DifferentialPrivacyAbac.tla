------------------------------ MODULE DifferentialPrivacyAbac ------------------------------
EXTENDS Naturals, Integers

VARIABLES
  epsilonSpentPermille,
  epsilonCeilingPermille,
  sensitivityLevel,
  gaussianSigmaScale,
  queryAdmitted

Init ==
  /\ epsilonSpentPermille = 100
  /\ epsilonCeilingPermille = 3000
  /\ sensitivityLevel = 10
  /\ gaussianSigmaScale = 45
  /\ queryAdmitted = TRUE

StepPrivacyQuery ==
  /\ sensitivityLevel' \in 1..25
  /\ gaussianSigmaScale' = sensitivityLevel' * 4
  /\ IF epsilonSpentPermille + 120 <= epsilonCeilingPermille
     THEN /\ epsilonSpentPermille' = epsilonSpentPermille + 120
          /\ queryAdmitted' = TRUE
     ELSE /\ epsilonSpentPermille' = epsilonSpentPermille
          /\ queryAdmitted' = FALSE
  /\ UNCHANGED <<epsilonCeilingPermille>>

Next == StepPrivacyQuery

PrivacyLossBounds ==
  epsilonSpentPermille <= epsilonCeilingPermille

GaussianSigmaPositiveInvariant ==
  gaussianSigmaScale > 0

SensitivityBounds ==
  sensitivityLevel >= 1 /\ sensitivityLevel <= 25

BudgetMonotonicInvariant ==
  epsilonSpentPermille >= 100

Spec == Init /\ [][Next]_<<epsilonSpentPermille, epsilonCeilingPermille, sensitivityLevel, gaussianSigmaScale, queryAdmitted>>
====
