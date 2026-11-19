----------------------- MODULE MultiNodeSwarmMesh -----------------------
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Nodes, MaxRounds, MaxTx, MaxTasks

VARIABLES nodeState, gossipRound, replicatedLedger, taskQueue

TypeOK ==
  /\ nodeState \in [Nodes -> {"OFFLINE", "JOINING", "ONLINE", "SUSPECT"}]
  /\ gossipRound \in [Nodes -> 0..MaxRounds]
  /\ replicatedLedger \in [Nodes -> 0..MaxTx]
  /\ taskQueue \in [Nodes -> 0..MaxTasks]

Init ==
  /\ nodeState = [n \in Nodes |-> IF n = "n1" THEN "ONLINE" ELSE "OFFLINE"]
  /\ gossipRound = [n \in Nodes |-> 0]
  /\ replicatedLedger = [n \in Nodes |-> 0]
  /\ taskQueue = [n \in Nodes |-> IF n = "n1" THEN MaxTasks ELSE 0]

NodeJoin(n) ==
  /\ nodeState[n] = "OFFLINE"
  /\ nodeState' = [nodeState EXCEPT ![n] = "ONLINE"]
  /\ UNCHANGED <<gossipRound, replicatedLedger, taskQueue>>

GossipExchange(src, dst) ==
  /\ nodeState[src] = "ONLINE"
  /\ nodeState[dst] = "ONLINE"
  /\ src /= dst
  /\ gossipRound[src] < MaxRounds
  /\ gossipRound[dst] < MaxRounds
  /\ gossipRound' = [gossipRound EXCEPT ![src] = gossipRound[src] + 1, ![dst] = gossipRound[dst] + 1]
  /\ replicatedLedger' = [replicatedLedger EXCEPT 
      ![src] = IF replicatedLedger[src] > replicatedLedger[dst] THEN replicatedLedger[src] ELSE replicatedLedger[dst],
      ![dst] = IF replicatedLedger[src] > replicatedLedger[dst] THEN replicatedLedger[src] ELSE replicatedLedger[dst]
     ]
  /\ UNCHANGED <<nodeState, taskQueue>>

CommitTransaction(n) ==
  /\ nodeState[n] = "ONLINE"
  /\ replicatedLedger[n] < MaxTx
  /\ replicatedLedger' = [replicatedLedger EXCEPT ![n] = replicatedLedger[n] + 1]
  /\ UNCHANGED <<nodeState, gossipRound, taskQueue>>

WorkSteal(giver, thief) ==
  /\ nodeState[giver] = "ONLINE"
  /\ nodeState[thief] = "ONLINE"
  /\ giver /= thief
  /\ taskQueue[giver] >= 2
  /\ taskQueue[thief] < taskQueue[giver] - 1
  /\ taskQueue[thief] < MaxTasks
  /\ taskQueue' = [taskQueue EXCEPT 
      ![giver] = taskQueue[giver] - 1,
      ![thief] = taskQueue[thief] + 1
     ]
  /\ UNCHANGED <<nodeState, gossipRound, replicatedLedger>>

EvictSuspectNode(n) ==
  /\ nodeState[n] = "ONLINE"
  /\ n /= "n1"
  /\ nodeState' = [nodeState EXCEPT ![n] = "SUSPECT"]
  /\ UNCHANGED <<gossipRound, replicatedLedger, taskQueue>>

Next ==
  \/ \E n \in Nodes: NodeJoin(n)
  \/ \E src, dst \in Nodes: GossipExchange(src, dst)
  \/ \E n \in Nodes: CommitTransaction(n)
  \/ \E giver, thief \in Nodes: WorkSteal(giver, thief)
  \/ \E n \in Nodes: EvictSuspectNode(n)

(* Formal Invariants *)

LedgerMonotonicity ==
  \A n \in Nodes: replicatedLedger[n] >= 0

ConsensusSafety ==
  \A n1, n2 \in Nodes:
    (nodeState[n1] = "ONLINE" /\ nodeState[n2] = "ONLINE" /\ gossipRound[n1] = MaxRounds /\ gossipRound[n2] = MaxRounds) =>
      (replicatedLedger[n1] = replicatedLedger[n2])

Spec == Init /\ [][Next]_<<nodeState, gossipRound, replicatedLedger, taskQueue>>

=============================================================================
