---- MODULE HypersonicScramjetAero ----
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS MIN_HYPERSONIC_MACH_X10, MAX_TPS_FLUX_MW_M2, MIN_UNSTART_MARGIN_X100, MAX_STEPS

VARIABLES step, freestreamMachX10, stagnationHeatFluxMwM2, isolatorUnstartMarginX100, specificImpulseSec, regime

Init ==
  /\ step = 0
  /\ freestreamMachX10 = 78
  /\ stagnationHeatFluxMwM2 = 420
  /\ isolatorUnstartMarginX100 = 38
  /\ specificImpulseSec = 1480
  /\ regime = "SUPERSONIC_COMBUSTION_STABLE"

TpsHeatFluxBounds ==
  /\ stagnationHeatFluxMwM2 > 0
  /\ stagnationHeatFluxMwM2 <= MAX_TPS_FLUX_MW_M2

IsolatorUnstartMarginInvariant ==
  /\ isolatorUnstartMarginX100 > MIN_UNSTART_MARGIN_X100
  /\ isolatorUnstartMarginX100 <= 100

HypersonicMachBounds ==
  /\ freestreamMachX10 >= MIN_HYPERSONIC_MACH_X10
  /\ specificImpulseSec > 0
  /\ regime \in {"SUPERSONIC_COMBUSTION_STABLE", "AEROTHERMAL_FLUX_ELEVATED", "ISOLATOR_UNSTART_CRITICAL"}

Next ==
  /\ step < MAX_STEPS
  /\ step' = step + 1
  /\ freestreamMachX10' = IF step % 13 = 0 THEN 85 ELSE 78
  /\ stagnationHeatFluxMwM2' = IF freestreamMachX10' > 80 THEN 620 ELSE 420
  /\ isolatorUnstartMarginX100' = IF step % 13 = 0 THEN 18 ELSE 38
  /\ specificImpulseSec' = IF freestreamMachX10' > 80 THEN 1420 ELSE 1480
  /\ regime' =
      IF isolatorUnstartMarginX100' <= MIN_UNSTART_MARGIN_X100 \/ stagnationHeatFluxMwM2' > MAX_TPS_FLUX_MW_M2 THEN "ISOLATOR_UNSTART_CRITICAL"
      ELSE IF isolatorUnstartMarginX100' <= 22 \/ stagnationHeatFluxMwM2' * 10 > 8 * MAX_TPS_FLUX_MW_M2 THEN "AEROTHERMAL_FLUX_ELEVATED"
      ELSE "SUPERSONIC_COMBUSTION_STABLE"

Spec == Init /\ [][Next]_<<step, freestreamMachX10, stagnationHeatFluxMwM2, isolatorUnstartMarginX100, specificImpulseSec, regime>>

====
