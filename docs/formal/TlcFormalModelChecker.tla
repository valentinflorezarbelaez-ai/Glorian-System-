--------------------------- MODULE TlcFormalModelChecker ---------------------------
EXTENDS Naturals, Sequences

VARIABLES
    runtimeState,        \* "IDLE", "DETECTING", "TLC_RUNNING", "FALLBACK_RUNNING", "VERIFIED", "VIOLATION_DETECTED"
    javaAvailable,       \* BOOLEAN: whether Java executable is found in environment
    jarAvailable,        \* BOOLEAN: whether tla2tools.jar is present
    modelsChecked,       \* Nat: counter of formal models verified
    violationsFound,     \* Nat: counter of safety/liveness invariant breaches
    receiptsIssued       \* Nat: counter of cryptographic receipts sealed

Init ==
    /\ runtimeState = "IDLE"
    /\ javaAvailable \in {TRUE, FALSE}
    /\ jarAvailable \in {TRUE, FALSE}
    /\ modelsChecked = 0
    /\ violationsFound = 0
    /\ receiptsIssued = 0

DetectRuntime ==
    /\ runtimeState = "IDLE"
    /\ runtimeState' = "DETECTING"
    /\ UNCHANGED <<javaAvailable, jarAvailable, modelsChecked, violationsFound, receiptsIssued>>

DispatchDualMode ==
    /\ runtimeState = "DETECTING"
    /\ IF javaAvailable /\ jarAvailable
       THEN runtimeState' = "TLC_RUNNING"
       ELSE runtimeState' = "FALLBACK_RUNNING"
    /\ UNCHANGED <<javaAvailable, jarAvailable, modelsChecked, violationsFound, receiptsIssued>>

ExecuteTlcPass ==
    /\ runtimeState = "TLC_RUNNING"
    /\ runtimeState' = "VERIFIED"
    /\ modelsChecked' = modelsChecked + 1
    /\ receiptsIssued' = receiptsIssued + 1
    /\ UNCHANGED <<javaAvailable, jarAvailable, violationsFound>>

ExecuteFallbackPass ==
    /\ runtimeState = "FALLBACK_RUNNING"
    /\ runtimeState' = "VERIFIED"
    /\ modelsChecked' = modelsChecked + 1
    /\ receiptsIssued' = receiptsIssued + 1
    /\ UNCHANGED <<javaAvailable, jarAvailable, violationsFound>>

RecordViolation ==
    /\ runtimeState \in {"TLC_RUNNING", "FALLBACK_RUNNING"}
    /\ runtimeState' = "VIOLATION_DETECTED"
    /\ violationsFound' = violationsFound + 1
    /\ receiptsIssued' = receiptsIssued + 1
    /\ UNCHANGED <<javaAvailable, jarAvailable, modelsChecked>>

ResetIdle ==
    /\ runtimeState \in {"VERIFIED", "VIOLATION_DETECTED"}
    /\ runtimeState' = "IDLE"
    /\ UNCHANGED <<javaAvailable, jarAvailable, modelsChecked, violationsFound, receiptsIssued>>

Next ==
    \/ DetectRuntime
    \/ DispatchDualMode
    \/ ExecuteTlcPass
    \/ ExecuteFallbackPass
    \/ RecordViolation
    \/ ResetIdle

TypeInvariant ==
    /\ runtimeState \in {"IDLE", "DETECTING", "TLC_RUNNING", "FALLBACK_RUNNING", "VERIFIED", "VIOLATION_DETECTED"}
    /\ javaAvailable \in {TRUE, FALSE}
    /\ jarAvailable \in {TRUE, FALSE}
    /\ modelsChecked >= 0
    /\ violationsFound >= 0
    /\ receiptsIssued >= 0

SafetyInvariant ==
    /\ receiptsIssued >= (modelsChecked + violationsFound)
    /\ (runtimeState = "TLC_RUNNING" => (javaAvailable /\ jarAvailable))

=============================================================================
