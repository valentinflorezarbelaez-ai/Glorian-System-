----------------------- MODULE FleetChaosFdirEngine -----------------------
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Repos, MaxFaults

VARIABLES repoState, activeFaults, totalHealed

TypeOK ==
  /\ repoState \in [Repos -> {"HEALTHY", "FAULT_INJECTED", "DETECTED", "ISOLATED", "HEALING"}]
  /\ activeFaults \subseteq Repos
  /\ totalHealed \in 0..MaxFaults

Init ==
  /\ repoState = [r \in Repos |-> "HEALTHY"]
  /\ activeFaults = {}
  /\ totalHealed = 0

InjectFault(r) ==
  /\ repoState[r] = "HEALTHY"
  /\ Cardinality(activeFaults) < MaxFaults
  /\ repoState' = [repoState EXCEPT ![r] = "FAULT_INJECTED"]
  /\ activeFaults' = activeFaults \cup {r}
  /\ UNCHANGED <<totalHealed>>

DetectFault(r) ==
  /\ repoState[r] = "FAULT_INJECTED"
  /\ repoState' = [repoState EXCEPT ![r] = "DETECTED"]
  /\ UNCHANGED <<activeFaults, totalHealed>>

IsolateFault(r) ==
  /\ repoState[r] = "DETECTED"
  /\ repoState' = [repoState EXCEPT ![r] = "ISOLATED"]
  /\ UNCHANGED <<activeFaults, totalHealed>>

StartHealing(r) ==
  /\ repoState[r] = "ISOLATED"
  /\ repoState' = [repoState EXCEPT ![r] = "HEALING"]
  /\ UNCHANGED <<activeFaults, totalHealed>>

CompleteHealing(r) ==
  /\ repoState[r] = "HEALING"
  /\ repoState' = [repoState EXCEPT ![r] = "HEALTHY"]
  /\ activeFaults' = activeFaults \ {r}
  /\ totalHealed' = IF totalHealed < MaxFaults THEN totalHealed + 1 ELSE totalHealed
  /\ UNCHANGED <<>>

Next ==
  \/ \E r \in Repos: InjectFault(r)
  \/ \E r \in Repos: DetectFault(r)
  \/ \E r \in Repos: IsolateFault(r)
  \/ \E r \in Repos: StartHealing(r)
  \/ \E r \in Repos: CompleteHealing(r)

(* Invariants *)

FaultBoundedness ==
  Cardinality(activeFaults) <= MaxFaults

HealthConsistency ==
  \A r \in Repos: (repoState[r] = "HEALTHY") => (r \notin activeFaults)

Spec == Init /\ [][Next]_<<repoState, activeFaults, totalHealed>>

=============================================================================
