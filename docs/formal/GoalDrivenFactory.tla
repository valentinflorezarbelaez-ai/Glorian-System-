---------------- MODULE GoalDrivenFactory ----------------
EXTENDS Integers

CONSTANTS
    MaxAttempts,             \* Maximum retry attempts per goal loop (e.g. 3)
    MaxCostUnits             \* Maximum cost budget per task (e.g. 6)

VARIABLES
    goalValid,               \* BOOLEAN: measurable output threshold + command + caps
    verifierTampered,        \* BOOLEAN: protected test/workflow/spec mutated or digest drifted
    attempts,                \* 0..MaxAttempts
    costUnits,               \* 0..MaxCostUnits
    testsPassed,             \* BOOLEAN: mandatory unit + E2E tests executed and passing
    reviewerIndependent,     \* BOOLEAN: adversarial reviewer != implementer agent
    criticalFindings,        \* {0, 1}
    warningFindings,         \* {0, 1, 2} (non-blocking advisories)
    worktreesDisjoint,       \* BOOLEAN: parallel factory worktrees/edit surfaces disjoint
    prGateVerdict            \* Verdict state

vars == <<goalValid, verifierTampered, attempts, costUnits, testsPassed, reviewerIndependent, criticalFindings, warningFindings, worktreesDisjoint, prGateVerdict>>

TypeOK ==
    /\ goalValid \in BOOLEAN
    /\ verifierTampered \in BOOLEAN
    /\ attempts \in 0..MaxAttempts
    /\ costUnits \in 0..MaxCostUnits
    /\ testsPassed \in BOOLEAN
    /\ reviewerIndependent \in BOOLEAN
    /\ criticalFindings \in {0, 1}
    /\ warningFindings \in {0, 1, 2}
    /\ worktreesDisjoint \in BOOLEAN
    /\ prGateVerdict \in {"PENDING", "READY_FOR_PR", "BLOCKED_VAGUE_GOAL", "BLOCKED_VERIFIER_TAMPER", "HALTED_BUDGET", "BLOCKED_PRE_PR_GATES"}

Init ==
    /\ goalValid = FALSE
    /\ verifierTampered = FALSE
    /\ attempts = 0
    /\ costUnits = 0
    /\ testsPassed = FALSE
    /\ reviewerIndependent = FALSE
    /\ criticalFindings = 0
    /\ warningFindings = 0
    /\ worktreesDisjoint = TRUE
    /\ prGateVerdict = "PENDING"

ValidateGoal(valid) ==
    /\ valid \in BOOLEAN
    /\ goalValid' = valid
    /\ prGateVerdict' = IF valid THEN "PENDING" ELSE "BLOCKED_VAGUE_GOAL"
    /\ UNCHANGED <<verifierTampered, attempts, costUnits, testsPassed, reviewerIndependent, criticalFindings, warningFindings, worktreesDisjoint>>

ExecuteAttempt(tamper, costDelta, pass) ==
    /\ goalValid
    /\ ~verifierTampered
    /\ attempts < MaxAttempts
    /\ tamper \in BOOLEAN
    /\ costDelta \in {1, 2}
    /\ pass \in BOOLEAN
    /\ verifierTampered' = tamper
    /\ attempts' = attempts + 1
    /\ costUnits' = IF costUnits + costDelta > MaxCostUnits THEN MaxCostUnits ELSE costUnits + costDelta
    /\ testsPassed' = IF tamper \/ (costUnits + costDelta > MaxCostUnits) THEN FALSE ELSE pass
    /\ prGateVerdict' =
        IF tamper THEN "BLOCKED_VERIFIER_TAMPER"
        ELSE IF (costUnits + costDelta > MaxCostUnits) \/ (attempts + 1 = MaxAttempts /\ ~pass) THEN "HALTED_BUDGET"
        ELSE "PENDING"
    /\ UNCHANGED <<goalValid, reviewerIndependent, criticalFindings, warningFindings, worktreesDisjoint>>

PlanWorktrees(disjoint) ==
    /\ disjoint \in BOOLEAN
    /\ worktreesDisjoint' = disjoint
    /\ prGateVerdict' =
        IF ~goalValid THEN "BLOCKED_VAGUE_GOAL"
        ELSE IF verifierTampered THEN "BLOCKED_VERIFIER_TAMPER"
        ELSE IF ~disjoint THEN "BLOCKED_PRE_PR_GATES"
        ELSE "PENDING"
    /\ UNCHANGED <<goalValid, verifierTampered, attempts, costUnits, testsPassed, reviewerIndependent, criticalFindings, warningFindings>>

EvaluatePrePrGates(indep, crits, warns) ==
    /\ indep \in BOOLEAN
    /\ crits \in {0, 1}
    /\ warns \in {0, 1, 2}
    /\ reviewerIndependent' = indep
    /\ criticalFindings' = crits
    /\ warningFindings' = warns
    /\ prGateVerdict' =
        IF ~goalValid THEN "BLOCKED_VAGUE_GOAL"
        ELSE IF verifierTampered THEN "BLOCKED_VERIFIER_TAMPER"
        ELSE IF testsPassed /\ indep /\ crits = 0 /\ worktreesDisjoint THEN "READY_FOR_PR"
        ELSE "BLOCKED_PRE_PR_GATES"
    /\ UNCHANGED <<goalValid, verifierTampered, attempts, costUnits, testsPassed, worktreesDisjoint>>

Next ==
    \/ \E valid \in BOOLEAN : ValidateGoal(valid)
    \/ \E tamper \in BOOLEAN, cd \in {1, 2}, pass \in BOOLEAN : ExecuteAttempt(tamper, cd, pass)
    \/ \E dj \in BOOLEAN : PlanWorktrees(dj)
    \/ \E indep \in BOOLEAN, crits \in {0, 1}, warns \in {0, 1, 2} : EvaluatePrePrGates(indep, crits, warns)

Spec == Init /\ [][Next]_vars

\* Safety Invariants
SafetyNoReadyOnVagueGoal ==
    (prGateVerdict = "READY_FOR_PR") => goalValid

SafetyNoReadyOnTamperedVerifier ==
    (prGateVerdict = "READY_FOR_PR") => (~verifierTampered)

SafetyNoReadyWithoutPrePrGates ==
    (prGateVerdict = "READY_FOR_PR") => (testsPassed /\ reviewerIndependent /\ criticalFindings = 0 /\ worktreesDisjoint)

SafetyBudgetBounded ==
    (attempts <= MaxAttempts) /\ (costUnits <= MaxCostUnits)

=============================================================================
