------------------------------ MODULE AgenticSwarmBft ------------------------------
EXTENDS Naturals

CONSTANTS TotalNodes, MaxFaulty, Quorum, MaxAudits

VARIABLES
  phase,
  preparesCount,
  commitsCount,
  byzantineFaults,
  consensusAchieved,
  slashingTriggered,
  auditsSealed

vars == <<phase, preparesCount, commitsCount, byzantineFaults, consensusAchieved, slashingTriggered, auditsSealed>>

PHASES == {"IDLE", "PROPOSED", "PREPARED", "COMMITTED", "SLASHED", "SEALED"}

Init ==
  /\ phase = "IDLE"
  /\ preparesCount = 0
  /\ commitsCount = 0
  /\ byzantineFaults = 0
  /\ consensusAchieved = FALSE
  /\ slashingTriggered = FALSE
  /\ auditsSealed = 0

Propose ==
  /\ phase = "IDLE"
  /\ auditsSealed < MaxAudits
  /\ phase' = "PROPOSED"
  /\ UNCHANGED <<preparesCount, commitsCount, byzantineFaults, consensusAchieved, slashingTriggered, auditsSealed>>

CastPrepareHonest ==
  /\ phase = "PROPOSED"
  /\ preparesCount < TotalNodes
  /\ preparesCount' = preparesCount + 1
  /\ UNCHANGED <<phase, commitsCount, byzantineFaults, consensusAchieved, slashingTriggered, auditsSealed>>

InjectByzantineFaultAndSlash ==
  /\ phase \in {"PROPOSED", "PREPARED"}
  /\ byzantineFaults < MaxFaulty
  /\ phase' = "SLASHED"
  /\ byzantineFaults' = byzantineFaults + 1
  /\ slashingTriggered' = TRUE
  /\ UNCHANGED <<preparesCount, commitsCount, consensusAchieved, auditsSealed>>

CheckPrepareQuorum ==
  /\ phase = "PROPOSED"
  /\ preparesCount >= Quorum
  /\ phase' = "PREPARED"
  /\ UNCHANGED <<preparesCount, commitsCount, byzantineFaults, consensusAchieved, slashingTriggered, auditsSealed>>

CastCommitHonest ==
  /\ phase = "PREPARED"
  /\ commitsCount < TotalNodes
  /\ commitsCount' = commitsCount + 1
  /\ UNCHANGED <<phase, preparesCount, byzantineFaults, consensusAchieved, slashingTriggered, auditsSealed>>

CheckCommitQuorum ==
  /\ phase = "PREPARED"
  /\ commitsCount >= Quorum
  /\ phase' = "COMMITTED"
  /\ consensusAchieved' = TRUE
  /\ UNCHANGED <<preparesCount, commitsCount, byzantineFaults, slashingTriggered, auditsSealed>>

SealSwarmAudit ==
  /\ phase \in {"COMMITTED", "SLASHED"}
  /\ auditsSealed < MaxAudits
  /\ phase' = "SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<preparesCount, commitsCount, byzantineFaults, consensusAchieved, slashingTriggered>>

ResetSwarm ==
  /\ phase = "SEALED"
  /\ phase' = "IDLE"
  /\ preparesCount' = 0
  /\ commitsCount' = 0
  /\ byzantineFaults' = 0
  /\ consensusAchieved' = FALSE
  /\ slashingTriggered' = FALSE
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ Propose
  \/ CastPrepareHonest
  \/ InjectByzantineFaultAndSlash
  \/ CheckPrepareQuorum
  \/ CastCommitHonest
  \/ CheckCommitQuorum
  \/ SealSwarmAudit
  \/ ResetSwarm

TypeOK ==
  /\ phase \in PHASES
  /\ preparesCount \in 0..TotalNodes
  /\ commitsCount \in 0..TotalNodes
  /\ byzantineFaults \in 0..MaxFaulty
  /\ consensusAchieved \in BOOLEAN
  /\ slashingTriggered \in BOOLEAN
  /\ auditsSealed \in 0..MaxAudits

ConsensusSafetyInvariant ==
  consensusAchieved => (commitsCount >= Quorum)

BoundedFaultInvariant ==
  byzantineFaults <= MaxFaulty

SlashingSafetyInvariant ==
  slashingTriggered => (byzantineFaults > 0)

=============================================================================
