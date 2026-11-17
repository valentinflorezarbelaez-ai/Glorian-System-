---------------- MODULE TensorParallelAttention ----------------
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    NumWorkers,     \* P (e.g. 2)
    TotalQHeads,    \* H_Q (e.g. 4)
    TotalKVHeads    \* H_KV (e.g. 2)

VARIABLES
    workerPhase,    \* Function: w \in Workers -> "INIT" | "PROJ_DONE" | "ATTN_DONE" | "REDUCED" | "DONE"
    qHeads,         \* Function: w \in Workers -> Nat (number of Q heads allocated)
    kvHeads,        \* Function: w \in Workers -> Nat (number of KV heads allocated)
    ringStep,       \* Function: w \in Workers -> Nat (current ring shift step, 0..NumWorkers)
    reducedBarrier  \* Nat (0 or 1, tracks All-Reduce barrier)

Workers == 0..(NumWorkers - 1)

vars == <<workerPhase, qHeads, kvHeads, ringStep, reducedBarrier>>

TypeOK ==
    /\ DOMAIN workerPhase = Workers
    /\ DOMAIN qHeads = Workers
    /\ DOMAIN kvHeads = Workers
    /\ DOMAIN ringStep = Workers
    /\ \A w \in Workers : workerPhase[w] \in {"INIT", "PROJ_DONE", "ATTN_DONE", "REDUCED", "DONE"}
    /\ \A w \in Workers : qHeads[w] = (TotalQHeads \div NumWorkers)
    /\ \A w \in Workers : kvHeads[w] = (TotalKVHeads \div NumWorkers)
    /\ \A w \in Workers : ringStep[w] \in 0..NumWorkers
    /\ reducedBarrier \in {0, 1}

Init ==
    /\ workerPhase = [w \in Workers |-> "INIT"]
    /\ qHeads = [w \in Workers |-> TotalQHeads \div NumWorkers]
    /\ kvHeads = [w \in Workers |-> TotalKVHeads \div NumWorkers]
    /\ ringStep = [w \in Workers |-> 0]
    /\ reducedBarrier = 0

\* Column-parallel local projection of Q, K, V
LocalProject(w) ==
    /\ workerPhase[w] = "INIT"
    /\ workerPhase' = [workerPhase EXCEPT ![w] = "PROJ_DONE"]
    /\ UNCHANGED <<qHeads, kvHeads, ringStep, reducedBarrier>>

\* Local attention computation or ring step
LocalAttention(w) ==
    /\ workerPhase[w] = "PROJ_DONE"
    /\ ringStep[w] < NumWorkers
    /\ ringStep' = [ringStep EXCEPT ![w] = ringStep[w] + 1]
    /\ workerPhase' = [workerPhase EXCEPT ![w] = IF ringStep'[w] = NumWorkers THEN "ATTN_DONE" ELSE "PROJ_DONE"]
    /\ UNCHANGED <<qHeads, kvHeads, reducedBarrier>>

\* Row-parallel output projection & single All-Reduce barrier
AllReduceBarrier ==
    /\ \A w \in Workers : workerPhase[w] = "ATTN_DONE"
    /\ reducedBarrier = 0
    /\ reducedBarrier' = 1
    /\ workerPhase' = [w \in Workers |-> "REDUCED"]
    /\ UNCHANGED <<qHeads, kvHeads, ringStep>>

Finalize(w) ==
    /\ workerPhase[w] = "REDUCED"
    /\ workerPhase' = [workerPhase EXCEPT ![w] = "DONE"]
    /\ UNCHANGED <<qHeads, kvHeads, ringStep, reducedBarrier>>

Next ==
    \/ \E w \in Workers : LocalProject(w)
    \/ \E w \in Workers : LocalAttention(w)
    \/ AllReduceBarrier
    \/ \E w \in Workers : Finalize(w)

Spec == Init /\ [][Next]_vars

\* --- INVARIANTS ---

\* Head conservation invariant
HeadConservation ==
    /\ (\A w \in Workers : qHeads[w] * NumWorkers = TotalQHeads)
    /\ (\A w \in Workers : kvHeads[w] * NumWorkers = TotalKVHeads)

\* Efficiency invariant: at most 1 All-Reduce barrier per forward pass
SingleBarrierInvariant ==
    reducedBarrier =< 1

\* Termination safety
CompletionIntegrity ==
    (\A w \in Workers : workerPhase[w] = "DONE") =>
        /\ reducedBarrier = 1
        /\ \A w \in Workers : ringStep[w] = NumWorkers

=============================================================================
