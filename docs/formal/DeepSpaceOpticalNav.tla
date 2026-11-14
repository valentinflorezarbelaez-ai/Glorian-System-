---- MODULE DeepSpaceOpticalNav ----
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS MAX_POSITION_UNCERTAINTY_KM, MIN_PULSAR_COUNT, MAX_STEPS

VARIABLES step, pulsarCount, sepAngleDeg, shapiroDelayMicroSec, xnavKm, deltaDorKm, combinedPositionUncertaintyKm, regime

Init ==
  /\ step = 0
  /\ pulsarCount = 6
  /\ sepAngleDeg = 24
  /\ shapiroDelayMicroSec = 109
  /\ xnavKm = 1
  /\ deltaDorKm = 1
  /\ combinedPositionUncertaintyKm = 1
  /\ regime = "NOMINAL_DEEP_SPACE_LOCK"

PositionUncertaintyBounds ==
  /\ combinedPositionUncertaintyKm > 0
  /\ combinedPositionUncertaintyKm <= MAX_POSITION_UNCERTAINTY_KM

ShapiroDelayPositiveInvariant ==
  /\ shapiroDelayMicroSec > 0
  /\ sepAngleDeg > 0 /\ sepAngleDeg <= 180

PulsarTriangulationInvariant ==
  /\ pulsarCount >= MIN_PULSAR_COUNT
  /\ regime \in {"NOMINAL_DEEP_SPACE_LOCK", "SOLAR_CONJUNCTION_CAUTION", "EPHEMERIS_DRIFT_CRITICAL"}

Next ==
  /\ step < MAX_STEPS
  /\ step' = step + 1
  /\ pulsarCount' = IF step % 7 = 0 THEN 8 ELSE 6
  /\ sepAngleDeg' = IF step % 15 = 0 THEN 4 ELSE 24
  /\ shapiroDelayMicroSec' = IF sepAngleDeg' < 5 THEN 220 ELSE 109
  /\ xnavKm' = IF pulsarCount' >= 8 THEN 1 ELSE 1
  /\ deltaDorKm' = IF sepAngleDeg' < 5 THEN 1 ELSE 1
  /\ combinedPositionUncertaintyKm' = IF sepAngleDeg' < 5 THEN 2 ELSE 1
  /\ regime' =
      IF combinedPositionUncertaintyKm' > MAX_POSITION_UNCERTAINTY_KM THEN "EPHEMERIS_DRIFT_CRITICAL"
      ELSE IF sepAngleDeg' < 5 THEN "SOLAR_CONJUNCTION_CAUTION"
      ELSE "NOMINAL_DEEP_SPACE_LOCK"

Spec == Init /\ [][Next]_<<step, pulsarCount, sepAngleDeg, shapiroDelayMicroSec, xnavKm, deltaDorKm, combinedPositionUncertaintyKm, regime>>

====
