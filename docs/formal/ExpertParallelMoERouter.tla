---------------- MODULE ExpertParallelMoERouter ----------------
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    NumTokens,      \* T (e.g. 4)
    NumExperts,     \* E (e.g. 4)
    TopK,           \* K (e.g. 2)
    NumWorkers,     \* P (e.g. 2)
    CapacityLimit   \* C_max (e.g. 2)

VARIABLES
    routerPhase,        \* "INIT" | "ROUTED" | "DISPATCHED" | "EXECUTED" | "COMBINED" | "DONE"
    expertBuffer,       \* Function: e \in Experts -> 0..CapacityLimit
    droppedTokens,      \* Nat: tokens dropped due to expert capacity overflow
    processedTokens,    \* Nat: tokens successfully routed and computed
    dispatchedTokens    \* Nat: tokens transferred across All-to-All collective fabric

Experts == 0..(NumExperts - 1)
TotalSlots == NumTokens * TopK

vars == <<routerPhase, expertBuffer, droppedTokens, processedTokens, dispatchedTokens>>

TypeOK ==
    /\ routerPhase \in {"INIT", "ROUTED", "DISPATCHED", "EXECUTED", "COMBINED", "DONE"}
    /\ DOMAIN expertBuffer = Experts
    /\ \A e \in Experts : expertBuffer[e] \in 0..CapacityLimit
    /\ droppedTokens \in 0..TotalSlots
    /\ processedTokens \in 0..TotalSlots
    /\ dispatchedTokens \in 0..TotalSlots

Init ==
    /\ routerPhase = "INIT"
    /\ expertBuffer = [e \in Experts |-> 0]
    /\ droppedTokens = 0
    /\ processedTokens = 0
    /\ dispatchedTokens = 0

\* Assign token slots to experts respecting capacity limits
RouteTokenSlot(e) ==
    /\ routerPhase = "INIT"
    /\ \E tokensAssigned \in 0..(TotalSlots - 1) :
        LET currentAssigned == [sum \in {0} |-> droppedTokens + (expertBuffer[0] + expertBuffer[1] + expertBuffer[2] + expertBuffer[3])][0]
        IN
        /\ currentAssigned < TotalSlots
        /\ IF expertBuffer[e] < CapacityLimit
           THEN /\ expertBuffer' = [expertBuffer EXCEPT ![e] = expertBuffer[e] + 1]
                /\ UNCHANGED droppedTokens
           ELSE /\ droppedTokens' = droppedTokens + 1
                /\ UNCHANGED expertBuffer
        /\ routerPhase' = IF currentAssigned + 1 = TotalSlots THEN "ROUTED" ELSE "INIT"
        /\ UNCHANGED <<processedTokens, dispatchedTokens>>

\* Phase 1: All-to-All Token Dispatch collective exchange
AllToAllDispatch ==
    /\ routerPhase = "ROUTED"
    /\ dispatchedTokens' = TotalSlots - droppedTokens
    /\ routerPhase' = "DISPATCHED"
    /\ UNCHANGED <<expertBuffer, droppedTokens, processedTokens>>

\* Worker-local expert MLP execution
ExecuteLocalExperts ==
    /\ routerPhase = "DISPATCHED"
    /\ processedTokens' = dispatchedTokens
    /\ expertBuffer' = [e \in Experts |-> 0]
    /\ routerPhase' = "EXECUTED"
    /\ UNCHANGED <<droppedTokens, dispatchedTokens>>

\* Phase 2: All-to-All Token Combine collective exchange
AllToAllCombine ==
    /\ routerPhase = "EXECUTED"
    /\ routerPhase' = "COMBINED"
    /\ UNCHANGED <<expertBuffer, droppedTokens, processedTokens, dispatchedTokens>>

\* Finalize token recombination and step completion
Finalize ==
    /\ routerPhase = "COMBINED"
    /\ routerPhase' = "DONE"
    /\ UNCHANGED <<expertBuffer, droppedTokens, processedTokens, dispatchedTokens>>

Next ==
    \/ \E e \in Experts : RouteTokenSlot(e)
    \/ AllToAllDispatch
    \/ ExecuteLocalExperts
    \/ AllToAllCombine
    \/ Finalize

Spec == Init /\ [][Next]_vars

\* --- INVARIANTS ---

\* Expert capacity bounds: no expert buffer ever exceeds the capacity limit
CapacityBounded ==
    \A e \in Experts : expertBuffer[e] =< CapacityLimit

\* Conservation of token slots: processed tokens + dropped tokens equals T * K
ConservationOfTokens ==
    (routerPhase = "DONE") => (processedTokens + droppedTokens = TotalSlots)

\* Zero buffer leakage: expert buffers are strictly emptied post-execution
ZeroResidualLeakage ==
    (routerPhase \in {"EXECUTED", "COMBINED", "DONE"}) => (\A e \in Experts : expertBuffer[e] = 0)

=============================================================================
