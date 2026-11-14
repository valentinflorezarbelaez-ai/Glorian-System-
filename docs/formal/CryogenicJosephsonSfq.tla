---- MODULE CryogenicJosephsonSfq ----
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS MAX_BETA_C_X100, MAX_COOLING_CAPACITY_UW, MAX_TEMP_MK, MAX_STEPS

VARIABLES step, mixingChamberTempMk, betaCX100, dynamicPowerUw, thermalNoiseGammaX1000, regime

Init ==
  /\ step = 0
  /\ mixingChamberTempMk = 15
  /\ betaCX100 = 42
  /\ dynamicPowerUw = 142
  /\ thermalNoiseGammaX1000 = 2
  /\ regime = "OVERDAMPED_SFQ_LOCKED"

StewartMcCumberBounds ==
  /\ betaCX100 > 0
  /\ betaCX100 <= MAX_BETA_C_X100

ThermalLoadBoundsInvariant ==
  /\ dynamicPowerUw > 0
  /\ dynamicPowerUw <= MAX_COOLING_CAPACITY_UW
  /\ mixingChamberTempMk <= MAX_TEMP_MK

QuasiparticleNoiseInvariant ==
  /\ thermalNoiseGammaX1000 >= 0
  /\ thermalNoiseGammaX1000 < 100
  /\ regime \in {"OVERDAMPED_SFQ_LOCKED", "THERMAL_HEADROOM_WARNING", "QUASIPARTICLE_HYSTERESIS_RISK"}

Next ==
  /\ step < MAX_STEPS
  /\ step' = step + 1
  /\ mixingChamberTempMk' = IF step % 12 = 0 THEN 22 ELSE 15
  /\ betaCX100' = IF step % 10 = 0 THEN 88 ELSE 42
  /\ dynamicPowerUw' = IF step % 9 = 0 THEN 560 ELSE 142
  /\ thermalNoiseGammaX1000' = IF mixingChamberTempMk' > 15 THEN 4 ELSE 2
  /\ regime' =
      IF betaCX100' > MAX_BETA_C_X100 \/ dynamicPowerUw' > MAX_COOLING_CAPACITY_UW \/ mixingChamberTempMk' > MAX_TEMP_MK THEN "QUASIPARTICLE_HYSTERESIS_RISK"
      ELSE IF betaCX100' > 85 \/ dynamicPowerUw' * 100 > 75 * MAX_COOLING_CAPACITY_UW THEN "THERMAL_HEADROOM_WARNING"
      ELSE "OVERDAMPED_SFQ_LOCKED"

Spec == Init /\ [][Next]_<<step, mixingChamberTempMk, betaCX100, dynamicPowerUw, thermalNoiseGammaX1000, regime>>

====
