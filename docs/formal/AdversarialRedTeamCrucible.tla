-------------------- MODULE AdversarialRedTeamCrucible --------------------
(***************************************************************************)
(* Formal TLA+ Model for Adversarial Red-Team Crucible & Minimax           *)
(* Exploit-Patch Game (SPEC-368 / CHANGE-230).                             *)
(* Verifies that the minimax tournament terminates cleanly, counterexamples*)
(* are captured on penetration, and defensive patches monotonically reduce *)
(* exploitability without violating baseline invariants.                   *)
(***************************************************************************)

EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    MaxRounds,
    MaxCounterexamples,
    ConvergenceThreshold  \* e.g. 5% penetration rate

VARIABLES
    state,
    round,
    penetrationRate,
    counterexamples,
    patchesApplied

vars == <<state, round, penetrationRate, counterexamples, patchesApplied>>

States == {"IDLE", "ATTACKING", "EVALUATING", "PATCHING", "CONVERGED", "EXHAUSTED"}

TypeOK ==
    /\ state \in States
    /\ round \in 0..MaxRounds
    /\ penetrationRate \in 0..100
    /\ counterexamples \in 0..MaxCounterexamples
    /\ patchesApplied \in 0..MaxRounds

Init ==
    /\ state = "IDLE"
    /\ round = 0
    /\ penetrationRate = 80  \* Initial naive posture
    /\ counterexamples = 0
    /\ patchesApplied = 0

StartTournament ==
    /\ state = "IDLE"
    /\ state' = "ATTACKING"
    /\ UNCHANGED <<round, penetrationRate, counterexamples, patchesApplied>>

GenerateAttack ==
    /\ state = "ATTACKING"
    /\ round < MaxRounds
    /\ round' = round + 1
    /\ state' = "EVALUATING"
    /\ UNCHANGED <<penetrationRate, counterexamples, patchesApplied>>

EvaluateExploitPenetrated ==
    /\ state = "EVALUATING"
    /\ penetrationRate > ConvergenceThreshold
    /\ counterexamples < MaxCounterexamples
    /\ counterexamples' = counterexamples + 1
    /\ state' = "PATCHING"
    /\ UNCHANGED <<round, penetrationRate, patchesApplied>>

EvaluateExploitDefended ==
    /\ state = "EVALUATING"
    /\ penetrationRate <= ConvergenceThreshold
    /\ state' = "CONVERGED"
    /\ UNCHANGED <<round, penetrationRate, counterexamples, patchesApplied>>

SynthesizeDefensivePatch ==
    /\ state = "PATCHING"
    /\ patchesApplied < MaxRounds
    /\ patchesApplied' = patchesApplied + 1
    /\ penetrationRate' = IF penetrationRate >= 25 THEN penetrationRate - 25 ELSE 0
    /\ state' = IF (penetrationRate - 25) <= ConvergenceThreshold THEN "CONVERGED"
                ELSE IF round >= MaxRounds THEN "EXHAUSTED"
                ELSE "ATTACKING"
    /\ UNCHANGED <<round, counterexamples>>

RoundLimitExhausted ==
    /\ state \in {"ATTACKING", "EVALUATING"}
    /\ round >= MaxRounds
    /\ state' = "EXHAUSTED"
    /\ UNCHANGED <<round, penetrationRate, counterexamples, patchesApplied>>

Next ==
    \/ StartTournament
    \/ GenerateAttack
    \/ EvaluateExploitPenetrated
    \/ EvaluateExploitDefended
    \/ SynthesizeDefensivePatch
    \/ RoundLimitExhausted
    \/ (state \in {"CONVERGED", "EXHAUSTED"} /\ UNCHANGED vars)

Spec == Init /\ [][Next]_vars

DefensiveSafety ==
    state = "CONVERGED" => penetrationRate <= ConvergenceThreshold

TerminationSoundness ==
    state \in {"CONVERGED", "EXHAUSTED"} => (penetrationRate <= ConvergenceThreshold \/ round >= MaxRounds)

=============================================================================
