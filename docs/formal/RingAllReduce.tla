----------------------- MODULE RingAllReduce -----------------------
(***************************************************************************)
(* Formal TLA+ specification of Ring All-Reduce Distributed Tensor         *)
(* Parallelism & Collective Communication Protocol (NCCL / Baidu style).   *)
(* Verified with Leslie Lamport's TLC Model Checker.                       *)
(***************************************************************************)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS 
    WorkersCount    \* Number of workers P (e.g. 3)

VARIABLES 
    phase,          \* "SCATTER_REDUCE", "ALL_GATHER", or "DONE"
    step,           \* Current step within phase: 1..(WorkersCount - 1)
    buffers         \* buffers[w][c] stores current chunk value for worker w, chunk c

vars == <<phase, step, buffers>>

Workers == 1..WorkersCount
Chunks == 1..WorkersCount

(***************************************************************************)
(* Initial State Predicate: Each worker starts with initial local values   *)
(***************************************************************************)
Init ==
    /\ phase = "SCATTER_REDUCE"
    /\ step = 1
    /\ buffers = [w \in Workers |-> [c \in Chunks |-> w * 10 + c]]

(***************************************************************************)
(* Successor and Predecessor in the circular ring                          *)
(***************************************************************************)
Succ(w) == IF w = WorkersCount THEN 1 ELSE w + 1
Pred(w) == IF w = 1 THEN WorkersCount ELSE w - 1

(***************************************************************************)
(* Scatter-Reduce Step: Workers pass chunks and accumulate element sums    *)
(***************************************************************************)
ScatterReduceStep ==
    /\ phase = "SCATTER_REDUCE"
    /\ step < WorkersCount
    /\ LET 
         \* For each worker w, compute incoming chunk from Pred(w)
         newBuffers == [w \in Workers |-> [c \in Chunks |->
             IF c = ((w - step - 1) % WorkersCount) + 1
             THEN buffers[w][c] + buffers[Pred(w)][c]
             ELSE buffers[w][c]
         ]]
       IN
         /\ buffers' = newBuffers
         /\ IF step + 1 = WorkersCount THEN
               /\ phase' = "ALL_GATHER"
               /\ step' = 1
            ELSE
               /\ phase' = "SCATTER_REDUCE"
               /\ step' = step + 1

(***************************************************************************)
(* All-Gather Step: Workers broadcast reduced chunks around the ring       *)
(***************************************************************************)
AllGatherStep ==
    /\ phase = "ALL_GATHER"
    /\ step < WorkersCount
    /\ LET 
         \* For each worker w, copy reduced chunk from Pred(w)
         newBuffers == [w \in Workers |-> [c \in Chunks |->
             IF c = ((w - step) % WorkersCount) + 1
             THEN buffers[Pred(w)][c]
             ELSE buffers[w][c]
         ]]
       IN
         /\ buffers' = newBuffers
         /\ IF step + 1 = WorkersCount THEN
               /\ phase' = "DONE"
               /\ step' = step + 1
            ELSE
               /\ phase' = "ALL_GATHER"
               /\ step' = step + 1

(***************************************************************************)
(* Termination Stuttering                                                  *)
(***************************************************************************)
DoneStep ==
    /\ phase = "DONE"
    /\ UNCHANGED vars

(***************************************************************************)
(* Next State Relation                                                     *)
(***************************************************************************)
Next ==
    \/ ScatterReduceStep
    \/ AllGatherStep
    \/ DoneStep

Spec == Init /\ [][Next]_vars

(***************************************************************************)
(* INVARIANTS                                                              *)
(***************************************************************************)

\* Step is strictly within 1..WorkersCount
StepBounds ==
    step =< WorkersCount

\* Valid Phase State
PhaseValid ==
    phase \in {"SCATTER_REDUCE", "ALL_GATHER", "DONE"}

\* When DONE, all workers hold completely identical synchronized chunk buffers
GlobalEquivalenceOnDone ==
    phase = "DONE" =>
        \A w1 \in Workers, w2 \in Workers:
            \A c \in Chunks:
                buffers[w1][c] = buffers[w2][c]

=============================================================================
