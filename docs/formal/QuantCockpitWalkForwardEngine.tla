---------------- MODULE QuantCockpitWalkForwardEngine ----------------
EXTENDS Integers

CONSTANTS
    FiduciaryVaultUsd,      \* Immutable Vault Alpha capital (3000)
    MinPayoutPercent,       \* Minimum acceptable broker payout (80)
    MaxLatencyMs,           \* Maximum tolerated network latency (300 ms)
    MinStakeBps,            \* Minimum Quarter-Kelly stake (50 bps = 0.5%)
    MaxStakeBps             \* Maximum Quarter-Kelly stake (200 bps = 2.0%)

VARIABLES
    accountType,            \* "TRAINING" only for execution
    triggerPhase,           \* "WAITING", "ARMED_59_8", "FIRED", "ABORTED_LATE"
    latencyMs,              \* Observed gateway latency in ms
    payoutPercent,          \* Best available instrument payout %
    stakeBps,               \* Active Quarter-Kelly stake in basis points
    lastStakeBps,           \* Previous closed trade stake in basis points
    lastOutcome,            \* "NONE", "WIN", "LOSS"
    activeTrades,           \* 0 or 1 (strict concurrency lock)
    vaultAlphaUsd,          \* Invariant = FiduciaryVaultUsd
    strategyQuarantined     \* BOOLEAN (true when Alpha-Decay WR < 52% over >= 20 trades)

vars == <<accountType, triggerPhase, latencyMs, payoutPercent, stakeBps, lastStakeBps, lastOutcome, activeTrades, vaultAlphaUsd, strategyQuarantined>>

AllowedBps == {50, 100, 200}

TypeOK ==
    /\ accountType \in {"TRAINING"}
    /\ triggerPhase \in {"WAITING", "ARMED_59_8", "FIRED", "ABORTED_LATE"}
    /\ latencyMs \in {50, 400}
    /\ payoutPercent \in {75, 92}
    /\ stakeBps \in AllowedBps
    /\ lastStakeBps \in AllowedBps
    /\ lastOutcome \in {"NONE", "WIN", "LOSS"}
    /\ activeTrades \in 0..1
    /\ vaultAlphaUsd = FiduciaryVaultUsd
    /\ strategyQuarantined \in BOOLEAN

Init ==
    /\ accountType = "TRAINING"
    /\ triggerPhase = "WAITING"
    /\ latencyMs = 50
    /\ payoutPercent = 92
    /\ stakeBps = 100
    /\ lastStakeBps = 100
    /\ lastOutcome = "NONE"
    /\ activeTrades = 0
    /\ vaultAlphaUsd = FiduciaryVaultUsd
    /\ strategyQuarantined = FALSE

ArmTrigger ==
    /\ activeTrades = 0
    /\ triggerPhase \in {"WAITING", "ABORTED_LATE"}
    /\ triggerPhase' = "ARMED_59_8"
    /\ UNCHANGED <<accountType, latencyMs, payoutPercent, stakeBps, lastStakeBps, lastOutcome, activeTrades, vaultAlphaUsd, strategyQuarantined>>

AbortLateOrSlow ==
    /\ activeTrades = 0
    /\ triggerPhase \in {"WAITING", "ARMED_59_8"}
    /\ triggerPhase' = "ABORTED_LATE"
    /\ UNCHANGED <<accountType, latencyMs, payoutPercent, stakeBps, lastStakeBps, lastOutcome, activeTrades, vaultAlphaUsd, strategyQuarantined>>

ResetTrigger ==
    /\ activeTrades = 0
    /\ triggerPhase = "ABORTED_LATE"
    /\ triggerPhase' = "WAITING"
    /\ UNCHANGED <<accountType, latencyMs, payoutPercent, stakeBps, lastStakeBps, lastOutcome, activeTrades, vaultAlphaUsd, strategyQuarantined>>

UpdateMarket(lat, pay, quar) ==
    /\ activeTrades = 0
    /\ lat \in {50, 400}
    /\ pay \in {75, 92}
    /\ quar \in BOOLEAN
    /\ latencyMs' = lat
    /\ payoutPercent' = pay
    /\ strategyQuarantined' = quar
    /\ UNCHANGED <<accountType, triggerPhase, stakeBps, lastStakeBps, lastOutcome, activeTrades, vaultAlphaUsd>>

AdjustKellyStake(newBps) ==
    /\ activeTrades = 0
    /\ newBps \in AllowedBps
    /\ newBps >= MinStakeBps
    /\ newBps <= MaxStakeBps
    /\ (lastOutcome = "LOSS") => (newBps <= lastStakeBps)
    /\ stakeBps' = newBps
    /\ UNCHANGED <<accountType, triggerPhase, latencyMs, payoutPercent, lastStakeBps, lastOutcome, activeTrades, vaultAlphaUsd, strategyQuarantined>>

OpenSniperTrade ==
    /\ activeTrades = 0
    /\ accountType = "TRAINING"
    /\ triggerPhase = "ARMED_59_8"
    /\ latencyMs <= MaxLatencyMs
    /\ payoutPercent >= MinPayoutPercent
    /\ ~strategyQuarantined
    /\ activeTrades' = 1
    /\ triggerPhase' = "FIRED"
    /\ lastStakeBps' = stakeBps
    /\ UNCHANGED <<accountType, latencyMs, payoutPercent, stakeBps, lastOutcome, vaultAlphaUsd, strategyQuarantined>>

SettleWin ==
    /\ activeTrades = 1
    /\ activeTrades' = 0
    /\ triggerPhase' = "WAITING"
    /\ lastOutcome' = "WIN"
    /\ lastStakeBps' = stakeBps
    /\ UNCHANGED <<accountType, latencyMs, payoutPercent, stakeBps, vaultAlphaUsd, strategyQuarantined>>

SettleLoss ==
    /\ activeTrades = 1
    /\ activeTrades' = 0
    /\ triggerPhase' = "WAITING"
    /\ lastOutcome' = "LOSS"
    /\ lastStakeBps' = stakeBps
    /\ UNCHANGED <<accountType, latencyMs, payoutPercent, stakeBps, vaultAlphaUsd, strategyQuarantined>>

Next ==
    \/ ArmTrigger
    \/ AbortLateOrSlow
    \/ ResetTrigger
    \/ \E lat \in {50, 400}, pay \in {75, 92}, quar \in BOOLEAN : UpdateMarket(lat, pay, quar)
    \/ \E newBps \in AllowedBps : AdjustKellyStake(newBps)
    \/ OpenSniperTrade
    \/ SettleWin
    \/ SettleLoss

\* Formal Safety Invariants (SPEC-376)
SafetyVaultAlphaUntouched == vaultAlphaUsd = FiduciaryVaultUsd
SafetyPracticeOnly == (activeTrades > 0) => (accountType = "TRAINING")
SafetySingleConcurrency == activeTrades <= 1
SafetyZeroMartingale == (lastOutcome = "LOSS") => (stakeBps <= lastStakeBps)
SafetyKellyBounds == (stakeBps >= MinStakeBps) /\ (stakeBps <= MaxStakeBps)
SafetyExecutionGates ==
    (activeTrades > 0) =>
        (triggerPhase = "FIRED" /\ latencyMs <= MaxLatencyMs /\ payoutPercent >= MinPayoutPercent /\ ~strategyQuarantined)

Spec == Init /\ [][Next]_vars
=============================================================================
