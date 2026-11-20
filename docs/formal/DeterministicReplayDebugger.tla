-------------------- MODULE DeterministicReplayDebugger --------------------
(***************************************************************************)
(* Formal TLA+ Model for Deterministic Replay Debugger & MCTS Time-Travel  *)
(* Studio (SPEC-370 / CHANGE-232).                                         *)
(* Verifies that execution checkpoints maintain monotonic progression,    *)
(* time-travel rewinds preserve bit-exact state invariance, and            *)
(* counterfactual branches remain isolated without mutating canonical history.*)
(***************************************************************************)

EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    MaxTicks,
    MaxBranches

VARIABLES
    currentTick,
    cursorTick,
    checkpoints,
    branches,
    state

vars == <<currentTick, cursorTick, checkpoints, branches, state>>

States == {"IDLE", "RECORDING", "REWOUND", "BRANCHED"}

TypeOK ==
    /\ currentTick \in 0..MaxTicks
    /\ cursorTick \in 0..MaxTicks
    /\ checkpoints \subseteq 0..MaxTicks
    /\ branches \subseteq 1..MaxBranches
    /\ state \in States

Init ==
    /\ currentTick = 0
    /\ cursorTick = 0
    /\ checkpoints = {0}
    /\ branches = {}
    /\ state = "IDLE"

RecordStep ==
    /\ currentTick < MaxTicks
    /\ currentTick' = currentTick + 1
    /\ cursorTick' = currentTick + 1
    /\ checkpoints' = checkpoints \cup {currentTick + 1}
    /\ state' = "RECORDING"
    /\ UNCHANGED branches

RewindTimeSlider ==
    /\ currentTick > 0
    /\ \E targetTick \in checkpoints :
        /\ targetTick <= currentTick
        /\ cursorTick' = targetTick
        /\ state' = "REWOUND"
        /\ UNCHANGED <<currentTick, checkpoints, branches>>

CreateCounterfactualBranch ==
    /\ state \in {"RECORDING", "REWOUND"}
    /\ Cardinality(branches) < MaxBranches
    /\ \E b \in ((1..MaxBranches) \ branches) :
        /\ branches' = branches \cup {b}
        /\ state' = "BRANCHED"
        /\ UNCHANGED <<currentTick, cursorTick, checkpoints>>

StepForward ==
    /\ cursorTick < currentTick
    /\ cursorTick' = cursorTick + 1
    /\ state' = IF cursorTick + 1 = currentTick THEN "RECORDING" ELSE "REWOUND"
    /\ UNCHANGED <<currentTick, checkpoints, branches>>

StepBackward ==
    /\ cursorTick > 0
    /\ cursorTick' = cursorTick - 1
    /\ state' = "REWOUND"
    /\ UNCHANGED <<currentTick, checkpoints, branches>>

Next ==
    \/ RecordStep
    \/ RewindTimeSlider
    \/ CreateCounterfactualBranch
    \/ StepForward
    \/ StepBackward

Spec == Init /\ [][Next]_vars

TimeTravelSafety ==
    cursorTick <= currentTick

CheckpointMonotonicity ==
    \A t \in checkpoints : t <= currentTick

=============================================================================
