--------------------------- MODULE GithubActionsPrGate ---------------------------
EXTENDS Naturals, Sequences

VARIABLES
    prState,             \* "IDLE", "EVALUATING_7_STAGES", "CHECKING_CONTRACTS", "GATE_PASSED", "GATE_BLOCKED"
    stagesPassed,        \* Nat: count of 7 SecDevOps stages passed
    breakingContractions,\* Nat: count of breaking contract changes detected
    checkRunConclusion,  \* "NONE", "SUCCESS", "FAILURE"
    receiptsIssued       \* Nat: count of SHA-256 receipts sealed

Init ==
    /\ prState = "IDLE"
    /\ stagesPassed = 0
    /\ breakingContractions = 0
    /\ checkRunConclusion = "NONE"
    /\ receiptsIssued = 0

StartPrEvaluation ==
    /\ prState = "IDLE"
    /\ prState' = "EVALUATING_7_STAGES"
    /\ UNCHANGED <<stagesPassed, breakingContractions, checkRunConclusion, receiptsIssued>>

EvaluateStagesPass ==
    /\ prState = "EVALUATING_7_STAGES"
    /\ stagesPassed' = 7
    /\ prState' = "CHECKING_CONTRACTS"
    /\ UNCHANGED <<breakingContractions, checkRunConclusion, receiptsIssued>>

EvaluateStagesFail ==
    /\ prState = "EVALUATING_7_STAGES"
    /\ stagesPassed' = 5
    /\ prState' = "GATE_BLOCKED"
    /\ checkRunConclusion' = "FAILURE"
    /\ receiptsIssued' = receiptsIssued + 1
    /\ UNCHANGED <<breakingContractions>>

ContractCheckPass ==
    /\ prState = "CHECKING_CONTRACTS"
    /\ breakingContractions = 0
    /\ prState' = "GATE_PASSED"
    /\ checkRunConclusion' = "SUCCESS"
    /\ receiptsIssued' = receiptsIssued + 1
    /\ UNCHANGED <<stagesPassed, breakingContractions>>

ContractCheckFail ==
    /\ prState = "CHECKING_CONTRACTS"
    /\ breakingContractions' = breakingContractions + 1
    /\ prState' = "GATE_BLOCKED"
    /\ checkRunConclusion' = "FAILURE"
    /\ receiptsIssued' = receiptsIssued + 1
    /\ UNCHANGED <<stagesPassed>>

ResetPr ==
    /\ prState \in {"GATE_PASSED", "GATE_BLOCKED"}
    /\ prState' = "IDLE"
    /\ stagesPassed' = 0
    /\ breakingContractions' = 0
    /\ checkRunConclusion' = "NONE"
    /\ UNCHANGED <<receiptsIssued>>

Next ==
    \/ StartPrEvaluation
    \/ EvaluateStagesPass
    \/ EvaluateStagesFail
    \/ ContractCheckPass
    \/ ContractCheckFail
    \/ ResetPr

TypeInvariant ==
    /\ prState \in {"IDLE", "EVALUATING_7_STAGES", "CHECKING_CONTRACTS", "GATE_PASSED", "GATE_BLOCKED"}
    /\ stagesPassed >= 0 /\ stagesPassed <= 7
    /\ breakingContractions >= 0
    /\ checkRunConclusion \in {"NONE", "SUCCESS", "FAILURE"}
    /\ receiptsIssued >= 0

SafetyInvariant ==
    /\ (checkRunConclusion = "SUCCESS" => (stagesPassed = 7 /\ breakingContractions = 0))
    /\ (breakingContractions > 0 => checkRunConclusion /= "SUCCESS")

=============================================================================
