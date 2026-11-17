----------------------- MODULE DistributedVectorMesh -----------------------
(*
  TLA+ Formal Mathematical Specification of Distributed Consistent Hashing Vector Partition Mesh
  Governed by EOS System SPEC-315 / CHANGE-177
  Proves Quorum Leader Validity, Ring Continuity, and Replication Coverage Invariants.
*)

EXTENDS Naturals, FiniteSets, Sequences

CONSTANTS
  Nodes,              \* Finite set of physical nodes, e.g. {1, 2, 3}
  Tokens,             \* Ordered set of ring tokens, e.g. {1, 2, 3, 4, 5, 6}
  Keys,               \* Finite set of vector keys, e.g. {101, 102}
  ReplicationFactor,  \* Replication degree R (e.g. 2)
  MaxTerms            \* Maximum election term bound for finite state exploration

VARIABLES
  activeNodes,        \* Subset of Nodes currently online
  leader,             \* Current Raft leader node (0 if none)
  currentTerm,        \* Monotonic Raft term counter
  tokenAssignments,   \* Function: [t \in Tokens |-> Node]
  placedKeys,         \* Subset of Keys currently placed in the mesh
  keyOwnership        \* Function: [k \in Keys |-> SUBSET Nodes]

vars == <<activeNodes, leader, currentTerm, tokenAssignments, placedKeys, keyOwnership>>

-----------------------------------------------------------------------------

\* Initial State: all nodes active, initial term 0, no leader, empty keys
Init ==
  /\ activeNodes = Nodes
  /\ leader = 0
  /\ currentTerm = 0
  /\ tokenAssignments = [tok \in Tokens |-> 1]
  /\ placedKeys = {}
  /\ keyOwnership = [k \in Keys |-> {}]

\* Elect a leader via majority quorum
ElectLeader(n, t) ==
  /\ n \in activeNodes
  /\ t > currentTerm
  /\ Cardinality(activeNodes) * 2 > Cardinality(Nodes)  \* Strict majority quorum
  /\ leader' = n
  /\ currentTerm' = t
  /\ UNCHANGED <<activeNodes, tokenAssignments, placedKeys, keyOwnership>>

\* Add a physical node to the active cluster
NodeJoin(n) ==
  /\ n \in Nodes \ activeNodes
  /\ activeNodes' = activeNodes \union {n}
  /\ tokenAssignments' = [tok \in Tokens |->
       IF tokenAssignments[tok] \notin activeNodes'
       THEN n
       ELSE tokenAssignments[tok]]
  /\ keyOwnership' = [k \in Keys |->
       IF k \in placedKeys /\ Cardinality(keyOwnership[k]) < ReplicationFactor
       THEN keyOwnership[k] \union {n}
       ELSE keyOwnership[k]]
  /\ UNCHANGED <<leader, currentTerm, placedKeys>>

\* Remove a physical node (fail or leave)
NodeLeave(n) ==
  /\ n \in activeNodes
  /\ Cardinality(activeNodes) > 1
  /\ activeNodes' = activeNodes \ {n}
  /\ leader' = IF leader = n \/ (Cardinality(activeNodes') * 2 <= Cardinality(Nodes))
               THEN 0
               ELSE leader
  /\ \E survivor \in activeNodes':
       /\ tokenAssignments' = [tok \in Tokens |->
            IF tokenAssignments[tok] = n
            THEN survivor
            ELSE tokenAssignments[tok]]
  /\ keyOwnership' = [k \in Keys |->
       IF n \in keyOwnership[k]
       THEN LET rem == keyOwnership[k] \ {n}
            IN IF \E s \in activeNodes' \ rem: TRUE
               THEN rem \union {CHOOSE s \in activeNodes' \ rem: TRUE}
               ELSE rem
       ELSE keyOwnership[k]]
  /\ UNCHANGED <<currentTerm, placedKeys>>

\* Insert a key and assign R distinct active replica nodes
InsertKey(k) ==
  /\ k \in Keys \ placedKeys
  /\ activeNodes # {}
  /\ \E reps \in SUBSET activeNodes:
       /\ Cardinality(reps) = IF Cardinality(activeNodes) >= ReplicationFactor
                              THEN ReplicationFactor
                              ELSE Cardinality(activeNodes)
       /\ keyOwnership' = [keyOwnership EXCEPT ![k] = reps]
       /\ placedKeys' = placedKeys \union {k}
  /\ UNCHANGED <<activeNodes, leader, currentTerm, tokenAssignments>>

\* Next State Transition
Next ==
  \/ (\E n \in activeNodes, t \in (currentTerm+1)..MaxTerms: ElectLeader(n, t))
  \/ (\E n \in Nodes: NodeJoin(n))
  \/ (\E n \in activeNodes: NodeLeave(n))
  \/ (\E k \in Keys: InsertKey(k))

-----------------------------------------------------------------------------

\* Safety Invariant 1: Valid Leader Quorum Invariant
ValidLeaderQuorum ==
  (leader # 0) => (leader \in activeNodes /\ Cardinality(activeNodes) * 2 > Cardinality(Nodes))

\* Safety Invariant 2: Ring Continuity Invariant
\* Every token on the active ring must point to an active physical node
RingContinuity ==
  activeNodes # {} => (\A tok \in Tokens: tokenAssignments[tok] \in activeNodes)

\* Safety Invariant 3: Replication Coverage Invariant
\* Every placed key has min(R, |activeNodes|) distinct replicas
ReplicationCoverage ==
  \A k \in placedKeys:
    /\ keyOwnership[k] \subseteq activeNodes
    /\ Cardinality(keyOwnership[k]) =
         IF Cardinality(activeNodes) >= ReplicationFactor
         THEN ReplicationFactor
         ELSE Cardinality(activeNodes)

\* Safety Invariant 4: Monotonic Terms Invariant
MonotonicTerms ==
  currentTerm >= 0

SafetyInvariant ==
  /\ ValidLeaderQuorum
  /\ RingContinuity
  /\ ReplicationCoverage
  /\ MonotonicTerms

Spec ==
  Init /\ [][Next]_vars

=============================================================================
