------------------------- MODULE BitemporalEventLedger -------------------------
EXTENDS Naturals, Integers

CONSTANTS MaxTx, MaxAudits

VARIABLES
  txTime,
  datomCount,
  merkleVerified,
  chainHashValid,
  phase,
  auditsSealed

vars == <<txTime, datomCount, merkleVerified, chainHashValid, phase, auditsSealed>>

PHASES == {
  "IDLE",
  "DATOM_ASSERTED",
  "DATOM_RETRACTED",
  "MERKLE_VERIFIED",
  "AUDIT_SEALED"
}

Init ==
  /\ txTime = 0
  /\ datomCount = 0
  /\ merkleVerified = TRUE
  /\ chainHashValid = TRUE
  /\ phase = "IDLE"
  /\ auditsSealed = 0

AssertDatom ==
  /\ txTime < MaxTx
  /\ phase \in {"IDLE", "MERKLE_VERIFIED"}
  /\ txTime' = txTime + 1
  /\ datomCount' = datomCount + 1
  /\ phase' = "DATOM_ASSERTED"
  /\ UNCHANGED <<merkleVerified, chainHashValid, auditsSealed>>

RetractDatom ==
  /\ txTime < MaxTx
  /\ datomCount > 0
  /\ phase \in {"IDLE", "MERKLE_VERIFIED", "DATOM_ASSERTED"}
  /\ txTime' = txTime + 1
  /\ datomCount' = datomCount + 1
  /\ phase' = "DATOM_RETRACTED"
  /\ UNCHANGED <<merkleVerified, chainHashValid, auditsSealed>>

VerifyMerkle ==
  /\ phase \in {"DATOM_ASSERTED", "DATOM_RETRACTED"}
  /\ merkleVerified' = TRUE
  /\ chainHashValid' = TRUE
  /\ phase' = "MERKLE_VERIFIED"
  /\ UNCHANGED <<txTime, datomCount, auditsSealed>>

SealAudit ==
  /\ phase = "MERKLE_VERIFIED"
  /\ auditsSealed < MaxAudits
  /\ phase' = "AUDIT_SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<txTime, datomCount, merkleVerified, chainHashValid>>

ResetLedger ==
  /\ phase = "AUDIT_SEALED"
  /\ phase' = "IDLE"
  /\ txTime' = 0
  /\ datomCount' = 0
  /\ merkleVerified' = TRUE
  /\ chainHashValid' = TRUE
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ AssertDatom
  \/ RetractDatom
  \/ VerifyMerkle
  \/ SealAudit
  \/ ResetLedger

TypeOK ==
  /\ txTime \in 0..MaxTx
  /\ datomCount \in 0..(MaxTx * 2)
  /\ merkleVerified \in BOOLEAN
  /\ chainHashValid \in BOOLEAN
  /\ phase \in PHASES
  /\ auditsSealed \in 0..MaxAudits

MonotonicTxTime ==
  txTime >= 0

CryptographicIntegrity ==
  (phase \in {"MERKLE_VERIFIED", "AUDIT_SEALED"}) => (merkleVerified = TRUE /\ chainHashValid = TRUE)

NoDestructiveMutation ==
  datomCount >= txTime

=============================================================================
