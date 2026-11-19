------------------------------ MODULE AgenticContextEngine ------------------------------
EXTENDS Naturals

CONSTANTS MaxAudits

VARIABLES
  phase,
  injectionDetected,
  tokenBudgetPreserved,
  semanticRecallValid,
  quarantineTaintCount,
  auditsSealed

vars == <<phase, injectionDetected, tokenBudgetPreserved, semanticRecallValid, quarantineTaintCount, auditsSealed>>

PHASES == {"IDLE", "SANITIZED", "CHUNKED", "RETRIEVED", "COMPACTED", "TAINT_QUARANTINED", "SEALED"}

Init ==
  /\ phase = "IDLE"
  /\ injectionDetected = FALSE
  /\ tokenBudgetPreserved = FALSE
  /\ semanticRecallValid = FALSE
  /\ quarantineTaintCount = 0
  /\ auditsSealed = 0

SanitizePromptClean ==
  /\ phase = "IDLE"
  /\ auditsSealed < MaxAudits
  /\ phase' = "SANITIZED"
  /\ injectionDetected' = FALSE
  /\ quarantineTaintCount' = 0
  /\ UNCHANGED <<tokenBudgetPreserved, semanticRecallValid, auditsSealed>>

SanitizePromptInjection ==
  /\ phase = "IDLE"
  /\ auditsSealed < MaxAudits
  /\ phase' = "TAINT_QUARANTINED"
  /\ injectionDetected' = TRUE
  /\ quarantineTaintCount' = 1
  /\ UNCHANGED <<tokenBudgetPreserved, semanticRecallValid, auditsSealed>>

ResetFromTaint ==
  /\ phase = "TAINT_QUARANTINED"
  /\ phase' = "IDLE"
  /\ injectionDetected' = FALSE
  /\ quarantineTaintCount' = 0
  /\ UNCHANGED <<tokenBudgetPreserved, semanticRecallValid, auditsSealed>>

ChunkCorpus ==
  /\ phase = "SANITIZED"
  /\ ~injectionDetected
  /\ phase' = "CHUNKED"
  /\ UNCHANGED <<injectionDetected, tokenBudgetPreserved, semanticRecallValid, quarantineTaintCount, auditsSealed>>

IndexAndRetrieve ==
  /\ phase = "CHUNKED"
  /\ phase' = "RETRIEVED"
  /\ semanticRecallValid' = TRUE
  /\ UNCHANGED <<injectionDetected, tokenBudgetPreserved, quarantineTaintCount, auditsSealed>>

CompactContext ==
  /\ phase = "RETRIEVED"
  /\ semanticRecallValid = TRUE
  /\ phase' = "COMPACTED"
  /\ tokenBudgetPreserved' = TRUE
  /\ UNCHANGED <<injectionDetected, semanticRecallValid, quarantineTaintCount, auditsSealed>>

SealAuditReceipt ==
  /\ phase = "COMPACTED"
  /\ tokenBudgetPreserved = TRUE
  /\ semanticRecallValid = TRUE
  /\ ~injectionDetected
  /\ quarantineTaintCount = 0
  /\ phase' = "SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<injectionDetected, tokenBudgetPreserved, semanticRecallValid, quarantineTaintCount>>

ResetEngine ==
  /\ phase = "SEALED"
  /\ phase' = "IDLE"
  /\ injectionDetected' = FALSE
  /\ tokenBudgetPreserved' = FALSE
  /\ semanticRecallValid' = FALSE
  /\ quarantineTaintCount' = 0
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ SanitizePromptClean
  \/ SanitizePromptInjection
  \/ ResetFromTaint
  \/ ChunkCorpus
  \/ IndexAndRetrieve
  \/ CompactContext
  \/ SealAuditReceipt
  \/ ResetEngine

Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ phase \in PHASES
  /\ injectionDetected \in BOOLEAN
  /\ tokenBudgetPreserved \in BOOLEAN
  /\ semanticRecallValid \in BOOLEAN
  /\ quarantineTaintCount \in 0..1
  /\ auditsSealed \in 0..MaxAudits

ZeroTaintInvariant ==
  (phase = "SEALED") => (quarantineTaintCount = 0 /\ ~injectionDetected)

TokenBudgetInvariant ==
  (phase \in {"COMPACTED", "SEALED"}) => (tokenBudgetPreserved = TRUE)

SemanticRecallInvariant ==
  (phase \in {"RETRIEVED", "COMPACTED", "SEALED"}) => (semanticRecallValid = TRUE)

SafetyInvariant ==
  (phase = "SEALED") => (tokenBudgetPreserved /\ semanticRecallValid /\ ~injectionDetected /\ quarantineTaintCount = 0)

=============================================================================
