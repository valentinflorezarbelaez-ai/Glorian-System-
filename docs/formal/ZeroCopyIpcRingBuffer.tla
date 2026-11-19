------------------------- MODULE ZeroCopyIpcRingBuffer -------------------------
EXTENDS Naturals, Integers

CONSTANTS BufferCapacity, MaxOperations, MaxAudits

VARIABLES
  headSeq,
  tailSeq,
  availableCount,
  tornReadsCount,
  phase,
  auditsSealed

vars == <<headSeq, tailSeq, availableCount, tornReadsCount, phase, auditsSealed>>

PHASES == {
  "IDLE",
  "ENQUEUEING",
  "ENQUEUED",
  "DEQUEUEING",
  "DEQUEUED",
  "AUDIT_SEALED"
}

Init ==
  /\ headSeq = 0
  /\ tailSeq = 0
  /\ availableCount = 0
  /\ tornReadsCount = 0
  /\ phase = "IDLE"
  /\ auditsSealed = 0

Enqueue ==
  /\ phase \in {"IDLE", "DEQUEUED"}
  /\ headSeq < MaxOperations
  /\ (headSeq - tailSeq) < BufferCapacity
  /\ phase' = "ENQUEUED"
  /\ headSeq' = headSeq + 1
  /\ availableCount' = (headSeq + 1) - tailSeq
  /\ UNCHANGED <<tailSeq, tornReadsCount, auditsSealed>>

Dequeue ==
  /\ phase \in {"IDLE", "ENQUEUED"}
  /\ tailSeq < headSeq
  /\ phase' = "DEQUEUED"
  /\ tailSeq' = tailSeq + 1
  /\ availableCount' = headSeq - (tailSeq + 1)
  /\ UNCHANGED <<headSeq, tornReadsCount, auditsSealed>>

SealAudit ==
  /\ phase \in {"ENQUEUED", "DEQUEUED"}
  /\ auditsSealed < MaxAudits
  /\ phase' = "AUDIT_SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<headSeq, tailSeq, availableCount, tornReadsCount>>

ResetBuffer ==
  /\ phase = "AUDIT_SEALED"
  /\ phase' = "IDLE"
  /\ headSeq' = 0
  /\ tailSeq' = 0
  /\ availableCount' = 0
  /\ tornReadsCount' = 0
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ Enqueue
  \/ Dequeue
  \/ SealAudit
  \/ ResetBuffer

TypeOK ==
  /\ headSeq \in 0..MaxOperations
  /\ tailSeq \in 0..MaxOperations
  /\ availableCount \in 0..BufferCapacity
  /\ tornReadsCount \in 0..MaxOperations
  /\ phase \in PHASES
  /\ auditsSealed \in 0..MaxAudits

SequenceMonotonicity ==
  tailSeq <= headSeq

CapacityPreserved ==
  (headSeq - tailSeq) <= BufferCapacity

NoTornReads ==
  tornReadsCount = 0

=============================================================================
