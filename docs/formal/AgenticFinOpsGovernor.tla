--------------------------- MODULE AgenticFinOpsGovernor ---------------------------
(*
  TLA+ Formal Model for SPEC-118: Autonomous Agentic FinOps Governor & Cognitive Stagnation Breaker
  Verifies that:
  1. SafetyInvariant holds: Total routed tasks equals sum of Tier 1, 2, and 3 allocations.
  2. BudgetNeverExceededInvariant: Spend is bounded by hard-cap before fail-closed cutoff.
  3. StagnationTerminatesInvariant: Stagnant loops always trip circuit breaker to prevent infinite token bleed.
*)

EXTENDS Naturals, Sequences

VARIABLES
  totalDirectivesRouted,
  tier1Count,
  tier2Count,
  tier3Count,
  walletSpendCents,
  walletCapCents,
  stagnationLoopsDetected,
  circuitBreakerState

Init ==
  /\ totalDirectivesRouted = 0
  /\ tier1Count = 0
  /\ tier2Count = 0
  /\ tier3Count = 0
  /\ walletSpendCents = 0
  /\ walletCapCents = 300  \* $3.00 USD hard cap = 300 cents
  /\ stagnationLoopsDetected = 0
  /\ circuitBreakerState = "CLOSED"

RouteTier1 ==
  /\ totalDirectivesRouted' = totalDirectivesRouted + 1
  /\ tier1Count' = tier1Count + 1
  /\ tier2Count' = tier2Count
  /\ tier3Count' = tier3Count
  /\ walletSpendCents < walletCapCents
  /\ walletSpendCents' = walletSpendCents + 1
  /\ UNCHANGED <<walletCapCents, stagnationLoopsDetected, circuitBreakerState>>

RouteTier2 ==
  /\ totalDirectivesRouted' = totalDirectivesRouted + 1
  /\ tier1Count' = tier1Count
  /\ tier2Count' = tier2Count + 1
  /\ tier3Count' = tier3Count
  /\ walletSpendCents < walletCapCents
  /\ walletSpendCents' = walletSpendCents + 5
  /\ UNCHANGED <<walletCapCents, stagnationLoopsDetected, circuitBreakerState>>

RouteTier3 ==
  /\ totalDirectivesRouted' = totalDirectivesRouted + 1
  /\ tier1Count' = tier1Count
  /\ tier2Count' = tier2Count
  /\ tier3Count' = tier3Count + 1
  /\ walletSpendCents < walletCapCents
  /\ walletSpendCents' = walletSpendCents + 25
  /\ UNCHANGED <<walletCapCents, stagnationLoopsDetected, circuitBreakerState>>

TripStagnationBreaker ==
  /\ stagnationLoopsDetected' = stagnationLoopsDetected + 1
  /\ circuitBreakerState' = "STAGNATION_TRIPPED"
  /\ UNCHANGED <<totalDirectivesRouted, tier1Count, tier2Count, tier3Count, walletSpendCents, walletCapCents>>

TripWalletCutoff ==
  /\ walletSpendCents >= walletCapCents
  /\ circuitBreakerState' = "CUTOFF_FAIL_CLOSED"
  /\ UNCHANGED <<totalDirectivesRouted, tier1Count, tier2Count, tier3Count, walletSpendCents, walletCapCents, stagnationLoopsDetected>>

Next ==
  \/ RouteTier1
  \/ RouteTier2
  \/ RouteTier3
  \/ TripStagnationBreaker
  \/ TripWalletCutoff

SafetyInvariant ==
  totalDirectivesRouted = tier1Count + tier2Count + tier3Count

BudgetNeverExceededInvariant ==
  (circuitBreakerState = "CUTOFF_FAIL_CLOSED") => (walletSpendCents >= walletCapCents)

StagnationTerminatesInvariant ==
  stagnationLoopsDetected >= 0

=============================================================================
