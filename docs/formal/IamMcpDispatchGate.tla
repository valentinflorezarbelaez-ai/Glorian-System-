---- MODULE IamMcpDispatchGate ----
\* MCP tools/call IAM dispatch protocol (SPEC-184 FR-931..FR-934).
\* Ordering: receive -> IAM decision -> audit append -> dispatch (allow) or deny.
\* A request may only execute after an ALLOW decision AND a successful audit append.
\* An audit-append failure is fail-closed: the request never executes.
EXTENDS Naturals, FiniteSets

CONSTANTS Requests

VARIABLES phase, decision, audited, executed

vars == <<phase, decision, audited, executed>>

Decisions == {"none", "allow", "deny"}
Phases == {"received", "decided", "audited", "failed", "dispatched", "denied"}

TypeOK ==
  /\ phase \in [Requests -> Phases]
  /\ decision \in [Requests -> Decisions]
  /\ audited \in [Requests -> BOOLEAN]
  /\ executed \in [Requests -> BOOLEAN]

Init ==
  /\ phase = [r \in Requests |-> "received"]
  /\ decision = [r \in Requests |-> "none"]
  /\ audited = [r \in Requests |-> FALSE]
  /\ executed = [r \in Requests |-> FALSE]

\* IAM evaluates the request (no principal => deny, handled by the gate).
Decide(r, d) ==
  /\ phase[r] = "received"
  /\ d \in {"allow", "deny"}
  /\ phase' = [phase EXCEPT ![r] = "decided"]
  /\ decision' = [decision EXCEPT ![r] = d]
  /\ UNCHANGED <<audited, executed>>

\* Audit ledger append succeeds.
Audit(r) ==
  /\ phase[r] = "decided"
  /\ phase' = [phase EXCEPT ![r] = "audited"]
  /\ audited' = [audited EXCEPT ![r] = TRUE]
  /\ UNCHANGED <<decision, executed>>

\* Audit ledger append fails: fail-closed, never dispatched.
AuditFail(r) ==
  /\ phase[r] = "decided"
  /\ phase' = [phase EXCEPT ![r] = "failed"]
  /\ UNCHANGED <<decision, audited, executed>>

\* Dispatch only after audit and an ALLOW decision.
Dispatch(r) ==
  /\ phase[r] = "audited"
  /\ decision[r] = "allow"
  /\ phase' = [phase EXCEPT ![r] = "dispatched"]
  /\ executed' = [executed EXCEPT ![r] = TRUE]
  /\ UNCHANGED <<decision, audited>>

Deny(r) ==
  /\ phase[r] = "audited"
  /\ decision[r] = "deny"
  /\ phase' = [phase EXCEPT ![r] = "denied"]
  /\ UNCHANGED <<decision, audited, executed>>

Next ==
  \E r \in Requests:
    \/ \E d \in {"allow", "deny"}: Decide(r, d)
    \/ Audit(r)
    \/ AuditFail(r)
    \/ Dispatch(r)
    \/ Deny(r)

Spec == Init /\ [][Next]_vars

\* No execution without a successful audit append.
InvariantNoDispatchWithoutAudit ==
  \A r \in Requests: executed[r] => audited[r]

\* No execution without an ALLOW decision.
InvariantNoDispatchWithoutAllow ==
  \A r \in Requests: executed[r] => decision[r] = "allow"

\* Denied requests never execute.
InvariantDenyNeverExecutes ==
  \A r \in Requests: decision[r] = "deny" => ~executed[r]

\* Audit-append failure is fail-closed.
InvariantAuditFailureFailsClosed ==
  \A r \in Requests: phase[r] = "failed" => ~executed[r]

====
