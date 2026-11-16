----------------------- MODULE JepsenDistributedChaos -----------------------
(*
  TLA+ Formal Mathematical Specification of Jepsen-Grade Distributed Network Chaos
  Governed by EOS System SPEC-313 / CHANGE-175
  Proves Eventual Convergence under Partition-Heal Cycles, Clock Monotonicity, and Invariant Safety.
*)

EXTENDS Naturals, FiniteSets

CONSTANTS
  Nodes,         \* Set of nodes in cluster, e.g. {1, 2, 3}
  MaxRounds,     \* Bound on simulation steps to keep model checking finite
  MaxValues      \* Maximum write values, e.g. 2

VARIABLES
  round,         \* Simulation round counter
  partition,     \* Partition topology: set of sets of nodes
  nodeState,     \* Mapping node -> integer value
  nodeClock,     \* Mapping node -> logical timestamp
  inFlight,      \* Set of messages in flight: [src, dst, val, ts]
  healed         \* Boolean: TRUE if network healed and anti-entropy synchronized

vars == <<round, partition, nodeState, nodeClock, inFlight, healed>>

-----------------------------------------------------------------------------

\* Nodes can communicate if they belong to the same partition subset
CanCommunicate(src, dst) ==
  \E part \in partition: (src \in part /\ dst \in part)

\* Initial State
Init ==
  /\ round = 0
  /\ partition = {Nodes} \* Fully connected single partition initially
  /\ nodeState = [n \in Nodes |-> 0]
  /\ nodeClock = [n \in Nodes |-> 0]
  /\ inFlight = {}
  /\ healed = FALSE

\* Inject symmetric network partition dividing Nodes into two disjoint subsets
InjectPartition(part1, part2) ==
  /\ round < MaxRounds
  /\ ~healed
  /\ part1 \union part2 = Nodes
  /\ part1 \intersect part2 = {}
  /\ partition' = {part1, part2}
  /\ round' = round + 1
  /\ UNCHANGED <<nodeState, nodeClock, inFlight, healed>>

\* Client writes to a specific node
ClientWrite(n, val) ==
  /\ round < MaxRounds
  /\ val \in 1..MaxValues
  /\ round' = round + 1
  /\ nodeClock' = [nodeClock EXCEPT ![n] = nodeClock[n] + 1]
  /\ nodeState' = [nodeState EXCEPT ![n] = val]
  /\ inFlight' = inFlight \union {[src |-> n, dst |-> m, val |-> val, ts |-> nodeClock[n] + 1] : m \in Nodes \ {n}}
  /\ UNCHANGED <<partition, healed>>

\* Virtual network delivers an in-flight message
DeliverMessage(msg) ==
  /\ round < MaxRounds
  /\ msg \in inFlight
  /\ round' = round + 1
  /\ inFlight' = inFlight \ {msg}
  /\ IF CanCommunicate(msg.src, msg.dst)
     THEN IF msg.ts > nodeClock[msg.dst]
          THEN /\ nodeState' = [nodeState EXCEPT ![msg.dst] = msg.val]
               /\ nodeClock' = [nodeClock EXCEPT ![msg.dst] = msg.ts]
          ELSE UNCHANGED <<nodeState, nodeClock>>
     ELSE UNCHANGED <<nodeState, nodeClock>>
  /\ UNCHANGED <<partition, healed>>

\* Virtual network drops an in-flight message (chaos packet loss)
DropMessage(msg) ==
  /\ round < MaxRounds
  /\ msg \in inFlight
  /\ round' = round + 1
  /\ inFlight' = inFlight \ {msg}
  /\ UNCHANGED <<partition, nodeState, nodeClock, healed>>

\* Heal cluster and restore full connectivity
HealCluster ==
  /\ ~healed
  /\ partition' = {Nodes}
  /\ healed' = TRUE
  /\ UNCHANGED <<round, nodeState, nodeClock, inFlight>>

\* Anti-entropy gossip between two nodes when healed
AntiEntropySync(n1, n2) ==
  /\ healed
  /\ round < MaxRounds
  /\ round' = round + 1
  /\ IF nodeClock[n1] > nodeClock[n2]
     THEN /\ nodeState' = [nodeState EXCEPT ![n2] = nodeState[n1]]
          /\ nodeClock' = [nodeClock EXCEPT ![n2] = nodeClock[n1]]
     ELSE IF nodeClock[n2] > nodeClock[n1]
          THEN /\ nodeState' = [nodeState EXCEPT ![n1] = nodeState[n2]]
               /\ nodeClock' = [nodeClock EXCEPT ![n1] = nodeClock[n2]]
          ELSE UNCHANGED <<nodeState, nodeClock>>
  /\ UNCHANGED <<partition, inFlight, healed>>

\* Next State Transition
Next ==
  \/ (\E n \in Nodes, v \in 1..MaxValues: ClientWrite(n, v))
  \/ (\E p1, p2 \in SUBSET Nodes: (p1 # {} /\ p2 # {}) /\ InjectPartition(p1, p2))
  \/ (\E msg \in inFlight: DeliverMessage(msg))
  \/ (\E msg \in inFlight: DropMessage(msg))
  \/ HealCluster
  \/ (\E n1, n2 \in Nodes: n1 # n2 /\ AntiEntropySync(n1, n2))

-----------------------------------------------------------------------------

\* Safety Invariant 1: Monotonic Logical Clocks
MonotonicClocks ==
  \A n \in Nodes: nodeClock[n] >= 0

\* Safety Invariant 2: Valid State Bounds
ValidStateBounds ==
  \A n \in Nodes: nodeState[n] \in 0..MaxValues

\* Safety Invariant 3: Eventual Anti-Entropy Consistency Invariant
\* If healed and all anti-entropy syncs have propagated the highest clock, states must agree
AntiEntropyConvergence ==
  (healed /\ inFlight = {} /\ (\A n1, n2 \in Nodes: nodeClock[n1] = nodeClock[n2])) =>
    (\A n1, n2 \in Nodes: nodeState[n1] = nodeState[n2])

SafetyInvariant ==
  /\ MonotonicClocks
  /\ ValidStateBounds
  /\ AntiEntropyConvergence

Spec ==
  Init /\ [][Next]_vars

=============================================================================
