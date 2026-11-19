--------------------- MODULE AutonomousSentinelDaemon ---------------------
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS MaxTicks, MaxAnomalies, Leases

VARIABLES daemonState, heartbeatTicks, anomaliesDetected, activeLeases, prsGenerated

TypeOK ==
  /\ daemonState \in {"STOPPED", "IDLE", "PROBING", "ANOMALY_TRIAGE", "REMEDIATING"}
  /\ heartbeatTicks \in 0..MaxTicks
  /\ anomaliesDetected \in 0..MaxAnomalies
  /\ activeLeases \subseteq Leases
  /\ prsGenerated \in 0..MaxAnomalies

Init ==
  /\ daemonState = "STOPPED"
  /\ heartbeatTicks = 0
  /\ anomaliesDetected = 0
  /\ activeLeases = {}
  /\ prsGenerated = 0

StartDaemon ==
  /\ daemonState = "STOPPED"
  /\ daemonState' = "IDLE"
  /\ UNCHANGED <<heartbeatTicks, anomaliesDetected, activeLeases, prsGenerated>>

HeartbeatTick ==
  /\ daemonState \in {"IDLE", "REMEDIATING"}
  /\ heartbeatTicks < MaxTicks
  /\ heartbeatTicks' = heartbeatTicks + 1
  /\ daemonState' = "PROBING"
  /\ UNCHANGED <<anomaliesDetected, activeLeases, prsGenerated>>

ProbesClean ==
  /\ daemonState = "PROBING"
  /\ daemonState' = IF activeLeases = {} THEN "IDLE" ELSE "REMEDIATING"
  /\ UNCHANGED <<heartbeatTicks, anomaliesDetected, activeLeases, prsGenerated>>

AnomalyDetected ==
  /\ daemonState = "PROBING"
  /\ anomaliesDetected < MaxAnomalies
  /\ anomaliesDetected' = anomaliesDetected + 1
  /\ daemonState' = "ANOMALY_TRIAGE"
  /\ UNCHANGED <<heartbeatTicks, activeLeases, prsGenerated>>

LeaseRemediation(l) ==
  /\ daemonState = "ANOMALY_TRIAGE"
  /\ l \in Leases \ activeLeases
  /\ activeLeases' = activeLeases \cup {l}
  /\ daemonState' = "REMEDIATING"
  /\ UNCHANGED <<heartbeatTicks, anomaliesDetected, prsGenerated>>

SynthesizePR(l) ==
  /\ daemonState = "REMEDIATING"
  /\ l \in activeLeases
  /\ prsGenerated < anomaliesDetected
  /\ prsGenerated' = prsGenerated + 1
  /\ activeLeases' = activeLeases \ {l}
  /\ daemonState' = IF activeLeases \ {l} = {} THEN "IDLE" ELSE "REMEDIATING"
  /\ UNCHANGED <<heartbeatTicks, anomaliesDetected>>

StopDaemon ==
  /\ daemonState # "STOPPED"
  /\ daemonState' = "STOPPED"
  /\ activeLeases' = {}
  /\ UNCHANGED <<heartbeatTicks, anomaliesDetected, prsGenerated>>

Next ==
  \/ StartDaemon
  \/ HeartbeatTick
  \/ ProbesClean
  \/ AnomalyDetected
  \/ \E l \in Leases: LeaseRemediation(l)
  \/ \E l \in Leases: SynthesizePR(l)
  \/ StopDaemon

(* Invariants *)

LeaseIntegrity ==
  (activeLeases # {}) => (daemonState \in {"REMEDIATING", "PROBING", "ANOMALY_TRIAGE"})

SafetyInvariant ==
  prsGenerated <= anomaliesDetected

Spec == Init /\ [][Next]_<<daemonState, heartbeatTicks, anomaliesDetected, activeLeases, prsGenerated>>

=============================================================================
