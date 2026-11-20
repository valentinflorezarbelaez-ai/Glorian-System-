---- MODULE AladdinPortfolioRiskEngine ----
EXTENDS Naturals, Sequences

VARIABLES
    fiduciaryVaultState,
    fiduciaryCapital,
    speculativeCapital,
    portfolioBalanced,
    engineState

vars == <<fiduciaryVaultState, fiduciaryCapital, speculativeCapital, portfolioBalanced, engineState>>

VaultStates == {"SECURED", "VIOLATION_BLOCKED"}
EngineStates == {"INITIALIZED", "STRESS_TESTED", "PORTFOLIO_BALANCED", "HALTED_VIOLATION"}

TypeOK ==
    /\ fiduciaryVaultState \in VaultStates
    /\ fiduciaryCapital \in Nat
    /\ speculativeCapital \in Nat
    /\ portfolioBalanced \in BOOLEAN
    /\ engineState \in EngineStates

Init ==
    /\ fiduciaryVaultState = "SECURED"
    /\ fiduciaryCapital = 3000
    /\ speculativeCapital = 0
    /\ portfolioBalanced = FALSE
    /\ engineState = "INITIALIZED"

AttemptSpeculativeLeak ==
    /\ engineState = "INITIALIZED"
    /\ fiduciaryVaultState' = "SECURED"
    /\ fiduciaryCapital' = fiduciaryCapital
    /\ speculativeCapital' = speculativeCapital
    /\ portfolioBalanced' = portfolioBalanced
    /\ engineState' = "HALTED_VIOLATION"

RunStressTest ==
    /\ engineState = "INITIALIZED"
    /\ engineState' = "STRESS_TESTED"
    /\ UNCHANGED <<fiduciaryVaultState, fiduciaryCapital, speculativeCapital, portfolioBalanced>>

RebalancePortfolio ==
    /\ engineState \in {"INITIALIZED", "STRESS_TESTED"}
    /\ portfolioBalanced' = TRUE
    /\ engineState' = "PORTFOLIO_BALANCED"
    /\ UNCHANGED <<fiduciaryVaultState, fiduciaryCapital, speculativeCapital>>

HaltedStay ==
    /\ engineState \in {"HALTED_VIOLATION", "PORTFOLIO_BALANCED"}
    /\ UNCHANGED vars

Next ==
    \/ AttemptSpeculativeLeak
    \/ RunStressTest
    \/ RebalancePortfolio
    \/ HaltedStay

Spec == Init /\ [][Next]_vars

ZeroFiduciaryRuinInvariant ==
    /\ fiduciaryCapital >= 3000
    /\ speculativeCapital = 0
    /\ fiduciaryVaultState = "SECURED"

MaxDrawdownGuard ==
    portfolioBalanced => fiduciaryCapital >= 3000

=============================================================================
