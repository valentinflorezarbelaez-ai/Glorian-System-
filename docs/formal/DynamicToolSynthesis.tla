----------------------- MODULE DynamicToolSynthesis -----------------------
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Tools, MaxInvocations

VARIABLES toolState, dispatchTable, invocations

TypeOK ==
  /\ toolState \in [Tools -> {"UNPARSED", "SYNTHESIZED", "TESTING", "REGISTERED", "REJECTED"}]
  /\ dispatchTable \subseteq Tools
  /\ invocations \in [Tools -> 0..MaxInvocations]

Init ==
  /\ toolState = [t \in Tools |-> "UNPARSED"]
  /\ dispatchTable = {}
  /\ invocations = [t \in Tools |-> 0]

ParseSpec(t) ==
  /\ toolState[t] = "UNPARSED"
  /\ toolState' = [toolState EXCEPT ![t] = "SYNTHESIZED"]
  /\ UNCHANGED <<dispatchTable, invocations>>

StartSandboxTest(t) ==
  /\ toolState[t] = "SYNTHESIZED"
  /\ toolState' = [toolState EXCEPT ![t] = "TESTING"]
  /\ UNCHANGED <<dispatchTable, invocations>>

PassSandboxTest(t) ==
  /\ toolState[t] = "TESTING"
  /\ toolState' = [toolState EXCEPT ![t] = "REGISTERED"]
  /\ dispatchTable' = dispatchTable \cup {t}
  /\ UNCHANGED <<invocations>>

FailSandboxTest(t) ==
  /\ toolState[t] = "TESTING"
  /\ toolState' = [toolState EXCEPT ![t] = "REJECTED"]
  /\ dispatchTable' = dispatchTable \ {t}
  /\ UNCHANGED <<invocations>>

InvokeTool(t) ==
  /\ t \in dispatchTable
  /\ toolState[t] = "REGISTERED"
  /\ invocations[t] < MaxInvocations
  /\ invocations' = [invocations EXCEPT ![t] = invocations[t] + 1]
  /\ UNCHANGED <<toolState, dispatchTable>>

Next ==
  \/ \E t \in Tools: ParseSpec(t)
  \/ \E t \in Tools: StartSandboxTest(t)
  \/ \E t \in Tools: PassSandboxTest(t)
  \/ \E t \in Tools: FailSandboxTest(t)
  \/ \E t \in Tools: InvokeTool(t)

(* Formal Invariants *)

RegistrationSafety ==
  \A t \in dispatchTable: toolState[t] = "REGISTERED"

NoRejectedInDispatch ==
  \A t \in Tools: (toolState[t] = "REJECTED") => (t \notin dispatchTable)

Spec == Init /\ [][Next]_<<toolState, dispatchTable, invocations>>

=============================================================================
