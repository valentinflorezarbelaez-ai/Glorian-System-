---------------- MODULE UniversalAssetPayoutOptimizer ----------------
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    Assets,                 \* Set of candidate assets (Forex, Crypto, Commodities, Equities)
    MinPayoutPercent,       \* Minimum payout threshold (80)
    FiduciaryCapital        \* Untouchable Vault Alpha capital (3000)

VARIABLES
    assetPayout,            \* Asset -> [binary: Int, digital: Int]
    assetConfluence,        \* Asset -> Int (0..100)
    assetStatus,            \* Asset -> {"PENDING", "QUALIFIED", "REJECTED_LOW_PAYOUT", "REJECTED_LOW_SCORE"}
    electedAsset,           \* Selected asset or "NONE"
    electedMode,            \* "BINARY", "DIGITAL", or "NONE"
    tradeActive,            \* BOOLEAN (single concurrency lock)
    expirySeconds,          \* Constant 60
    vaultAlphaBalance       \* Invariant 3000

vars == <<assetPayout, assetConfluence, assetStatus, electedAsset, electedMode, tradeActive, expirySeconds, vaultAlphaBalance>>

TypeOK ==
    /\ electedAsset \in Assets \cup {"NONE"}
    /\ electedMode \in {"BINARY", "DIGITAL", "NONE"}
    /\ tradeActive \in BOOLEAN
    /\ expirySeconds = 60
    /\ vaultAlphaBalance = FiduciaryCapital

Init ==
    /\ assetPayout = [a \in Assets |-> [binary |-> 75, digital |-> 88]]
    /\ assetConfluence = [a \in Assets |-> 85]
    /\ assetStatus = [a \in Assets |-> "PENDING"]
    /\ electedAsset = "NONE"
    /\ electedMode = "NONE"
    /\ tradeActive = FALSE
    /\ expirySeconds = 60
    /\ vaultAlphaBalance = FiduciaryCapital

EvaluatePayouts ==
    /\ electedAsset = "NONE"
    /\ assetStatus' = [a \in Assets |->
        IF assetPayout[a].digital < MinPayoutPercent /\ assetPayout[a].binary < MinPayoutPercent
        THEN "REJECTED_LOW_PAYOUT"
        ELSE IF assetConfluence[a] < 80
             THEN "REJECTED_LOW_SCORE"
             ELSE "QUALIFIED"]
    /\ UNCHANGED <<assetPayout, assetConfluence, electedAsset, electedMode, tradeActive, expirySeconds, vaultAlphaBalance>>

ElectTopOneAsset(a) ==
    /\ electedAsset = "NONE"
    /\ ~tradeActive
    /\ assetStatus[a] = "QUALIFIED"
    /\ electedAsset' = a
    /\ electedMode' = IF assetPayout[a].digital >= assetPayout[a].binary THEN "DIGITAL" ELSE "BINARY"
    /\ tradeActive' = TRUE
    /\ UNCHANGED <<assetPayout, assetConfluence, assetStatus, expirySeconds, vaultAlphaBalance>>

CloseTrade ==
    /\ tradeActive
    /\ tradeActive' = FALSE
    /\ electedAsset' = "NONE"
    /\ electedMode' = "NONE"
    /\ UNCHANGED <<assetPayout, assetConfluence, assetStatus, expirySeconds, vaultAlphaBalance>>

Next ==
    \/ EvaluatePayouts
    \/ (\E a \in Assets : ElectTopOneAsset(a))
    \/ CloseTrade

\* Formal Invariants
SafetyInvariantVaultAlpha == vaultAlphaBalance = FiduciaryCapital
SafetyInvariantConcurrency == tradeActive => electedAsset /= "NONE"
SafetyInvariantExpiry == expirySeconds = 60
SafetyInvariantPayout == (electedAsset /= "NONE") =>
    (IF electedMode = "DIGITAL" THEN assetPayout[electedAsset].digital >= MinPayoutPercent
     ELSE assetPayout[electedAsset].binary >= MinPayoutPercent)

Spec == Init /\ [][Next]_vars
=============================================================================
