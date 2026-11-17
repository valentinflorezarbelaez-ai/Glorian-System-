------------------------ MODULE SimdQuantizedHnsw ------------------------
(*
  TLA+ Formal Mathematical Specification of SIMD Quantized HNSW Vector Index
  Governed by EOS System SPEC-314 / CHANGE-176
  Proves EntryPoint Validity, Layer Hierarchy Monotonicity, and Quantization Bound Invariants.
*)

EXTENDS Integers, FiniteSets

CONSTANTS
  Nodes,         \* Set of vector nodes to index, e.g. {1, 2, 3}
  MaxLayers,     \* Maximum hierarchy layers (e.g. 2)
  MaxNeighbors,  \* Maximum connections M per layer (e.g. 3)
  MaxQuantVal    \* Maximum quantized magnitude (e.g. 127)

QuantValues == { -MaxQuantVal, -1, 0, 1, MaxQuantVal }

VARIABLES
  inserted,      \* Set of currently indexed nodes
  entryPoint,    \* Top-level entry point node
  maxLevel,      \* Current maximum active layer
  adjList,       \* Adjacency function: [layer \in 0..MaxLayers, n \in Nodes |-> SUBSET Nodes]
  quantizedVal   \* Mapping: node -> integer in -128..127

vars == <<inserted, entryPoint, maxLevel, adjList, quantizedVal>>

-----------------------------------------------------------------------------

\* Initial State
Init ==
  /\ inserted = {}
  /\ entryPoint = 0
  /\ maxLevel = 0
  /\ adjList = [l \in 0..MaxLayers |-> [n \in Nodes |-> {}]]
  /\ quantizedVal = [n \in Nodes |-> 0]

\* Quantize continuous vector into bounded integer representation
QuantizeNode(n, val) ==
  /\ n \in Nodes
  /\ val \in QuantValues
  /\ quantizedVal' = [quantizedVal EXCEPT ![n] = val]
  /\ UNCHANGED <<inserted, entryPoint, maxLevel, adjList>>

\* Insert vector node into HNSW hierarchy with assigned level
InsertNode(n, lvl) ==
  /\ n \in Nodes \ inserted
  /\ lvl \in 0..MaxLayers
  /\ IF inserted = {}
     THEN /\ inserted' = {n}
          /\ entryPoint' = n
          /\ maxLevel' = lvl
          /\ adjList' = adjList
          /\ UNCHANGED quantizedVal
     ELSE /\ inserted' = inserted \union {n}
          /\ IF lvl > maxLevel
             THEN /\ entryPoint' = n
                  /\ maxLevel' = lvl
             ELSE /\ UNCHANGED <<entryPoint, maxLevel>>
          \* Connect to existing entry point at shared layers, or establish root entry
          /\ adjList' = [l \in 0..MaxLayers |->
               IF l <= lvl /\ l <= maxLevel
               THEN [m \in Nodes |->
                      IF m = n
                      THEN {entryPoint}
                      ELSE IF m = entryPoint
                           THEN adjList[l][m] \union {n}
                           ELSE adjList[l][m]]
               ELSE IF l <= lvl /\ l > maxLevel
               THEN [m \in Nodes |-> IF m = n THEN {} ELSE adjList[l][m]]
               ELSE adjList[l]]
          /\ UNCHANGED quantizedVal

\* Next State Transition
Next ==
  \/ (\E n \in Nodes, v \in QuantValues: QuantizeNode(n, v))
  \/ (\E n \in Nodes, l \in 0..MaxLayers: InsertNode(n, l))

-----------------------------------------------------------------------------

\* Safety Invariant 1: Valid EntryPoint Invariant
ValidEntryPoint ==
  inserted # {} => (entryPoint \in inserted)

\* Safety Invariant 2: Quantization Bounds Invariant
QuantizationBounds ==
  \A n \in Nodes: quantizedVal[n] >= -128 /\ quantizedVal[n] <= 127

\* Safety Invariant 3: Layer Hierarchy Monotonicity
\* A node present at layer l > 0 must have connections established at layer 0
LayerMonotonicity ==
  \A l \in 1..MaxLayers:
    \A n \in inserted:
      (adjList[l][n] # {}) => (adjList[0][n] # {})

\* Safety Invariant 4: Bounded Adjacency Degree
BoundedNeighbors ==
  \A l \in 0..MaxLayers:
    \A n \in Nodes:
      Cardinality(adjList[l][n]) <= MaxNeighbors

SafetyInvariant ==
  /\ ValidEntryPoint
  /\ QuantizationBounds
  /\ LayerMonotonicity
  /\ BoundedNeighbors

Spec ==
  Init /\ [][Next]_vars

=============================================================================
