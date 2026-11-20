---- MODULE TriTemporalPropFirmEngine ----
EXTENDS Naturals, Sequences

VARIABLES
    m15Aligned,
    m5Aligned,
    m1Aligned,
    dailyLossBps,
    totalLossBps,
    openTradesCount,
    accountState

vars == <<m15Aligned, m5Aligned, m1Aligned, dailyLossBps, totalLossBps, openTradesCount, accountState>>

AccountStates == {"ACTIVE", "DAILY_HALTED", "TOTAL_HALTED", "TARGET_REACHED"}

TypeOK ==
    /\ m15Aligned \in BOOLEAN
    /\ m5Aligned \in BOOLEAN
    /\ m1Aligned \in BOOLEAN
    /\ dailyLossBps \in 0..50
    /\ totalLossBps \in 0..100
    /\ openTradesCount \in 0..1
    /\ accountState \in AccountStates

Init ==
    /\ m15Aligned = TRUE
    /\ m5Aligned = TRUE
    /\ m1Aligned = TRUE
    /\ dailyLossBps = 0
    /\ totalLossBps = 0
    /\ openTradesCount = 0
    /\ accountState = "ACTIVE"

AlignTimeframes ==
    /\ accountState = "ACTIVE"
    /\ openTradesCount = 0
    /\ m15Aligned' = TRUE
    /\ m5Aligned' = TRUE
    /\ m1Aligned' = TRUE
    /\ UNCHANGED <<dailyLossBps, totalLossBps, openTradesCount, accountState>>

ExecuteAlignedTrade ==
    /\ accountState = "ACTIVE"
    /\ openTradesCount = 0
    /\ m15Aligned
    /\ m5Aligned
    /\ m1Aligned
    /\ dailyLossBps < 45
    /\ totalLossBps < 90
    /\ openTradesCount' = 1
    /\ UNCHANGED <<m15Aligned, m5Aligned, m1Aligned, dailyLossBps, totalLossBps, accountState>>

CloseTradeWin ==
    /\ openTradesCount = 1
    /\ openTradesCount' = 0
    /\ UNCHANGED <<m15Aligned, m5Aligned, m1Aligned, dailyLossBps, totalLossBps, accountState>>

CloseTradeLoss ==
    /\ openTradesCount = 1
    /\ openTradesCount' = 0
    /\ dailyLossBps + 10 <= 45
    /\ totalLossBps + 10 <= 90
    /\ dailyLossBps' = dailyLossBps + 10
    /\ totalLossBps' = totalLossBps + 10
    /\ UNCHANGED <<m15Aligned, m5Aligned, m1Aligned, accountState>>

TriggerDailyHalt ==
    /\ accountState = "ACTIVE"
    /\ openTradesCount = 0
    /\ dailyLossBps >= 45
    /\ accountState' = "DAILY_HALTED"
    /\ UNCHANGED <<m15Aligned, m5Aligned, m1Aligned, dailyLossBps, totalLossBps, openTradesCount>>

TriggerTotalHalt ==
    /\ accountState = "ACTIVE"
    /\ openTradesCount = 0
    /\ totalLossBps >= 90
    /\ accountState' = "TOTAL_HALTED"
    /\ UNCHANGED <<m15Aligned, m5Aligned, m1Aligned, dailyLossBps, totalLossBps, openTradesCount>>

HaltedStay ==
    /\ accountState \in {"DAILY_HALTED", "TOTAL_HALTED", "TARGET_REACHED"}
    /\ UNCHANGED vars

Next ==
    \/ AlignTimeframes
    \/ ExecuteAlignedTrade
    \/ CloseTradeWin
    \/ CloseTradeLoss
    \/ TriggerDailyHalt
    \/ TriggerTotalHalt
    \/ HaltedStay

Spec == Init /\ [][Next]_vars

TriTemporalHarmonicAlignment ==
    openTradesCount > 0 => (m15Aligned /\ m5Aligned /\ m1Aligned)

PropFirmSurvivalInvariant ==
    /\ dailyLossBps <= 45
    /\ totalLossBps <= 90

SingleExecutionLock ==
    openTradesCount <= 1

=============================================================================
