---------------- MODULE QuantizedDistributedTrainingEngine ----------------
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    MaxSteps,           \* Total training steps (e.g. 3)
    CleanThreshold,     \* Consecutive clean steps before scaling up (e.g. 2)
    MaxLossScale        \* Upper bound on loss scale factor (e.g. 64)

ASSUME MaxSteps > 0 /\ CleanThreshold > 0 /\ MaxLossScale >= 16

Formats == {"E4M3", "E5M2", "INT8"}
GradientStates == {"CLEAN", "OVERFLOW_NAN", "SATURATED"}

VARIABLES
    step,
    lossScale,
    cleanCount,
    scaleFactor,
    activeFormat,
    gradientState,
    weightsUpdated,
    bandwidthBytes

vars == <<step, lossScale, cleanCount, scaleFactor, activeFormat, gradientState, weightsUpdated, bandwidthBytes>>

TypeOK ==
    /\ step \in 0..MaxSteps
    /\ lossScale \in 1..MaxLossScale
    /\ cleanCount \in 0..CleanThreshold
    /\ scaleFactor \in 1..128
    /\ activeFormat \in Formats
    /\ gradientState \in GradientStates
    /\ weightsUpdated \in BOOLEAN
    /\ bandwidthBytes \in {1, 2, 4}

Init ==
    /\ step = 0
    /\ lossScale = 16
    /\ cleanCount = 0
    /\ scaleFactor = 4
    /\ activeFormat = "E4M3"
    /\ gradientState = "CLEAN"
    /\ weightsUpdated = FALSE
    /\ bandwidthBytes = 1

ForwardStep ==
    /\ step < MaxSteps
    /\ activeFormat' = "E4M3"
    /\ bandwidthBytes' = 1
    /\ weightsUpdated' = FALSE
    /\ \E state \in {"CLEAN", "SATURATED"}:
        /\ gradientState' = state
        /\ UNCHANGED <<step, lossScale, cleanCount, scaleFactor>>

BackwardStep ==
    /\ step < MaxSteps
    /\ activeFormat' = "E5M2"
    /\ weightsUpdated' = FALSE
    /\ \E gState \in {"CLEAN", "OVERFLOW_NAN"}:
        /\ gradientState' = gState
        /\ UNCHANGED <<step, lossScale, cleanCount, scaleFactor, bandwidthBytes>>

OptimizerStep ==
    /\ step < MaxSteps
    /\ IF gradientState = "OVERFLOW_NAN"
       THEN
           /\ weightsUpdated' = FALSE
           /\ lossScale' = IF lossScale > 1 THEN lossScale \div 2 ELSE 1
           /\ cleanCount' = 0
           /\ scaleFactor' = scaleFactor
       ELSE
           /\ weightsUpdated' = TRUE
           /\ IF cleanCount + 1 >= CleanThreshold
              THEN
                  /\ lossScale' = IF lossScale * 2 <= MaxLossScale THEN lossScale * 2 ELSE MaxLossScale
                  /\ cleanCount' = 0
              ELSE
                  /\ lossScale' = lossScale
                  /\ cleanCount' = cleanCount + 1
           /\ scaleFactor' = IF gradientState = "SATURATED"
                             THEN (IF scaleFactor > 2 THEN scaleFactor \div 2 ELSE 1)
                             ELSE (IF scaleFactor < 64 THEN scaleFactor + 1 ELSE scaleFactor)
    /\ step' = step + 1
    /\ gradientState' = "CLEAN"
    /\ UNCHANGED <<activeFormat, bandwidthBytes>>

Done ==
    /\ step = MaxSteps
    /\ UNCHANGED vars

Next ==
    \/ ForwardStep
    \/ BackwardStep
    \/ OptimizerStep
    \/ Done

Spec == Init /\ [][Next]_vars

ScaleStability ==
    /\ lossScale >= 1
    /\ lossScale <= MaxLossScale
    /\ scaleFactor >= 1

SaturationRecovery ==
    (gradientState = "OVERFLOW_NAN") => (weightsUpdated = FALSE)

BandwidthReduction ==
    bandwidthBytes = 1

=============================================================================
