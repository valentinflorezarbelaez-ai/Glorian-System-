----------------------- MODULE EpisodicMemoryGraph -----------------------
(***************************************************************************)
(* Formal TLA+ Model for Episodic Memory Graph & Cross-Project Experience  *)
(* Synapse (SPEC-369 / CHANGE-231).                                        *)
(* Verifies that episode ingestion, synaptic edge formation, temporal      *)
(* decay, and bounded capacity pruning preserve graph integrity and never  *)
(* leave orphaned or dangling edges.                                       *)
(***************************************************************************)

EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    MaxNodes,
    MaxWeight,
    CapacityThreshold

VARIABLES
    nodes,
    edges,
    weights,
    state

vars == <<nodes, edges, weights, state>>

States == {"IDLE", "INGESTING", "QUERYING", "DECAYING", "PRUNING"}

TypeOK ==
    /\ nodes \subseteq 1..MaxNodes
    /\ edges \subseteq ((1..MaxNodes) \X (1..MaxNodes))
    /\ weights \in [1..MaxNodes -> 0..MaxWeight]
    /\ state \in States

Init ==
    /\ nodes = {}
    /\ edges = {}
    /\ weights = [n \in 1..MaxNodes |-> 0]
    /\ state = "IDLE"

IngestEpisode ==
    /\ state = "IDLE"
    /\ Cardinality(nodes) < MaxNodes
    /\ \E n \in ((1..MaxNodes) \ nodes) :
        /\ nodes' = nodes \cup {n}
        /\ weights' = [weights EXCEPT ![n] = MaxWeight]
        /\ (\E existing \in nodes : edges' = edges \cup {<<existing, n>>})
           \/ (nodes = {} /\ edges' = edges)
        /\ state' = "IDLE"

QueryAndReinforce ==
    /\ state = "IDLE"
    /\ nodes /= {}
    /\ \E n \in nodes :
        /\ weights' = [weights EXCEPT ![n] = IF weights[n] + 1 <= MaxWeight THEN weights[n] + 1 ELSE MaxWeight]
        /\ UNCHANGED <<nodes, edges>>
        /\ state' = "IDLE"

TemporalDecay ==
    /\ state = "IDLE"
    /\ nodes /= {}
    /\ weights' = [n \in 1..MaxNodes |-> IF n \in nodes /\ weights[n] > 0 THEN weights[n] - 1 ELSE weights[n]]
    /\ UNCHANGED <<nodes, edges>>
    /\ state' = "IDLE"

PruneColdNodes ==
    /\ state = "IDLE"
    /\ Cardinality(nodes) >= CapacityThreshold
    /\ \E n \in nodes :
        /\ weights[n] <= 1
        /\ nodes' = nodes \ {n}
        /\ edges' = {e \in edges : e[1] /= n /\ e[2] /= n}
        /\ weights' = [weights EXCEPT ![n] = 0]
        /\ state' = "IDLE"

Next ==
    \/ IngestEpisode
    \/ QueryAndReinforce
    \/ TemporalDecay
    \/ PruneColdNodes

Spec == Init /\ [][Next]_vars

GraphIntegrity ==
    \A e \in edges : e[1] \in nodes /\ e[2] \in nodes

BoundedCapacity ==
    Cardinality(nodes) <= MaxNodes

=============================================================================
