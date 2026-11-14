---- MODULE SubseaDwdmShannon ----
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS MIN_GSNR_DB_X10, MAX_NLI_ASE_RATIO_X100, MAX_STEPS

VARIABLES step, launchPowerDbmX10, aseNoiseX100, kerrNliX100, generalizedSnrDbX10, cableCapacityTbps, regime

Init ==
  /\ step = 0
  /\ launchPowerDbmX10 = -5
  /\ aseNoiseX100 = 100
  /\ kerrNliX100 = 32
  /\ generalizedSnrDbX10 = 128
  /\ cableCapacityTbps = 24
  /\ regime = "OPTIMAL_NONLINEAR_SHANNON"

GsnrThresholdBounds ==
  /\ generalizedSnrDbX10 >= MIN_GSNR_DB_X10
  /\ launchPowerDbmX10 >= -200 /\ launchPowerDbmX10 <= 150

KerrNonlinearPowerInvariant ==
  /\ aseNoiseX100 > 0
  /\ kerrNliX100 > 0
  /\ (kerrNliX100 * 100) \div aseNoiseX100 <= 200

ShannonCapacityBounds ==
  /\ cableCapacityTbps > 0
  /\ regime \in {"OPTIMAL_NONLINEAR_SHANNON", "KERR_NONLINEAR_SATURATION", "OSNR_BELOW_FEC_THRESHOLD"}

Next ==
  /\ step < MAX_STEPS
  /\ step' = step + 1
  /\ launchPowerDbmX10' = IF step % 11 = 0 THEN 20 ELSE -5
  /\ aseNoiseX100' = 100
  /\ kerrNliX100' = IF launchPowerDbmX10' > 0 THEN 78 ELSE 32
  /\ generalizedSnrDbX10' = IF launchPowerDbmX10' > 0 THEN 124 ELSE 128
  /\ cableCapacityTbps' = IF generalizedSnrDbX10' >= 125 THEN 24 ELSE 22
  /\ regime' =
      IF generalizedSnrDbX10' < MIN_GSNR_DB_X10 THEN "OSNR_BELOW_FEC_THRESHOLD"
      ELSE IF kerrNliX100' > MAX_NLI_ASE_RATIO_X100 THEN "KERR_NONLINEAR_SATURATION"
      ELSE "OPTIMAL_NONLINEAR_SHANNON"

Spec == Init /\ [][Next]_<<step, launchPowerDbmX10, aseNoiseX100, kerrNliX100, generalizedSnrDbX10, cableCapacityTbps, regime>>

====
