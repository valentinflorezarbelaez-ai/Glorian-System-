------------------------- MODULE AgentSwarmMicroKernel -------------------------
EXTENDS Naturals, FiniteSets

CONSTANTS NodeCount, MaxTerm

Node == 1..NodeCount
Quorum == (NodeCount \div 2) + 1
Roles == {"FOLLOWER", "CANDIDATE", "LEADER"}

VARIABLES
  currentTerm,
  role,
  votedFor,
  votesGranted

vars == <<currentTerm, role, votedFor, votesGranted>>

Init ==
  /\ currentTerm = [n \in Node |-> 0]
  /\ role = [n \in Node |-> "FOLLOWER"]
  /\ votedFor = [n \in Node |-> 0]
  /\ votesGranted = [n \in Node |-> {}]

Timeout(i) ==
  /\ currentTerm[i] < MaxTerm
  /\ role[i] \in {"FOLLOWER", "CANDIDATE"}
  /\ currentTerm' = [currentTerm EXCEPT ![i] = currentTerm[i] + 1]
  /\ role' = [role EXCEPT ![i] = "CANDIDATE"]
  /\ votedFor' = [votedFor EXCEPT ![i] = i]
  /\ votesGranted' = [votesGranted EXCEPT ![i] = {i}]

RequestVote(i, j) ==
  /\ i # j
  /\ role[i] = "CANDIDATE"
  /\ currentTerm[i] >= currentTerm[j]
  /\ (votedFor[j] = 0 \/ votedFor[j] = i)
  /\ votedFor' = [votedFor EXCEPT ![j] = i]
  /\ currentTerm' = [currentTerm EXCEPT ![j] = currentTerm[i]]
  /\ votesGranted' = [votesGranted EXCEPT ![i] = votesGranted[i] \cup {j}]
  /\ UNCHANGED <<role>>

BecomeLeader(i) ==
  /\ role[i] = "CANDIDATE"
  /\ Cardinality(votesGranted[i]) >= Quorum
  /\ role' = [role EXCEPT ![i] = "LEADER"]
  /\ UNCHANGED <<currentTerm, votedFor, votesGranted>>

StepDown(i, higherTerm) ==
  /\ higherTerm > currentTerm[i]
  /\ higherTerm <= MaxTerm
  /\ currentTerm' = [currentTerm EXCEPT ![i] = higherTerm]
  /\ role' = [role EXCEPT ![i] = "FOLLOWER"]
  /\ votedFor' = [votedFor EXCEPT ![i] = 0]
  /\ votesGranted' = [votesGranted EXCEPT ![i] = {}]

Next ==
  \/ \E i \in Node: Timeout(i)
  \/ \E i, j \in Node: RequestVote(i, j)
  \/ \E i \in Node: BecomeLeader(i)
  \/ \E i \in Node, t \in 1..MaxTerm: StepDown(i, t)

TypeOK ==
  /\ currentTerm \in [Node -> 0..MaxTerm]
  /\ role \in [Node -> Roles]
  /\ votedFor \in [Node -> (Node \cup {0})]
  /\ votesGranted \in [Node -> SUBSET Node]

ElectionSafety ==
  \A i, j \in Node:
    (role[i] = "LEADER" /\ role[j] = "LEADER" /\ currentTerm[i] = currentTerm[j]) => (i = j)

=============================================================================
