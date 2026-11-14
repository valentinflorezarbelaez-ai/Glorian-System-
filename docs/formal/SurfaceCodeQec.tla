------------------------------ MODULE SurfaceCodeQec ------------------------------
EXTENDS Naturals, Integers

VARIABLES
  codeDistance,
  physicalErrorRatePermille,
  thresholdPermille,
  syndromesOpen,
  logicalHaltActive

Init ==
  /\ codeDistance = 3
  /\ physicalErrorRatePermille = 2
  /\ thresholdPermille = 10
  /\ syndromesOpen = 0
  /\ logicalHaltActive = FALSE

ScaleUpCodeDistance ==
  /\ logicalHaltActive = FALSE
  /\ codeDistance < 15
  /\ codeDistance' = codeDistance + 2
  /\ UNCHANGED <<physicalErrorRatePermille, thresholdPermille, syndromesOpen, logicalHaltActive>>

InjectNoiseAndMatch ==
  /\ physicalErrorRatePermille' \in 1..15
  /\ logicalHaltActive' = (physicalErrorRatePermille' >= thresholdPermille)
  /\ syndromesOpen' = 0
  /\ UNCHANGED <<codeDistance, thresholdPermille>>

Next ==
  ScaleUpCodeDistance \/ InjectNoiseAndMatch

DistanceOddBoundsInvariant ==
  codeDistance >= 3 /\ codeDistance <= 15 /\ (codeDistance % 2) = 1 /\ syndromesOpen >= 0

ThresholdHaltSafetyInvariant ==
  physicalErrorRatePermille >= thresholdPermille => logicalHaltActive = TRUE

ParityConservationInvariant ==
  (syndromesOpen % 2) = 0

Spec == Init /\ [][Next]_<<codeDistance, physicalErrorRatePermille, thresholdPermille, syndromesOpen, logicalHaltActive>>
====
