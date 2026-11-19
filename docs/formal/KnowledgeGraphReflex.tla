------------------------------ MODULE KnowledgeGraphReflex ------------------------------
EXTENDS Naturals

CONSTANTS MaxNodes, MaxEdges, MaxCascadeDepth, MaxAudits

VARIABLES
  phase,
  nodeCount,
  edgeCount,
  hasCycles,
  topologicalSortValid,
  blastRadiusEvaluated,
  reflexCascadeDepth,
  auditsSealed

vars == <<phase, nodeCount, edgeCount, hasCycles, topologicalSortValid, blastRadiusEvaluated, reflexCascadeDepth, auditsSealed>>

PHASES == {"IDLE", "NODES_ADDED", "EDGES_LINKED", "CYCLES_CHECKED", "SORTED", "BLAST_COMPUTED", "REFLEX_TRIGGERED", "SEALED"}

Init ==
  /\ phase = "IDLE"
  /\ nodeCount = 0
  /\ edgeCount = 0
  /\ hasCycles = FALSE
  /\ topologicalSortValid = FALSE
  /\ blastRadiusEvaluated = FALSE
  /\ reflexCascadeDepth = 0
  /\ auditsSealed = 0

AddNodes ==
  /\ phase = "IDLE"
  /\ auditsSealed < MaxAudits
  /\ phase' = "NODES_ADDED"
  /\ nodeCount' = MaxNodes
  /\ UNCHANGED <<edgeCount, hasCycles, topologicalSortValid, blastRadiusEvaluated, reflexCascadeDepth, auditsSealed>>

LinkEdgesAcyclic ==
  /\ phase = "NODES_ADDED"
  /\ phase' = "EDGES_LINKED"
  /\ edgeCount' = MaxEdges
  /\ hasCycles' = FALSE
  /\ UNCHANGED <<nodeCount, topologicalSortValid, blastRadiusEvaluated, reflexCascadeDepth, auditsSealed>>

LinkEdgesCyclic ==
  /\ phase = "NODES_ADDED"
  /\ phase' = "EDGES_LINKED"
  /\ edgeCount' = MaxEdges
  /\ hasCycles' = TRUE
  /\ UNCHANGED <<nodeCount, topologicalSortValid, blastRadiusEvaluated, reflexCascadeDepth, auditsSealed>>

DetectCycles ==
  /\ phase = "EDGES_LINKED"
  /\ phase' = "CYCLES_CHECKED"
  /\ UNCHANGED <<nodeCount, edgeCount, hasCycles, topologicalSortValid, blastRadiusEvaluated, reflexCascadeDepth, auditsSealed>>

PerformTopologicalSort ==
  /\ phase = "CYCLES_CHECKED"
  /\ phase' = "SORTED"
  /\ topologicalSortValid' = ~hasCycles
  /\ UNCHANGED <<nodeCount, edgeCount, hasCycles, blastRadiusEvaluated, reflexCascadeDepth, auditsSealed>>

ComputeBlastRadius ==
  /\ phase = "SORTED"
  /\ phase' = "BLAST_COMPUTED"
  /\ blastRadiusEvaluated' = TRUE
  /\ UNCHANGED <<nodeCount, edgeCount, hasCycles, topologicalSortValid, reflexCascadeDepth, auditsSealed>>

TriggerReflexStep ==
  /\ phase \in {"BLAST_COMPUTED", "REFLEX_TRIGGERED"}
  /\ reflexCascadeDepth < MaxCascadeDepth
  /\ phase' = "REFLEX_TRIGGERED"
  /\ reflexCascadeDepth' = reflexCascadeDepth + 1
  /\ UNCHANGED <<nodeCount, edgeCount, hasCycles, topologicalSortValid, blastRadiusEvaluated, auditsSealed>>

SealKnowledgeGraphAudit ==
  /\ phase = "REFLEX_TRIGGERED"
  /\ auditsSealed < MaxAudits
  /\ phase' = "SEALED"
  /\ auditsSealed' = auditsSealed + 1
  /\ UNCHANGED <<nodeCount, edgeCount, hasCycles, topologicalSortValid, blastRadiusEvaluated, reflexCascadeDepth>>

ResetGraphEngine ==
  /\ phase = "SEALED"
  /\ phase' = "IDLE"
  /\ nodeCount' = 0
  /\ edgeCount' = 0
  /\ hasCycles' = FALSE
  /\ topologicalSortValid' = FALSE
  /\ blastRadiusEvaluated' = FALSE
  /\ reflexCascadeDepth' = 0
  /\ UNCHANGED <<auditsSealed>>

Next ==
  \/ AddNodes
  \/ LinkEdgesAcyclic
  \/ LinkEdgesCyclic
  \/ DetectCycles
  \/ PerformTopologicalSort
  \/ ComputeBlastRadius
  \/ TriggerReflexStep
  \/ SealKnowledgeGraphAudit
  \/ ResetGraphEngine

TypeOK ==
  /\ phase \in PHASES
  /\ nodeCount \in 0..MaxNodes
  /\ edgeCount \in 0..MaxEdges
  /\ hasCycles \in BOOLEAN
  /\ topologicalSortValid \in BOOLEAN
  /\ blastRadiusEvaluated \in BOOLEAN
  /\ reflexCascadeDepth \in 0..MaxCascadeDepth
  /\ auditsSealed \in 0..MaxAudits

BoundedCascadeInvariant ==
  reflexCascadeDepth <= MaxCascadeDepth

AcyclicDagConsistencyInvariant ==
  (phase = "SORTED" /\ ~hasCycles) => topologicalSortValid

BlastRadiusSoundnessInvariant ==
  (phase = "BLAST_COMPUTED") => blastRadiusEvaluated

=============================================================================
