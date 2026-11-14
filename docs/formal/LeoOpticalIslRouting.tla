------------------------------ MODULE LeoOpticalIslRouting ------------------------------
EXTENDS Naturals, Integers

VARIABLES
  activeIslHops,
  qberPercent,
  maxQberPercent,
  qkdSessionSuspended,
  routeConverged

Init ==
  /\ activeIslHops = 3
  /\ qberPercent = 2
  /\ maxQberPercent = 11
  /\ qkdSessionSuspended = FALSE
  /\ routeConverged = TRUE

SwitchOrbitalRelay ==
  /\ activeIslHops' \in 1..12
  /\ qberPercent' \in 1..14
  /\ qkdSessionSuspended' = (qberPercent' >= maxQberPercent)
  /\ routeConverged' = (qkdSessionSuspended' = FALSE)
  /\ UNCHANGED <<maxQberPercent>>

Next ==
  SwitchOrbitalRelay

HopBoundsInvariant ==
  activeIslHops >= 1 /\ activeIslHops <= 12

QkdQberHaltInvariant ==
  qberPercent >= maxQberPercent => qkdSessionSuspended = TRUE

RouteSafetyInvariant ==
  routeConverged = TRUE \/ qkdSessionSuspended = TRUE

Spec == Init /\ [][Next]_<<activeIslHops, qberPercent, maxQberPercent, qkdSessionSuspended, routeConverged>>
====
