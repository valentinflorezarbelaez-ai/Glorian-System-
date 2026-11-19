------------------------- MODULE WorkStealingScheduler -------------------------
EXTENDS Naturals, Integers

CONSTANTS MaxTasks, MaxAudits

VARIABLES
  w0Queue,
  w1Queue,
  tasksSpawned,
  tasksCompleted,
  tasksStolen,
  phase,
  auditsSealed

vars == <<w0Queue, w1Queue, tasksSpawned, tasksCompleted, tasksStolen, phase, auditsSealed>>

PHASES == {
  "IDLE",
  "SPAWNED",
  "EXECUTED",
  "STOLEN",
  "AUDIT_SEALED"
}

Init ==
  /\ w0Queue = 0
  /\ w1Queue = 0
  /\ tasksSpawned = 0
  /\ tasksCompleted = 0
  /\ tasksStolen = 0
  /\ phase = "IDLE"
  /\ auditsSealed = 0

SpawnW0 ==
  /\ tasksSpawned < MaxTasks
  /\ phase \in {"IDLE", "EXECUTED", "STOLEN"}
  /\ w0Queue' = w0Queue + 1
  /\ tasksSpawned' = tasksSpawned + 1
  /\ phase' = "SPAWNED"
  /\ UNCHANGED <<w1Queue, tasksCompleted, tasksStolen, auditsSealed>>

SpawnW1 ==
  /\ tasksSpawned < MaxTasks
  /\ phase \in {"IDLE", "EXECUTED", "STOLEN"}
  /\ w1Queue' = w1Queue + 1
  /\ tasksSpawned' = tasksSpawned + 1
  /\ phase' = "SPAWNED"
  /\ UNCHANGED <<w0Queue, tasksCompleted, tasksStolen, auditsSealed>>

ExecuteLocalW0 ==
  /\ w0Queue > 0
  /\ phase \in {"SPAWNED", "EXECUTED", "STOLEN"}
  /\ w0Queue' = w0Queue - 1
  /\ tasksCompleted' = tasksCompleted + 1
  /\ phase' = "EXECUTED"
  /\ UNCHANGED <<w1Queue, tasksSpawned, tasksStolen, auditsSealed>>

ExecuteLocalW1 ==
  /\ w1Queue > 0
  /\ phase \in {"SPAWNED", "EXECUTED", "STOLEN"}
  /\ w1Queue' = w1Queue - 1
  /\ tasksCompleted' = tasksCompleted + 1
  /\ phase' = "EXECUTED"
  /\ UNCHANGED <<w0Queue, tasksSpawned, tasksStolen, auditsSealed>>

StealW1FromW0 ==
  /\ w1Queue = 0
  /\ w0Queue > 1
  /\ phase \in {"SPAWNED", "EXECUTED", "STOLEN"}
  /\ w0Queue' = w0Queue - 1
  /\ tasksStolen' = tasksStolen + 1
  /\ tasksCompleted' = tasksCompleted + 1
  /\ phase' = "STOLEN"
  /\ UNCHANGED <<w1Queue, tasksSpawned, auditsSealed>>

StealW0FromW1 ==
  /\ w0Queue = 0
  /\ w1Queue > 1
  /\ phase \in {"SPAWNED", "EXECUTED", "STOLEN"}
  /\ w1Queue' = w1Queue - 1
  /\ tasksStolen' = tasksStolen + 1
  /\ tasksCompleted' = tasksCompleted + 1
  /\ phase' = "STOLEN"
  /\ UNCHANGED <<w0Queue, tasksSpawned, auditsSealed>>

SealAudit ==
  /\ phase \in {"EXECUTED", "STOLEN"}
  /\ auditsSealed < MaxAudits
  /\ phase' = "AUDIT_SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<w0Queue, w1Queue, tasksSpawned, tasksCompleted, tasksStolen>>

ResetScheduler ==
  /\ phase = "AUDIT_SEALED"
  /\ phase' = "IDLE"
  /\ w0Queue' = 0
  /\ w1Queue' = 0
  /\ tasksSpawned' = 0
  /\ tasksCompleted' = 0
  /\ tasksStolen' = 0
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ SpawnW0
  \/ SpawnW1
  \/ ExecuteLocalW0
  \/ ExecuteLocalW1
  \/ StealW1FromW0
  \/ StealW0FromW1
  \/ SealAudit
  \/ ResetScheduler

TypeOK ==
  /\ w0Queue \in 0..MaxTasks
  /\ w1Queue \in 0..MaxTasks
  /\ tasksSpawned \in 0..MaxTasks
  /\ tasksCompleted \in 0..MaxTasks
  /\ tasksStolen \in 0..MaxTasks
  /\ phase \in PHASES
  /\ auditsSealed \in 0..MaxAudits

TaskConservation ==
  w0Queue + w1Queue + tasksCompleted = tasksSpawned

NoLostTasks ==
  tasksCompleted <= tasksSpawned

=============================================================================
