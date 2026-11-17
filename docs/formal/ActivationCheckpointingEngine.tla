---------------- MODULE ActivationCheckpointingEngine ----------------
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    NumLayers,          \* Total layers L (e.g. 4)
    NumSegments,        \* Checkpoint segments M (e.g. 2)
    NumMicroBatches     \* Total micro-batches N (e.g. 2)

ASSUME NumLayers > 0 /\ NumSegments > 0 /\ NumMicroBatches > 0
ASSUME NumLayers % NumSegments = 0

SegmentSize == NumLayers \div NumSegments
Segments == 0..(NumSegments - 1)
Layers == 0..(NumLayers - 1)
MaxActiveActivations == NumSegments + SegmentSize

VARIABLES
    phase,                  \* "FORWARD" | "BACKWARD" | "DONE"
    activeCheckpoints,      \* Set of segment boundary checkpoint indices \subseteq Segments
    recomputedLayers,       \* Set of transiently recomputed layer indices \subseteq Layers
    currentSegment,         \* 0..NumSegments
    activeMicroBatch,       \* 1..NumMicroBatches
    completedBatches,       \* 0..NumMicroBatches
    peakActivationMemory    \* Nat: tracking max activation memory count observed

vars == <<phase, activeCheckpoints, recomputedLayers, currentSegment, activeMicroBatch, completedBatches, peakActivationMemory>>

CurrentMemory == Cardinality(activeCheckpoints) + Cardinality(recomputedLayers)

TypeOK ==
    /\ phase \in {"FORWARD", "BACKWARD", "DONE"}
    /\ activeCheckpoints \subseteq Segments
    /\ recomputedLayers \subseteq Layers
    /\ currentSegment \in 0..NumSegments
    /\ activeMicroBatch \in 1..NumMicroBatches
    /\ completedBatches \in 0..NumMicroBatches
    /\ peakActivationMemory \in 0..MaxActiveActivations

Init ==
    /\ phase = "FORWARD"
    /\ activeCheckpoints = {}
    /\ recomputedLayers = {}
    /\ currentSegment = 0
    /\ activeMicroBatch = 1
    /\ completedBatches = 0
    /\ peakActivationMemory = 0

\* Store segment boundary checkpoint during forward pass
ForwardStep ==
    /\ phase = "FORWARD"
    /\ currentSegment < NumSegments
    /\ LET newCheckpoints == activeCheckpoints \cup {currentSegment}
           newMem == Cardinality(newCheckpoints) + Cardinality(recomputedLayers)
           newPeak == IF newMem > peakActivationMemory THEN newMem ELSE peakActivationMemory
       IN
       /\ activeCheckpoints' = newCheckpoints
       /\ currentSegment' = currentSegment + 1
       /\ peakActivationMemory' = newPeak
       /\ phase' = IF currentSegment + 1 = NumSegments THEN "BACKWARD" ELSE "FORWARD"
       /\ UNCHANGED <<recomputedLayers, activeMicroBatch, completedBatches>>

\* Backward step: Recompute segment layers transiently from boundary checkpoint
RecomputeAndBackwardSegment ==
    /\ phase = "BACKWARD"
    /\ currentSegment > 0
    /\ LET seg == currentSegment - 1
           segLayers == {l \in Layers : l >= seg * SegmentSize /\ l < (seg + 1) * SegmentSize}
           recomputeMem == Cardinality(activeCheckpoints) + Cardinality(segLayers)
           newPeak == IF recomputeMem > peakActivationMemory THEN recomputeMem ELSE peakActivationMemory
       IN
       \* Recompute transiently, calculate gradients, release recomputed layers and checkpoint
       /\ seg \in activeCheckpoints
       /\ activeCheckpoints' = activeCheckpoints \ {seg}
       /\ recomputedLayers' = {}
       /\ currentSegment' = seg
       /\ peakActivationMemory' = newPeak
       /\ IF seg = 0
          THEN /\ IF activeMicroBatch = NumMicroBatches
                  THEN /\ phase' = "DONE"
                       /\ completedBatches' = completedBatches + 1
                       /\ UNCHANGED activeMicroBatch
                  ELSE /\ phase' = "FORWARD"
                       /\ activeMicroBatch' = activeMicroBatch + 1
                       /\ completedBatches' = completedBatches + 1
          ELSE /\ phase' = "BACKWARD"
               /\ UNCHANGED <<activeMicroBatch, completedBatches>>

Next ==
    \/ ForwardStep
    \/ RecomputeAndBackwardSegment

Spec == Init /\ [][Next]_vars

\* --- INVARIANTS ---

\* Peak activation memory is strictly bounded by M + L/M
MemoryCeilingBounded ==
    CurrentMemory =< MaxActiveActivations

\* Zero memory leakage upon completion: heap activation cache is fully purged
ZeroResidualLeakage ==
    (phase = "DONE") => (activeCheckpoints = {} /\ recomputedLayers = {} /\ CurrentMemory = 0)

\* Conservation of micro-batch execution: all micro-batches successfully completed
ConservationOfMicroBatches ==
    (phase = "DONE") => (completedBatches = NumMicroBatches)

=============================================================================
