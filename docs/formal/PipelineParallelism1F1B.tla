---------------- MODULE PipelineParallelism1F1B ----------------
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    NumStages,          \* Number of pipeline stages P, e.g. 3
    NumMicroBatches     \* Total micro-batches M, e.g. 4

VARIABLES
    fwdCount,           \* Function: p \in Stages -> Nat (completed forward passes)
    bwdCount,           \* Function: p \in Stages -> Nat (completed backward passes)
    activeActivations   \* Function: p \in Stages -> Nat (in-flight stashed activations)

Stages == 0..(NumStages - 1)

vars == <<fwdCount, bwdCount, activeActivations>>

TypeOK ==
    /\ DOMAIN fwdCount = Stages
    /\ DOMAIN bwdCount = Stages
    /\ DOMAIN activeActivations = Stages
    /\ \A p \in Stages : fwdCount[p] \in 0..NumMicroBatches
    /\ \A p \in Stages : bwdCount[p] \in 0..NumMicroBatches
    /\ \A p \in Stages : activeActivations[p] \in 0..NumStages

Init ==
    /\ fwdCount = [p \in Stages |-> 0]
    /\ bwdCount = [p \in Stages |-> 0]
    /\ activeActivations = [p \in Stages |-> 0]

\* Forward step on stage p
ForwardStep(p) ==
    /\ fwdCount[p] < NumMicroBatches
    /\ (IF p = 0 THEN TRUE ELSE fwdCount[p] < fwdCount[p - 1])
    /\ activeActivations[p] < NumStages
    /\ fwdCount' = [fwdCount EXCEPT ![p] = fwdCount[p] + 1]
    /\ activeActivations' = [activeActivations EXCEPT ![p] = activeActivations[p] + 1]
    /\ UNCHANGED <<bwdCount>>

\* Backward step on stage p
BackwardStep(p) ==
    /\ bwdCount[p] < fwdCount[p]
    /\ (IF p = NumStages - 1 THEN TRUE ELSE bwdCount[p] < bwdCount[p + 1])
    /\ bwdCount' = [bwdCount EXCEPT ![p] = bwdCount[p] + 1]
    /\ activeActivations' = [activeActivations EXCEPT ![p] = activeActivations[p] - 1]
    /\ UNCHANGED <<fwdCount>>

Next ==
    \/ \E p \in Stages : ForwardStep(p)
    \/ \E p \in Stages : BackwardStep(p)

Spec == Init /\ [][Next]_vars

\* --- INVARIANTS ---

\* 1F1B Core Invariant: Peak activation memory on any stage is strictly <= P
PeakActivationMemoryBounded ==
    \A p \in Stages : activeActivations[p] =< NumStages

\* Topological ordering invariants
TopologicalOrder ==
    /\ \A p \in 1..(NumStages - 1) : fwdCount[p] =< fwdCount[p - 1]
    /\ \A p \in 0..(NumStages - 2) : bwdCount[p] =< bwdCount[p + 1]
    /\ \A p \in Stages : bwdCount[p] =< fwdCount[p]

\* Zero memory leakage upon completion
ZeroLeakageOnDone ==
    (\A p \in Stages : bwdCount[p] = NumMicroBatches) =>
        (\A p \in Stages : activeActivations[p] = 0)

=============================================================================
