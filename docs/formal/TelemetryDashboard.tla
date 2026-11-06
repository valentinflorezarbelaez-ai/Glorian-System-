--------------------------- MODULE TelemetryDashboard ---------------------------
EXTENDS Naturals, Sequences

VARIABLES
    serverState,         \* "STOPPED", "STARTING", "LISTENING", "SERVING_REQUEST", "SHUTTING_DOWN"
    activePort,          \* Nat: 0 when stopped, e.g. 4321 when listening
    requestsServed,      \* Nat: counter of HTTP requests handled
    receiptsIssued       \* Nat: counter of SHA-256 receipts sealed

Init ==
    /\ serverState = "STOPPED"
    /\ activePort = 0
    /\ requestsServed = 0
    /\ receiptsIssued = 0

StartServer ==
    /\ serverState = "STOPPED"
    /\ serverState' = "STARTING"
    /\ activePort' = 4321
    /\ UNCHANGED <<requestsServed, receiptsIssued>>

BindListening ==
    /\ serverState = "STARTING"
    /\ serverState' = "LISTENING"
    /\ UNCHANGED <<activePort, requestsServed, receiptsIssued>>

HandleRequest ==
    /\ serverState = "LISTENING"
    /\ serverState' = "SERVING_REQUEST"
    /\ UNCHANGED <<activePort, requestsServed, receiptsIssued>>

CompleteResponse ==
    /\ serverState = "SERVING_REQUEST"
    /\ serverState' = "LISTENING"
    /\ requestsServed' = requestsServed + 1
    /\ receiptsIssued' = receiptsIssued + 1
    /\ UNCHANGED <<activePort>>

StopServer ==
    /\ serverState \in {"LISTENING", "SERVING_REQUEST"}
    /\ serverState' = "SHUTTING_DOWN"
    /\ UNCHANGED <<activePort, requestsServed, receiptsIssued>>

FinishShutdown ==
    /\ serverState = "SHUTTING_DOWN"
    /\ serverState' = "STOPPED"
    /\ activePort' = 0
    /\ UNCHANGED <<requestsServed, receiptsIssued>>

Next ==
    \/ StartServer
    \/ BindListening
    \/ HandleRequest
    \/ CompleteResponse
    \/ StopServer
    \/ FinishShutdown

TypeInvariant ==
    /\ serverState \in {"STOPPED", "STARTING", "LISTENING", "SERVING_REQUEST", "SHUTTING_DOWN"}
    /\ (serverState = "STOPPED" => activePort = 0)
    /\ (serverState \in {"STARTING", "LISTENING", "SERVING_REQUEST", "SHUTTING_DOWN"} => activePort > 0)
    /\ requestsServed >= 0
    /\ receiptsIssued >= 0

SafetyInvariant ==
    /\ (activePort = 0 => serverState = "STOPPED")
    /\ receiptsIssued >= requestsServed

=============================================================================
