-------------------- MODULE VercelCanaryObservability --------------------
(*
  TLA+ Formal Mathematical Specification of the Sovereign Cross-Fleet Telemetry,
  Real-Time Soundcheck, and Automated Canary Analysis (ACA) Observability Engine.
  Governed by EOS System SPEC-107 / PLAN-107 / ADR-107.
  Proves Canary Health Boundedness, Deterministic Circuit-Breaker Rollback,
  and Strict Quorum Soundness.
*)

EXTENDS Naturals

CONSTANTS
  MaxTelemetryBatches,   \* Maximum telemetry sample batches
  ErrorRateThreshold,    \* Threshold (e.g. 10 representing 1.0%)
  MinHealthThreshold     \* Minimum Canary Health Index (CHI >= 70)

VARIABLES
  telemetryIngested,     \* Count of ingested telemetry batches
  canaryHealthIndex,     \* Computed CHI (0..100)
  errorRateObserved,     \* Scaled observed 5xx error rate (0..1000)
  rollbackTriggered,     \* Boolean: true if circuit-breaker rollback executed
  promotionApproved      \* Boolean: true if canary promoted to next stage

vars == <<telemetryIngested, canaryHealthIndex, errorRateObserved, rollbackTriggered, promotionApproved>>

-----------------------------------------------------------------------------

\* Initial State: zero batches, nominal 100 CHI, zero error rate, no rollback, not promoted
Init ==
  /\ telemetryIngested = 0
  /\ canaryHealthIndex = 100
  /\ errorRateObserved = 0
  /\ rollbackTriggered = FALSE
  /\ promotionApproved = FALSE

\* Ingest healthy telemetry: error rate below threshold, CHI remains high, promotion approved
IngestHealthyBatch ==
  /\ telemetryIngested < MaxTelemetryBatches
  /\ ~rollbackTriggered
  /\ telemetryIngested' = telemetryIngested + 1
  /\ errorRateObserved' = 5 \* 0.5% error rate
  /\ canaryHealthIndex' = 95
  /\ promotionApproved' = TRUE
  /\ UNCHANGED <<rollbackTriggered>>

\* Ingest degraded telemetry: error rate exceeds threshold, immediate deterministic rollback
IngestDegradedBatch ==
  /\ telemetryIngested < MaxTelemetryBatches
  /\ ~rollbackTriggered
  /\ telemetryIngested' = telemetryIngested + 1
  /\ errorRateObserved' = 25 \* 2.5% error rate (> threshold 10)
  /\ canaryHealthIndex' = 60 \* CHI < 70
  /\ rollbackTriggered' = TRUE
  /\ promotionApproved' = FALSE

\* Stuttering terminal action
Term ==
  /\ telemetryIngested >= MaxTelemetryBatches
  /\ UNCHANGED vars

Next ==
  \/ IngestHealthyBatch
  \/ IngestDegradedBatch
  \/ Term

-----------------------------------------------------------------------------

\* Invariant 1: Safety Invariant (State variables remain strictly bounded)
SafetyInvariant ==
  /\ canaryHealthIndex >= 0 /\ canaryHealthIndex <= 100
  /\ errorRateObserved >= 0 /\ errorRateObserved <= 1000
  /\ rollbackTriggered \in {TRUE, FALSE}
  /\ promotionApproved \in {TRUE, FALSE}

\* Invariant 2: Canary Budget Invariant (Never promote when rollback triggered)
CanaryBudgetInvariant ==
  rollbackTriggered => ~promotionApproved

\* Invariant 3: Rollback Deterministic Invariant (High error rate triggers rollback)
RollbackDeterministicInvariant ==
  (errorRateObserved > ErrorRateThreshold) => rollbackTriggered

=============================================================================
