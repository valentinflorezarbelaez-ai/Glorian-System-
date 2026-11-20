---- MODULE MultiAssetMacroFilterEngine ----
EXTENDS Naturals, Sequences

VARIABLES
    newsBlackout,
    activeAssetCount,
    paperTradesCount,
    engineState

vars == <<newsBlackout, activeAssetCount, paperTradesCount, engineState>>

EngineStates == {"IDLE", "SCANNING", "NEWS_BLACKOUT", "TRADE_ELECTED", "PAPER_LOGGED"}

TypeOK ==
    /\ newsBlackout \in BOOLEAN
    /\ activeAssetCount \in 0..1
    /\ paperTradesCount \in Nat
    /\ engineState \in EngineStates

Init ==
    /\ newsBlackout = FALSE
    /\ activeAssetCount = 0
    /\ paperTradesCount = 0
    /\ engineState = "IDLE"

TriggerNewsBlackout ==
    /\ engineState \in {"IDLE", "SCANNING"}
    /\ newsBlackout' = TRUE
    /\ activeAssetCount' = 0
    /\ engineState' = "NEWS_BLACKOUT"
    /\ UNCHANGED <<paperTradesCount>>

ClearNewsBlackout ==
    /\ engineState = "NEWS_BLACKOUT"
    /\ newsBlackout' = FALSE
    /\ engineState' = "IDLE"
    /\ UNCHANGED <<activeAssetCount, paperTradesCount>>

StartScanning ==
    /\ engineState = "IDLE"
    /\ ~newsBlackout
    /\ engineState' = "SCANNING"
    /\ UNCHANGED <<newsBlackout, activeAssetCount, paperTradesCount>>

ElectBestAsset ==
    /\ engineState = "SCANNING"
    /\ ~newsBlackout
    /\ activeAssetCount' = 1
    /\ engineState' = "TRADE_ELECTED"
    /\ UNCHANGED <<newsBlackout, paperTradesCount>>

RecordPaperTrade ==
    /\ engineState = "TRADE_ELECTED"
    /\ ~newsBlackout
    /\ activeAssetCount = 1
    /\ paperTradesCount' = paperTradesCount + 1
    /\ activeAssetCount' = 0
    /\ engineState' = "PAPER_LOGGED"
    /\ UNCHANGED <<newsBlackout>>

HaltedStay ==
    /\ engineState = "PAPER_LOGGED"
    /\ UNCHANGED vars

Next ==
    \/ TriggerNewsBlackout
    \/ ClearNewsBlackout
    \/ StartScanning
    \/ ElectBestAsset
    \/ RecordPaperTrade
    \/ HaltedStay

Spec == Init /\ [][Next]_vars

NewsBlackoutStrictness ==
    newsBlackout => activeAssetCount = 0

SingleAssetExecutionElection ==
    activeAssetCount <= 1

PaperModeIsolation ==
    paperTradesCount >= 0

=============================================================================
