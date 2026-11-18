------------------- MODULE AgenticHarnessYield -------------------
(***************************************************************************)
(* Formal TLA+ specification of Agentic Harness Engineering,               *)
(* Spec-Driven Readiness Gate & First-Pass PR Yield Telemetry             *)
(* (SPEC-339 / CHANGE-201 / ADR-201-001..003).                             *)
(* Verified with Leslie Lamport's TLC Model Checker.                       *)
(***************************************************************************)

EXTENDS Integers, FiniteSets

CONSTANTS
    MaxRetries,     \* Nat: maximum bounded self-repair retries (e.g. 2)
    TotalStages,    \* Nat: ordered validation harness stages (e.g. 3)
    MinSpecScore    \* Nat: minimum SDD readiness threshold (e.g. 80)

VARIABLES
    specScore,          \* 0..100: readiness score
    specApproved,       \* BOOLEAN: whether SDD readiness gate passed
    currentStage,       \* 0..TotalStages: stages completed cleanly
    retriesUsed,        \* 0..MaxRetries: repair retries consumed
    tokensSpent,        \* Nat: cumulative tokens consumed (first-pass + rework)
    firstPassTokens,    \* Nat: cumulative first-pass tokens
    status              \* "PENDING" | "IN_HARNESS" | "PR_READY" | "HALTED_RETRY_LIMIT"

vars == << specScore, specApproved, currentStage, retriesUsed,
           tokensSpent, firstPassTokens, status >>

Statuses == {"PENDING", "IN_HARNESS", "PR_READY", "HALTED_RETRY_LIMIT"}
MaxTokens == TotalStages + MaxRetries * 2

TypeOK ==
    /\ specScore \in 0..100
    /\ specApproved \in BOOLEAN
    /\ currentStage \in 0..TotalStages
    /\ retriesUsed \in 0..MaxRetries
    /\ firstPassTokens \in 0..TotalStages
    /\ tokensSpent \in 0..MaxTokens
    /\ status \in Statuses

Init ==
    /\ specScore = 60
    /\ specApproved = FALSE
    /\ currentStage = 0
    /\ retriesUsed = 0
    /\ tokensSpent = 0
    /\ firstPassTokens = 0
    /\ status = "PENDING"

\* Gate step: SDD readiness must reach MinSpecScore before harness execution starts
ApproveSpec(score) ==
    /\ status = "PENDING"
    /\ ~specApproved
    /\ score >= MinSpecScore
    /\ score <= 100
    /\ specScore' = score
    /\ specApproved' = TRUE
    /\ status' = "IN_HARNESS"
    /\ UNCHANGED << currentStage, retriesUsed, tokensSpent, firstPassTokens >>

\* Clean stage pass advances stage counter and records matching first-pass & total tokens
PassStage ==
    /\ status = "IN_HARNESS"
    /\ specApproved
    /\ currentStage < TotalStages
    /\ currentStage' = currentStage + 1
    /\ firstPassTokens' = firstPassTokens + 1
    /\ tokensSpent' = tokensSpent + 1
    /\ UNCHANGED << specScore, specApproved, retriesUsed, status >>

\* Stage failure consumes retry budget and rework tokens, or halts at budget ceiling
FailAndRepairStage ==
    /\ status = "IN_HARNESS"
    /\ specApproved
    /\ currentStage < TotalStages
    /\ IF retriesUsed < MaxRetries
       THEN /\ retriesUsed' = retriesUsed + 1
            /\ tokensSpent' = tokensSpent + 2
            /\ UNCHANGED << specScore, specApproved, currentStage, firstPassTokens, status >>
       ELSE /\ status' = "HALTED_RETRY_LIMIT"
            /\ UNCHANGED << specScore, specApproved, currentStage, retriesUsed, tokensSpent, firstPassTokens >>

\* Promote PR only after passing all harness validation stages
PromoteToPr ==
    /\ status = "IN_HARNESS"
    /\ specApproved
    /\ currentStage = TotalStages
    /\ status' = "PR_READY"
    /\ UNCHANGED << specScore, specApproved, currentStage, retriesUsed, tokensSpent, firstPassTokens >>

Done == status \in {"PR_READY", "HALTED_RETRY_LIMIT"} /\ UNCHANGED vars

Next ==
    \/ \E score \in {85, 95} : ApproveSpec(score)
    \/ PassStage
    \/ FailAndRepairStage
    \/ PromoteToPr
    \/ Done

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
\* INVARIANTS

\* 1. No Code Validation Without Spec Approval: stages advance only after specApproved = TRUE.
NoCodeWithoutSpecApproval == currentStage > 0 => specApproved

\* 2. Bounded Self-Repair Budget: retriesUsed never exceeds MaxRetries.
RetryBudgetBounded == retriesUsed <= MaxRetries

\* 3. PR Readiness Gate: PR_READY implies SDD approval and completion of all stages.
PrReadyRequiresAllStages ==
    (status = "PR_READY") => (specApproved /\ currentStage = TotalStages)

\* 4. Rework Token Accounting Monotonicity: cumulative spend >= first-pass baseline.
ReworkTokensMonotonic == tokensSpent >= firstPassTokens

=============================================================================
