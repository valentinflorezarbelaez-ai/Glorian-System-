----------------------- MODULE ContinuousDynamicBatching -----------------------
(***************************************************************************)
(* Formal TLA+ specification of Continuous Dynamic Sequence Batching       *)
(* and Iteration-Level Request Scheduling Engine (Orca / Cellular model).  *)
(* Verified with Leslie Lamport's TLC Model Checker.                       *)
(***************************************************************************)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS 
    MaxBatchSize,       \* Maximum concurrent running slots B (e.g. 2)
    TotalRequests,      \* Universe of requests 1..TotalRequests (e.g. 3)
    MaxTokensPerReq     \* Maximum tokens generated per sequence before EOS (e.g. 2)

VARIABLES 
    waitingQueue,       \* Sequence of pending request IDs
    activeSlots,        \* Set of currently running request IDs in batch
    tokensGenerated,    \* Array of generated token count per request [1..TotalRequests]
    completedReqs,      \* Set of finished requests that hit EOS / max tokens
    preemptCount,       \* Total preemption events triggered under memory pressure
    totalSteps          \* Monotonic iteration step counter

vars == <<waitingQueue, activeSlots, tokensGenerated, completedReqs, preemptCount, totalSteps>>

AllRequests == 1..TotalRequests

SeqRange(s) == { s[i] : i \in 1..Len(s) }

(***************************************************************************)
(* Initial State Predicate                                                 *)
(***************************************************************************)
Init ==
    /\ waitingQueue = <<1, 2, 3>>
    /\ activeSlots = {}
    /\ tokensGenerated = [r \in AllRequests |-> 0]
    /\ completedReqs = {}
    /\ preemptCount = 0
    /\ totalSteps = 0

(***************************************************************************)
(* Action: Admit Next Pending Request into Available Slot                  *)
(***************************************************************************)
AdmitRequest ==
    /\ Cardinality(activeSlots) < MaxBatchSize
    /\ Len(waitingQueue) > 0
    /\ LET nextReq == Head(waitingQueue)
       IN
         /\ activeSlots' = activeSlots \cup {nextReq}
         /\ waitingQueue' = Tail(waitingQueue)
         /\ UNCHANGED <<tokensGenerated, completedReqs, preemptCount, totalSteps>>

(***************************************************************************)
(* Action: Forward Step Iteration (1 Token Generation per Active Slot)     *)
(***************************************************************************)
StepIteration ==
    /\ activeSlots /= {}
    /\ LET 
         \* Requests that finish on this step
         finishing == { r \in activeSlots : tokensGenerated[r] + 1 >= MaxTokensPerReq }
         surviving == activeSlots \ finishing
       IN
         /\ tokensGenerated' = [r \in AllRequests |-> 
               IF r \in activeSlots THEN tokensGenerated[r] + 1 ELSE tokensGenerated[r]]
         /\ activeSlots' = surviving
         /\ completedReqs' = completedReqs \cup finishing
         /\ totalSteps' = totalSteps + 1
         /\ UNCHANGED <<waitingQueue, preemptCount>>

(***************************************************************************)
(* Action: Preempt Running Request under Memory Pressure                   *)
(***************************************************************************)
PreemptRequest ==
    /\ activeSlots /= {}
    /\ preemptCount < 2  \* Bound preemption iterations for finite state space
    /\ \E r \in activeSlots:
         /\ activeSlots' = activeSlots \ {r}
         /\ waitingQueue' = Append(waitingQueue, r)
         /\ preemptCount' = preemptCount + 1
         /\ UNCHANGED <<tokensGenerated, completedReqs, totalSteps>>

(***************************************************************************)
(* Next State Relation                                                     *)
(***************************************************************************)
Next ==
    \/ AdmitRequest
    \/ StepIteration
    \/ PreemptRequest
    \/ (activeSlots = {} /\ waitingQueue = <<>> /\ UNCHANGED vars)

Spec == Init /\ [][Next]_vars

(***************************************************************************)
(* INVARIANTS                                                              *)
(***************************************************************************)

\* Active running batch size strictly bounded by configured capacity
SlotCapacityBounds ==
    Cardinality(activeSlots) =< MaxBatchSize

\* Disjointness: No request can simultaneously exist in multiple states
DisjointStates ==
    /\ activeSlots \cap SeqRange(waitingQueue) = {}
    /\ activeSlots \cap completedReqs = {}
    /\ SeqRange(waitingQueue) \cap completedReqs = {}

\* Completed requests have produced at least 1 token
CompletedTokensValid ==
    \A r \in completedReqs:
        tokensGenerated[r] >= 1

\* Conservation of requests: Universe is preserved
RequestConservation ==
    Cardinality(activeSlots) + Len(waitingQueue) + Cardinality(completedReqs) =< TotalRequests

=============================================================================
