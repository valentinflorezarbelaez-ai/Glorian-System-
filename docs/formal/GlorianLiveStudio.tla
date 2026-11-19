------------------------- MODULE GlorianLiveStudio -------------------------
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Clients, MaxEvents

VARIABLES serverState, connectedClients, eventSeq, clientReceivedSeq

TypeOK ==
  /\ serverState \in {"STOPPED", "STARTING", "RUNNING", "STOPPING"}
  /\ connectedClients \subseteq Clients
  /\ eventSeq \in 0..MaxEvents
  /\ clientReceivedSeq \in [Clients -> 0..MaxEvents]

Init ==
  /\ serverState = "STOPPED"
  /\ connectedClients = {}
  /\ eventSeq = 0
  /\ clientReceivedSeq = [c \in Clients |-> 0]

StartServer ==
  /\ serverState = "STOPPED"
  /\ serverState' = "RUNNING"
  /\ UNCHANGED <<connectedClients, eventSeq, clientReceivedSeq>>

ConnectClient(c) ==
  /\ serverState = "RUNNING"
  /\ c \in Clients \ connectedClients
  /\ connectedClients' = connectedClients \cup {c}
  /\ clientReceivedSeq' = [clientReceivedSeq EXCEPT ![c] = eventSeq]
  /\ UNCHANGED <<serverState, eventSeq>>

DisconnectClient(c) ==
  /\ c \in connectedClients
  /\ connectedClients' = connectedClients \ {c}
  /\ UNCHANGED <<serverState, eventSeq, clientReceivedSeq>>

BroadcastEvent ==
  /\ serverState = "RUNNING"
  /\ eventSeq < MaxEvents
  /\ eventSeq' = eventSeq + 1
  /\ clientReceivedSeq' = [c \in Clients |-> 
       IF c \in connectedClients THEN eventSeq + 1 ELSE clientReceivedSeq[c]]
  /\ UNCHANGED <<serverState, connectedClients>>

StopServer ==
  /\ serverState = "RUNNING"
  /\ serverState' = "STOPPED"
  /\ connectedClients' = {}
  /\ UNCHANGED <<eventSeq, clientReceivedSeq>>

Next ==
  \/ StartServer
  \/ \E c \in Clients: ConnectClient(c)
  \/ \E c \in Clients: DisconnectClient(c)
  \/ BroadcastEvent
  \/ StopServer

(* Invariants *)

ClientSafety ==
  (serverState = "STOPPED") => (connectedClients = {})

SequenceMonotonicity ==
  \A c \in Clients: clientReceivedSeq[c] <= eventSeq

ConnectedSequenceSync ==
  \A c \in connectedClients: clientReceivedSeq[c] = eventSeq

Spec == Init /\ [][Next]_<<serverState, connectedClients, eventSeq, clientReceivedSeq>>

=============================================================================
