------------------------------ MODULE ShardedTransactionFabric ------------------------------
EXTENDS Naturals

CONSTANTS MaxAudits

VARIABLES
  phase,
  vnodeAssigned,
  participantsVoted,
  consensusCommitted,
  compensationsExecuted,
  auditsSealed

vars == <<phase, vnodeAssigned, participantsVoted, consensusCommitted, compensationsExecuted, auditsSealed>>

PHASES == {"IDLE", "VNODE_ROUTED", "PREPARED", "COMMITTED", "ABORTED", "SEALED"}

Init ==
  /\ phase = "IDLE"
  /\ vnodeAssigned = FALSE
  /\ participantsVoted = FALSE
  /\ consensusCommitted = FALSE
  /\ compensationsExecuted = FALSE
  /\ auditsSealed = 0

RouteVnode ==
  /\ phase = "IDLE"
  /\ auditsSealed < MaxAudits
  /\ phase' = "VNODE_ROUTED"
  /\ vnodeAssigned' = TRUE
  /\ UNCHANGED <<participantsVoted, consensusCommitted, compensationsExecuted, auditsSealed>>

PrepareTransaction ==
  /\ phase = "VNODE_ROUTED"
  /\ vnodeAssigned = TRUE
  /\ phase' = "PREPARED"
  /\ participantsVoted' = TRUE
  /\ UNCHANGED <<vnodeAssigned, consensusCommitted, compensationsExecuted, auditsSealed>>

CommitTransaction ==
  /\ phase = "PREPARED"
  /\ participantsVoted = TRUE
  /\ phase' = "COMMITTED"
  /\ consensusCommitted' = TRUE
  /\ UNCHANGED <<vnodeAssigned, participantsVoted, compensationsExecuted, auditsSealed>>

AbortTransaction ==
  /\ phase = "PREPARED"
  /\ phase' = "ABORTED"
  /\ consensusCommitted' = FALSE
  /\ compensationsExecuted' = TRUE
  /\ UNCHANGED <<vnodeAssigned, participantsVoted, auditsSealed>>

SealAudit ==
  /\ phase \in {"COMMITTED", "ABORTED"}
  /\ auditsSealed < MaxAudits
  /\ phase' = "SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<vnodeAssigned, participantsVoted, consensusCommitted, compensationsExecuted>>

ResetFabric ==
  /\ phase = "SEALED"
  /\ phase' = "IDLE"
  /\ vnodeAssigned' = FALSE
  /\ participantsVoted' = FALSE
  /\ consensusCommitted' = FALSE
  /\ compensationsExecuted' = FALSE
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ RouteVnode
  \/ PrepareTransaction
  \/ CommitTransaction
  \/ AbortTransaction
  \/ SealAudit
  \/ ResetFabric

TypeOK ==
  /\ phase \in PHASES
  /\ vnodeAssigned \in BOOLEAN
  /\ participantsVoted \in BOOLEAN
  /\ consensusCommitted \in BOOLEAN
  /\ compensationsExecuted \in BOOLEAN
  /\ auditsSealed \in 0..MaxAudits

AtomicCommitInvariant ==
  (phase = "COMMITTED") => (participantsVoted = TRUE /\ consensusCommitted = TRUE /\ compensationsExecuted = FALSE)

RollbackSoundnessInvariant ==
  (phase = "ABORTED") => (consensusCommitted = FALSE /\ compensationsExecuted = TRUE)

=============================================================================
