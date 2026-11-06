--------------------------- MODULE MicroVmSandbox ---------------------------
EXTENDS Naturals, Sequences

VARIABLES
    sandboxState,        \* "IDLE", "ISOLATING", "RUNNING", "COMPLETED", "TIMEOUT_KILLED"
    networkIsolated,     \* BOOLEAN: strictly true
    memoryCapMb,         \* Nat: memory threshold (e.g. 512)
    executionsCompleted, \* Nat: counter of clean runs
    timeoutsCaught,      \* Nat: counter of runaway executions terminated
    receiptsIssued       \* Nat: counter of SHA-256 receipts sealed

Init ==
    /\ sandboxState = "IDLE"
    /\ networkIsolated = TRUE
    /\ memoryCapMb = 512
    /\ executionsCompleted = 0
    /\ timeoutsCaught = 0
    /\ receiptsIssued = 0

SpawnSandbox ==
    /\ sandboxState = "IDLE"
    /\ sandboxState' = "ISOLATING"
    /\ UNCHANGED <<networkIsolated, memoryCapMb, executionsCompleted, timeoutsCaught, receiptsIssued>>

StartExecution ==
    /\ sandboxState = "ISOLATING"
    /\ sandboxState' = "RUNNING"
    /\ UNCHANGED <<networkIsolated, memoryCapMb, executionsCompleted, timeoutsCaught, receiptsIssued>>

FinishExecutionSuccess ==
    /\ sandboxState = "RUNNING"
    /\ sandboxState' = "COMPLETED"
    /\ executionsCompleted' = executionsCompleted + 1
    /\ receiptsIssued' = receiptsIssued + 1
    /\ UNCHANGED <<networkIsolated, memoryCapMb, timeoutsCaught>>

TimeoutKillExecution ==
    /\ sandboxState = "RUNNING"
    /\ sandboxState' = "TIMEOUT_KILLED"
    /\ timeoutsCaught' = timeoutsCaught + 1
    /\ receiptsIssued' = receiptsIssued + 1
    /\ UNCHANGED <<networkIsolated, memoryCapMb, executionsCompleted>>

ResetIdle ==
    /\ sandboxState \in {"COMPLETED", "TIMEOUT_KILLED"}
    /\ sandboxState' = "IDLE"
    /\ UNCHANGED <<networkIsolated, memoryCapMb, executionsCompleted, timeoutsCaught, receiptsIssued>>

Next ==
    \/ SpawnSandbox
    \/ StartExecution
    \/ FinishExecutionSuccess
    \/ TimeoutKillExecution
    \/ ResetIdle

TypeInvariant ==
    /\ sandboxState \in {"IDLE", "ISOLATING", "RUNNING", "COMPLETED", "TIMEOUT_KILLED"}
    /\ networkIsolated = TRUE
    /\ memoryCapMb > 0
    /\ executionsCompleted >= 0
    /\ timeoutsCaught >= 0
    /\ receiptsIssued >= 0

SafetyInvariant ==
    /\ networkIsolated = TRUE
    /\ receiptsIssued >= (executionsCompleted + timeoutsCaught)

=============================================================================
