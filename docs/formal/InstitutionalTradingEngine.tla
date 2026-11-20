---------------- MODULE InstitutionalTradingEngine ----------------
EXTENDS Naturals, Sequences, Integers

CONSTANTS MaxDrawdown, MaxLosses, TargetProfit

VARIABLES engineState, activePositionCount, dailyDrawdown, consecutiveLosses, 
          dailyProfit, accountMode, councilVotes, riskGovernorPassed

vars == <<engineState, activePositionCount, dailyDrawdown, consecutiveLosses, 
          dailyProfit, accountMode, councilVotes, riskGovernorPassed>>

Init ==
  /\ engineState = "IDLE"
  /\ activePositionCount = 0
  /\ dailyDrawdown = 0
  /\ consecutiveLosses = 0
  /\ dailyProfit = 0
  /\ accountMode = "PRACTICE"
  /\ councilVotes = 0
  /\ riskGovernorPassed = FALSE

ScanMarket ==
  /\ engineState = "IDLE"
  /\ dailyDrawdown < MaxDrawdown
  /\ consecutiveLosses < MaxLosses
  /\ dailyProfit < TargetProfit
  /\ engineState' = "SCANNING"
  /\ UNCHANGED <<activePositionCount, dailyDrawdown, consecutiveLosses, dailyProfit, accountMode, councilVotes, riskGovernorPassed>>

DetectConfluence ==
  /\ engineState = "SCANNING"
  /\ engineState' = "CONFLUENCE_DETECTED"
  /\ UNCHANGED <<activePositionCount, dailyDrawdown, consecutiveLosses, dailyProfit, accountMode, councilVotes, riskGovernorPassed>>

ConveneCouncil ==
  /\ engineState = "CONFLUENCE_DETECTED"
  /\ \E v \in 0..4 :
     \E rg \in {TRUE, FALSE} :
        /\ councilVotes' = v
        /\ riskGovernorPassed' = (dailyDrawdown < MaxDrawdown /\ consecutiveLosses < MaxLosses /\ accountMode = "PRACTICE" /\ rg)
        /\ engineState' = "COUNCIL_VOTING"
  /\ UNCHANGED <<activePositionCount, dailyDrawdown, consecutiveLosses, dailyProfit, accountMode>>

ExecuteSignal ==
  /\ engineState = "COUNCIL_VOTING"
  /\ councilVotes >= 3
  /\ riskGovernorPassed = TRUE
  /\ activePositionCount = 0
  /\ engineState' = "POSITION_OPEN"
  /\ activePositionCount' = 1
  /\ UNCHANGED <<dailyDrawdown, consecutiveLosses, dailyProfit, accountMode, councilVotes, riskGovernorPassed>>

RejectSignal ==
  /\ engineState = "COUNCIL_VOTING"
  /\ (councilVotes < 3 \/ riskGovernorPassed = FALSE)
  /\ engineState' = "IDLE"
  /\ UNCHANGED <<activePositionCount, dailyDrawdown, consecutiveLosses, dailyProfit, accountMode, councilVotes, riskGovernorPassed>>

ResolvePositionWin ==
  /\ engineState = "POSITION_OPEN"
  /\ activePositionCount = 1
  /\ engineState' = "COOLDOWN"
  /\ activePositionCount' = 0
  /\ consecutiveLosses' = 0
  /\ dailyProfit' = dailyProfit + 34
  /\ UNCHANGED <<dailyDrawdown, accountMode, councilVotes, riskGovernorPassed>>

ResolvePositionLoss ==
  /\ engineState = "POSITION_OPEN"
  /\ activePositionCount = 1
  /\ engineState' = "COOLDOWN"
  /\ activePositionCount' = 0
  /\ consecutiveLosses' = consecutiveLosses + 1
  /\ dailyDrawdown' = dailyDrawdown + 1
  /\ dailyProfit' = dailyProfit - 40
  /\ UNCHANGED <<accountMode, councilVotes, riskGovernorPassed>>

CooldownComplete ==
  /\ engineState = "COOLDOWN"
  /\ IF dailyDrawdown >= MaxDrawdown \/ consecutiveLosses >= MaxLosses
     THEN engineState' = "HALTED_STOP_LOSS"
     ELSE IF dailyProfit >= TargetProfit
          THEN engineState' = "HALTED_TAKE_PROFIT"
          ELSE engineState' = "IDLE"
  /\ UNCHANGED <<activePositionCount, dailyDrawdown, consecutiveLosses, dailyProfit, accountMode, councilVotes, riskGovernorPassed>>

HaltedStay ==
  /\ engineState \in {"HALTED_STOP_LOSS", "HALTED_TAKE_PROFIT"}
  /\ UNCHANGED vars

Next ==
  \/ ScanMarket
  \/ DetectConfluence
  \/ ConveneCouncil
  \/ ExecuteSignal
  \/ RejectSignal
  \/ ResolvePositionWin
  \/ ResolvePositionLoss
  \/ CooldownComplete
  \/ HaltedStay

ConcurrencyLock ==
  activePositionCount \in {0, 1}

SafetyStopLoss ==
  (dailyDrawdown >= MaxDrawdown \/ consecutiveLosses >= MaxLosses) => engineState # "POSITION_OPEN"

PracticeModeIsolation ==
  engineState = "POSITION_OPEN" => accountMode = "PRACTICE"

CouncilApproval ==
  engineState = "POSITION_OPEN" => (councilVotes >= 3 /\ riskGovernorPassed = TRUE)

Spec == Init /\ [][Next]_vars
=============================================================================
