------------------------------ MODULE LobAlmgrenChrissVpin ------------------------------
EXTENDS Naturals, Integers

VARIABLES
  remainingShares,
  executedShares,
  initialShares,
  bidAskSpreadBps,
  vpinPermille,
  circuitBreakerHalted

Init ==
  /\ remainingShares = 10000
  /\ executedShares = 0
  /\ initialShares = 10000
  /\ bidAskSpreadBps = 2
  /\ vpinPermille = 250
  /\ circuitBreakerHalted = FALSE

StepLiquidateSlice ==
  /\ vpinPermille' \in 100..900
  /\ bidAskSpreadBps' \in 1..25
  /\ circuitBreakerHalted' = (vpinPermille' >= 750)
  /\ IF ~circuitBreakerHalted' /\ remainingShares >= 50
     THEN /\ executedShares' = executedShares + 50
          /\ remainingShares' = remainingShares - 50
     ELSE /\ executedShares' = executedShares
          /\ remainingShares' = remainingShares
  /\ UNCHANGED <<initialShares>>

Next == StepLiquidateSlice

PositiveSpreadBounds ==
  bidAskSpreadBps >= 1 /\ bidAskSpreadBps <= 25

VpinUnitIntervalInvariant ==
  vpinPermille >= 0 /\ vpinPermille <= 1000 /\ (vpinPermille >= 750 => circuitBreakerHalted = TRUE)

OptimalTrajectoryBounds ==
  remainingShares >= 0 /\ executedShares >= 0

InventoryConservationInvariant ==
  remainingShares + executedShares = initialShares

Spec == Init /\ [][Next]_<<remainingShares, executedShares, initialShares, bidAskSpreadBps, vpinPermille, circuitBreakerHalted>>
====
