------------------------- MODULE ArchitecturalCanvasTopology -------------------------
EXTENDS Naturals, FiniteSets

CONSTANTS MaxNodes, MaxEdges

VARIABLES
  nodes,
  edges,
  layoutCalculated,
  blastRadiusCalculated,
  phase

vars == <<nodes, edges, layoutCalculated, blastRadiusCalculated, phase>>

PHASES == {
  "IDLE",
  "NODES_HARVESTED",
  "EDGE_MUTATED",
  "LAYOUT_COMPUTED",
  "BLAST_COMPUTED"
}

Init ==
  /\ nodes = {}
  /\ edges = {}
  /\ layoutCalculated = FALSE
  /\ blastRadiusCalculated = FALSE
  /\ phase = "IDLE"

HarvestNodes ==
  /\ phase \in {"IDLE", "BLAST_COMPUTED"}
  /\ Cardinality(nodes) < MaxNodes
  /\ \E n \in 1..MaxNodes:
       /\ n \notin nodes
       /\ nodes' = nodes \cup {n}
       /\ phase' = "NODES_HARVESTED"
       /\ UNCHANGED <<edges, layoutCalculated, blastRadiusCalculated>>

AddEdge ==
  /\ phase \in {"NODES_HARVESTED", "LAYOUT_COMPUTED"}
  /\ Cardinality(edges) < MaxEdges
  /\ \E u, v \in nodes:
       /\ u # v
       /\ <<u, v>> \notin edges
       /\ <<v, u>> \notin edges  \* Strict anti-symmetry: prevent simple 2-cycles
       /\ edges' = edges \cup {<<u, v>>}
       /\ phase' = "EDGE_MUTATED"
       /\ layoutCalculated' = FALSE
       /\ UNCHANGED <<nodes, blastRadiusCalculated>>

ComputeLayout ==
  /\ phase \in {"NODES_HARVESTED", "EDGE_MUTATED"}
  /\ Cardinality(nodes) > 0
  /\ layoutCalculated' = TRUE
  /\ phase' = "LAYOUT_COMPUTED"
  /\ UNCHANGED <<nodes, edges, blastRadiusCalculated>>

ComputeBlastRadius ==
  /\ phase = "LAYOUT_COMPUTED"
  /\ blastRadiusCalculated' = TRUE
  /\ phase' = "BLAST_COMPUTED"
  /\ UNCHANGED <<nodes, edges, layoutCalculated>>

ResetCanvas ==
  /\ phase = "BLAST_COMPUTED"
  /\ nodes' = {}
  /\ edges' = {}
  /\ layoutCalculated' = FALSE
  /\ blastRadiusCalculated' = FALSE
  /\ phase' = "IDLE"

Next ==
  \/ HarvestNodes
  \/ AddEdge
  \/ ComputeLayout
  \/ ComputeBlastRadius
  \/ ResetCanvas

TypeOK ==
  /\ nodes \subseteq 1..MaxNodes
  /\ edges \subseteq (nodes \times nodes)
  /\ layoutCalculated \in BOOLEAN
  /\ blastRadiusCalculated \in BOOLEAN
  /\ phase \in PHASES

AcyclicInvariant ==
  \A e \in edges:
    /\ e[1] # e[2]
    /\ <<e[2], e[1]>> \notin edges

LayoutRequiresNodes ==
  layoutCalculated => Cardinality(nodes) > 0

=============================================================================
