----------------------- MODULE SweBenchEvalFlywheel -----------------------
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Tasks, MaxAttempts

VARIABLES taskState, attempts, resolvedCount

TypeOK ==
  /\ taskState \in [Tasks -> {"PENDING", "STAGED", "PATCHED", "RESOLVED", "FAILED", "TIMEOUT"}]
  /\ attempts \in [Tasks -> 0..MaxAttempts]
  /\ resolvedCount \in 0..Cardinality(Tasks)

Init ==
  /\ taskState = [t \in Tasks |-> "PENDING"]
  /\ attempts = [t \in Tasks |-> 0]
  /\ resolvedCount = 0

StageTask(t) ==
  /\ taskState[t] = "PENDING"
  /\ taskState' = [taskState EXCEPT ![t] = "STAGED"]
  /\ UNCHANGED <<attempts, resolvedCount>>

ApplyPatch(t) ==
  /\ taskState[t] = "STAGED"
  /\ attempts[t] < MaxAttempts
  /\ taskState' = [taskState EXCEPT ![t] = "PATCHED"]
  /\ attempts' = [attempts EXCEPT ![t] = attempts[t] + 1]
  /\ UNCHANGED <<resolvedCount>>

OraclePass(t) ==
  /\ taskState[t] = "PATCHED"
  /\ taskState' = [taskState EXCEPT ![t] = "RESOLVED"]
  /\ resolvedCount' = resolvedCount + 1
  /\ UNCHANGED <<attempts>>

OracleFail(t) ==
  /\ taskState[t] = "PATCHED"
  /\ taskState' = [taskState EXCEPT ![t] = "FAILED"]
  /\ UNCHANGED <<attempts, resolvedCount>>

RetryTask(t) ==
  /\ taskState[t] = "FAILED"
  /\ attempts[t] < MaxAttempts
  /\ taskState' = [taskState EXCEPT ![t] = "STAGED"]
  /\ UNCHANGED <<attempts, resolvedCount>>

OracleTimeout(t) ==
  /\ taskState[t] = "PATCHED"
  /\ taskState' = [taskState EXCEPT ![t] = "TIMEOUT"]
  /\ UNCHANGED <<attempts, resolvedCount>>

Next ==
  \/ \E t \in Tasks: StageTask(t)
  \/ \E t \in Tasks: ApplyPatch(t)
  \/ \E t \in Tasks: OraclePass(t)
  \/ \E t \in Tasks: OracleFail(t)
  \/ \E t \in Tasks: RetryTask(t)
  \/ \E t \in Tasks: OracleTimeout(t)

(* Invariants *)

ResolvedConservation ==
  resolvedCount <= Cardinality(Tasks)

AttemptsBoundedness ==
  \A t \in Tasks: attempts[t] <= MaxAttempts

Spec == Init /\ [][Next]_<<taskState, attempts, resolvedCount>>

=============================================================================
