------------------------------ MODULE HighNaEuvLithoOpc ------------------------------
EXTENDS Naturals, Integers

VARIABLES
  rayleighCdNm,
  doseDeviationPct,
  overlayErrorNm,
  stochasticDefectPerCm2,
  reticleRecalibrating

Init ==
  /\ rayleighCdNm = 8
  /\ doseDeviationPct = 1
  /\ overlayErrorNm = 2
  /\ stochasticDefectPerCm2 = 0
  /\ reticleRecalibrating = FALSE

StepOpcCorrection ==
  /\ rayleighCdNm' \in 6..14
  /\ doseDeviationPct' \in 0..8
  /\ overlayErrorNm' \in 1..5
  /\ reticleRecalibrating' = (doseDeviationPct' > 4 \/ overlayErrorNm' > 3)
  /\ stochasticDefectPerCm2' = IF reticleRecalibrating' THEN 0 ELSE doseDeviationPct'

Next == StepOpcCorrection

PositiveRayleighCdInvariant ==
  rayleighCdNm >= 6 /\ rayleighCdNm <= 14

DoseWindowBounds ==
  doseDeviationPct >= 0 /\ doseDeviationPct <= 8

OverlayBudgetInvariant ==
  overlayErrorNm >= 1 /\ overlayErrorNm <= 5 /\ ((doseDeviationPct > 4 \/ overlayErrorNm > 3) => reticleRecalibrating = TRUE)

StochasticDefectBounds ==
  stochasticDefectPerCm2 >= 0

Spec == Init /\ [][Next]_<<rayleighCdNm, doseDeviationPct, overlayErrorNm, stochasticDefectPerCm2, reticleRecalibrating>>
====
