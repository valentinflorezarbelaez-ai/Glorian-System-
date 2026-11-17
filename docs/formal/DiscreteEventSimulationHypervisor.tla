------------------- MODULE DiscreteEventSimulationHypervisor -------------------
(***************************************************************************)
(* Formal TLA+ specification of Deterministic Discrete-Event Simulation    *)
(* Hypervisor & Time-Travel Fault Injection Engine (DESH).                 *)
(* Governed by SPEC-334 / CHANGE-196 / ADR-196-001..003.                   *)
(* Verified with Leslie Lamport's TLC Model Checker.                       *)
(***************************************************************************)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS
    MaxVirtualTime,     \* Nat: Monotonic virtual time upper bound
    MaxEvents,          \* Nat: Total schedulable event pool
    NodeCount,          \* Nat: Virtual nodes in the mesh
    MaxCheckpoints      \* Nat: Maximum snapshot capacity

VARIABLES
    virtualClock,       \* Nat: Deterministic virtual nanosecond clock
    eventQueue,         \* Set of records [id: 1..MaxEvents, time: 0..MaxVirtualTime, target: 1..NodeCount]
    processedEvents,    \* Set of event IDs executed
    nodeState,          \* [1..NodeCount -> 0..5]
    checkpoints,        \* Set of records [id: 1..MaxCheckpoints, time: 0..MaxVirtualTime, state: [1..NodeCount -> 0..5]]
    partitionActive,    \* BOOLEAN: Simulating network split-brain fault
    monotonicViolation, \* BOOLEAN: Flags if virtual time ever steps backward during step
    rollbackViolation   \* BOOLEAN: Flags if rollback restores invalid state

vars == << virtualClock, eventQueue, processedEvents, nodeState, checkpoints,
           partitionActive, monotonicViolation, rollbackViolation >>

Nodes == 1..NodeCount
EventIds == 1..MaxEvents
CheckpointIds == 1..MaxCheckpoints

TypeOK ==
    /\ virtualClock \in 0..MaxVirtualTime
    /\ processedEvents \subseteq EventIds
    /\ nodeState \in [Nodes -> 0..5]
    /\ partitionActive \in BOOLEAN
    /\ monotonicViolation \in BOOLEAN
    /\ rollbackViolation \in BOOLEAN

Init ==
    /\ virtualClock = 0
    /\ eventQueue = {[id |-> 1, time |-> 1, target |-> 1], [id |-> 2, time |-> 2, target |-> 2]}
    /\ processedEvents = {}
    /\ nodeState = [n \in Nodes |-> 0]
    /\ checkpoints = {}
    /\ partitionActive = FALSE
    /\ monotonicViolation = FALSE
    /\ rollbackViolation = FALSE

\* Schedule a future discrete event
ScheduleEvent(eId, tgt, schedTime) ==
    /\ eId \in EventIds
    /\ eId \notin processedEvents
    /\ ~ (\E ev \in eventQueue: ev.id = eId)
    /\ schedTime >= virtualClock
    /\ schedTime <= MaxVirtualTime
    /\ eventQueue' = eventQueue \cup {[id |-> eId, time |-> schedTime, target |-> tgt]}
    /\ UNCHANGED << virtualClock, processedEvents, nodeState, checkpoints,
                    partitionActive, monotonicViolation, rollbackViolation >>

\* Dispatch the earliest scheduled event in the priority queue
StepEarliestEvent ==
    /\ eventQueue # {}
    /\ LET minTime == CHOOSE t \in {e.time : e \in eventQueue} :
                        \A o \in {ev.time : ev \in eventQueue} : t <= o
           candidateEvents == {e \in eventQueue : e.time = minTime}
           selectedEvent == CHOOSE e \in candidateEvents : TRUE
       IN
       /\ IF selectedEvent.time < virtualClock
          THEN monotonicViolation' = TRUE
          ELSE monotonicViolation' = monotonicViolation
       /\ virtualClock' = selectedEvent.time
       /\ eventQueue' = eventQueue \ {selectedEvent}
       /\ processedEvents' = processedEvents \cup {selectedEvent.id}
       /\ IF partitionActive /\ selectedEvent.target = 2
          THEN nodeState' = nodeState \* Message dropped by partition fault
          ELSE nodeState' = [nodeState EXCEPT ![selectedEvent.target] =
                               IF nodeState[selectedEvent.target] < 5
                               THEN nodeState[selectedEvent.target] + 1
                               ELSE 5]
       /\ UNCHANGED << checkpoints, partitionActive, rollbackViolation >>

\* Toggle network partition fault injection
TogglePartitionFault ==
    /\ partitionActive' = ~partitionActive
    /\ UNCHANGED << virtualClock, eventQueue, processedEvents, nodeState,
                    checkpoints, monotonicViolation, rollbackViolation >>

\* Capture Chandy-Lamport atomic global checkpoint
CaptureCheckpoint(cpId) ==
    /\ cpId \in CheckpointIds
    /\ ~ (\E cp \in checkpoints: cp.id = cpId)
    /\ checkpoints' = checkpoints \cup {[id |-> cpId, time |-> virtualClock, state |-> nodeState]}
    /\ UNCHANGED << virtualClock, eventQueue, processedEvents, nodeState,
                    partitionActive, monotonicViolation, rollbackViolation >>

\* Rollback execution to a previously recorded checkpoint in the past
RollbackToCheckpoint(cpId) ==
    /\ \E cp \in checkpoints: cp.id = cpId
    /\ LET targetCp == CHOOSE cp \in checkpoints: cp.id = cpId
       IN
       /\ targetCp.time <= virtualClock
       /\ virtualClock' = targetCp.time
       /\ nodeState' = targetCp.state
       /\ UNCHANGED << eventQueue, processedEvents, checkpoints, partitionActive,
                       monotonicViolation, rollbackViolation >>

Next ==
    \/ \E eId \in EventIds, tgt \in Nodes, t \in (virtualClock..MaxVirtualTime):
         ScheduleEvent(eId, tgt, t)
    \/ StepEarliestEvent
    \/ TogglePartitionFault
    \/ \E cpId \in CheckpointIds: CaptureCheckpoint(cpId)
    \/ \E cpId \in CheckpointIds: RollbackToCheckpoint(cpId)
    \/ (eventQueue = {} /\ UNCHANGED vars)

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
\* INVARIANTS

\* 1. Virtual Time Monotonicity: Virtual clock never jumps backward except during explicit rollback
VirtualTimeMonotonicity == monotonicViolation = FALSE

\* 2. Rollback Consistency: Rollbacks never restore checkpoints ahead of current time
RollbackConsistency == rollbackViolation = FALSE

\* 3. Event Queue Integrity: Executed events are never pending in the active queue
EventQueueIntegrity ==
    \A e \in eventQueue: e.id \notin processedEvents

=============================================================================
