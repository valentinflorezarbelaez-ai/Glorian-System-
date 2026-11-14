------------------------------ MODULE UnifiedMemoryDvfsQos ------------------------------
EXTENDS Naturals, Integers

VARIABLES
  clockFreqMhz,
  thermalPowerWatts,
  maxTdpWatts,
  achievedGflops,
  rooflinePeakGflops,
  latencyUs,
  dvfsThrottled

Init ==
  /\ clockFreqMhz = 1800
  /\ thermalPowerWatts = 320
  /\ maxTdpWatts = 500
  /\ achievedGflops = 64000
  /\ rooflinePeakGflops = 90000
  /\ latencyUs = 120
  /\ dvfsThrottled = FALSE

StepDvfsSchedule ==
  /\ thermalPowerWatts' \in 200..540
  /\ dvfsThrottled' = (thermalPowerWatts' > maxTdpWatts)
  /\ clockFreqMhz' = IF dvfsThrottled' THEN 1200 ELSE 1800
  /\ achievedGflops' = IF dvfsThrottled' THEN 42000 ELSE 64000
  /\ latencyUs' = IF dvfsThrottled' THEN 185 ELSE 120
  /\ UNCHANGED <<maxTdpWatts, rooflinePeakGflops>>

Next == StepDvfsSchedule

RooflineBoundInvariant ==
  achievedGflops <= rooflinePeakGflops

FrequencyPositiveBounds ==
  clockFreqMhz >= 1200 /\ clockFreqMhz <= 2400

ThermalPowerBounds ==
  (~dvfsThrottled => thermalPowerWatts <= maxTdpWatts)

LatencyBoundsInvariant ==
  latencyUs > 0 /\ latencyUs <= 500

Spec == Init /\ [][Next]_<<clockFreqMhz, thermalPowerWatts, maxTdpWatts, achievedGflops, rooflinePeakGflops, latencyUs, dvfsThrottled>>
====
