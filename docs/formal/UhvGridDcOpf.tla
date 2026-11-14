------------------------------ MODULE UhvGridDcOpf ------------------------------
EXTENDS Naturals, Integers

VARIABLES
  totalDemandMw,
  dispatchedMw,
  frequencyMillihz,
  loadShedActive,
  corridorOverloaded

Init ==
  /\ totalDemandMw = 12000
  /\ dispatchedMw = 12000
  /\ frequencyMillihz = 60000
  /\ loadShedActive = FALSE
  /\ corridorOverloaded = FALSE

DispatchOrShedStep ==
  /\ totalDemandMw' \in 8000..18000
  /\ corridorOverloaded' = (totalDemandMw' > 15000)
  /\ loadShedActive' = corridorOverloaded'
  /\ dispatchedMw' = IF loadShedActive' THEN 15000 ELSE totalDemandMw'
  /\ frequencyMillihz' = IF loadShedActive' THEN 59850 ELSE 60000

Next ==
  DispatchOrShedStep

PowerBalanceInvariant ==
  dispatchedMw = totalDemandMw \/ loadShedActive = TRUE

FrequencyStabilityBounds ==
  frequencyMillihz >= 59500 /\ frequencyMillihz <= 60500

ThermalCorridorSafetyInvariant ==
  corridorOverloaded = TRUE => loadShedActive = TRUE

Spec == Init /\ [][Next]_<<totalDemandMw, dispatchedMw, frequencyMillihz, loadShedActive, corridorOverloaded>>
====
