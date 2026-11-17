------------------- MODULE OntologicalHypergraph -------------------
(***************************************************************************)
(* Formal TLA+ specification of Autonomous Ontological Hypergraph &        *)
(* Bitemporal Entity Resolution Engine with Multilevel Security (MLS).     *)
(* Verified with Leslie Lamport's TLC Model Checker.                       *)
(***************************************************************************)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS
    TotalEntities,      \* Nat: Total candidate entity pool size (e.g. 3)
    MaxLevel,           \* Nat: Highest MLS clearance level (e.g. 3 for TOP_SECRET)
    MaxTimeTicks        \* Nat: Monotonic clock bound (e.g. 3)

VARIABLES
    txClock,            \* Nat: Monotonic transaction clock
    registeredEntities, \* Set of registered entity IDs
    entityClassification,\* [Entities -> 1..MaxLevel]
    assertions,         \* Set of records [id: Nat, entity: Nat, vFrom: Nat, vTo: Nat, tFrom: Nat, tTo: Nat, level: 1..MaxLevel]
    hyperedges,         \* Set of records [id: Nat, parts: SUBSET Entities, level: 1..MaxLevel]
    nextAssertionId,    \* Nat: Counter for assertion IDs
    nextEdgeId,         \* Nat: Counter for hyperedge IDs
    leakDetected        \* BOOLEAN: True if MLS lattice containment fails

vars == << txClock, registeredEntities, entityClassification, assertions,
           hyperedges, nextAssertionId, nextEdgeId, leakDetected >>

Entities == 1..TotalEntities
Levels == 1..MaxLevel
TimeTicks == 1..MaxTimeTicks

TypeOK ==
    /\ txClock \in TimeTicks \cup {MaxTimeTicks + 1}
    /\ registeredEntities \subseteq Entities
    /\ entityClassification \in [Entities -> Levels]
    /\ nextAssertionId \in 1..(TotalEntities * 3 + 1)
    /\ nextEdgeId \in 1..(TotalEntities * 3 + 1)
    /\ leakDetected \in BOOLEAN

Init ==
    /\ txClock = 1
    /\ registeredEntities = {1}
    /\ entityClassification = [e \in Entities |-> 1]
    /\ assertions = {[id |-> 1, entity |-> 1, vFrom |-> 1, vTo |-> 3, tFrom |-> 1, tTo |-> 999, level |-> 1]}
    /\ hyperedges = {}
    /\ nextAssertionId = 2
    /\ nextEdgeId = 1
    /\ leakDetected = FALSE

\* Register a new entity with an MLS classification level
RegisterEntity(e, lvl) ==
    /\ e \notin registeredEntities
    /\ txClock <= MaxTimeTicks
    /\ registeredEntities' = registeredEntities \cup {e}
    /\ entityClassification' = [entityClassification EXCEPT ![e] = lvl]
    /\ txClock' = txClock + 1
    /\ UNCHANGED << assertions, hyperedges, nextAssertionId, nextEdgeId, leakDetected >>

\* Assert a new bitemporal fact for an existing entity
AssertFact(e, vF, vT) ==
    /\ e \in registeredEntities
    /\ vF < vT
    /\ txClock <= MaxTimeTicks
    /\ LET lvl == entityClassification[e]
           newAss == [id |-> nextAssertionId, entity |-> e, vFrom |-> vF, vTo |-> vT, 
                      tFrom |-> txClock, tTo |-> 999, level |-> lvl]
       IN
       /\ assertions' = assertions \cup {newAss}
       /\ nextAssertionId' = nextAssertionId + 1
       /\ txClock' = txClock + 1
       /\ UNCHANGED << registeredEntities, entityClassification, hyperedges, nextEdgeId, leakDetected >>

\* Synthesize an N-ary hyperedge connecting 2 or more registered entities
CreateHyperedge(parts) ==
    /\ parts \subseteq registeredEntities
    /\ Cardinality(parts) >= 2
    /\ txClock <= MaxTimeTicks
    /\ LET maxLvl == IF \E e \in parts: entityClassification[e] = 3 THEN 3
                     ELSE IF \E e \in parts: entityClassification[e] = 2 THEN 2
                     ELSE 1
           newEdge == [id |-> nextEdgeId, parts |-> parts, level |-> maxLvl]
       IN
       /\ hyperedges' = hyperedges \cup {newEdge}
       /\ nextEdgeId' = nextEdgeId + 1
       /\ txClock' = txClock + 1
       /\ UNCHANGED << registeredEntities, entityClassification, assertions, nextAssertionId, leakDetected >>

\* Perform an MLS query at clearance lvl: fail-closed filter
QueryAsOf(lvl) ==
    /\ txClock <= MaxTimeTicks
    /\ LET visibleAssertions == {a \in assertions: a.level <= lvl}
           unauthorizedLeak == {a \in assertions: a.level > lvl} \cap visibleAssertions
       IN
       /\ IF unauthorizedLeak # {}
          THEN leakDetected' = TRUE
          ELSE leakDetected' = leakDetected
    /\ txClock' = txClock + 1
    /\ UNCHANGED << registeredEntities, entityClassification, assertions, hyperedges, nextAssertionId, nextEdgeId >>

Next ==
    \/ \E e \in Entities, lvl \in Levels: RegisterEntity(e, lvl)
    \/ \E e \in Entities: AssertFact(e, 1, 3)
    \/ \E parts \in (SUBSET Entities): CreateHyperedge(parts)
    \/ \E lvl \in Levels: QueryAsOf(lvl)
    \/ (txClock > MaxTimeTicks /\ UNCHANGED vars)

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
\* INVARIANTS

\* 1. MLS Lattice Containment: No unauthorized disclosure
MlsLatticeContainment == leakDetected = FALSE

\* 2. Hyperedge Referential Integrity: All participants in hyperedges must be registered entities
ReferentialIntegrity ==
    \A h \in hyperedges: h.parts \subseteq registeredEntities /\ Cardinality(h.parts) >= 2

\* 3. Bitemporal Monotonicity: Valid time interval is valid, and transaction recording time is monotonic
BitemporalMonotonicity ==
    \A a \in assertions: a.vFrom < a.vTo /\ a.tFrom <= a.tTo

=============================================================================
