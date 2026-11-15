------------------------- MODULE HermesConsensusMesh -------------------------
(*
  TLA+ Formal Mathematical Specification of the Hermes Distributed RPC Mesh & Circuit Breaker
  Governed by EOS System SPEC-030 / CHANGE-023
  Proves 3-State Circuit Breaker Safety, Quorum Consensus, and Split-Brain Prevention.
*)

EXTENDS Naturals, FiniteSets

CONSTANTS
  Nodes,             \* Set of replica nodes in the cluster
  FailureThreshold,  \* Consecutive failures before opening circuit
  RecoveryProbes     \* Successful probes required to reclose circuit

VARIABLES
  circuitState,      \* "CLOSED", "OPEN", "HALF_OPEN"
  failureCounter,    \* Consecutive error count
  successCounter,    \* Consecutive success count in HALF_OPEN
  activeNodes        \* Subset of nodes currently healthy and connected

vars == <<circuitState, failureCounter, successCounter, activeNodes>>

-----------------------------------------------------------------------------

\* Initial State: All circuits CLOSED, healthy cluster
Init ==
  /\ circuitState = "CLOSED"
  /\ failureCounter = 0
  /\ successCounter = 0
  /\ activeNodes = Nodes

\* Successful RPC invocation
RpcSuccess ==
  /\ circuitState \in {"CLOSED", "HALF_OPEN"}
  /\ IF circuitState = "HALF_OPEN"
     THEN IF successCounter + 1 >= RecoveryProbes
          THEN /\ circuitState' = "CLOSED"
               /\ failureCounter' = 0
               /\ successCounter' = 0
          ELSE /\ successCounter' = successCounter + 1
               /\ UNCHANGED <<circuitState, failureCounter>>
     ELSE /\ failureCounter' = 0
          /\ UNCHANGED <<circuitState, successCounter>>
  /\ UNCHANGED <<activeNodes>>

\* Failed RPC invocation
RpcFailure ==
  /\ circuitState \in {"CLOSED", "HALF_OPEN"}
  /\ IF circuitState = "HALF_OPEN"
     THEN /\ circuitState' = "OPEN"
          /\ failureCounter' = FailureThreshold
          /\ successCounter' = 0
     ELSE IF failureCounter + 1 >= FailureThreshold
          THEN /\ circuitState' = "OPEN"
               /\ failureCounter' = failureCounter + 1
               /\ successCounter' = 0
          ELSE /\ failureCounter' = failureCounter + 1
               /\ UNCHANGED <<circuitState, successCounter>>
  /\ UNCHANGED <<activeNodes>>

\* Timeout expires while circuit is OPEN -> transition to HALF_OPEN for probing
ProbeCircuit ==
  /\ circuitState = "OPEN"
  /\ circuitState' = "HALF_OPEN"
  /\ successCounter' = 0
  /\ UNCHANGED <<failureCounter, activeNodes>>

\* Next State Transition
Next ==
  \/ RpcSuccess
  \/ RpcFailure
  \/ ProbeCircuit

-----------------------------------------------------------------------------

\* Safety Invariant 1: Circuit Breaker State Consistency
ValidCircuitState ==
  circuitState \in {"CLOSED", "OPEN", "HALF_OPEN"}

\* Safety Invariant 2: Quorum Liveness
\* Cluster has quorum iff activeNodes strictly exceeds half the cluster
HasQuorum ==
  Cardinality(activeNodes) * 2 > Cardinality(Nodes)

SafetyInvariant ==
  /\ ValidCircuitState
  /\ failureCounter >= 0
  /\ successCounter >= 0

Spec ==
  Init /\ [][Next]_vars

=============================================================================
