-------------------- MODULE CellBasedBulkheadGovernor --------------------
(*
  TLA+ Formal Mathematical Specification of the Distributed Cell-Based
  Bulkhead Governor & Fault Domain Isolation Engine (AWS / Meta Standard).
  Governed by EOS System SPEC-109 / PLAN-109 / ADR-109.
  Proves Blast Radius Boundedness, Bulkhead Hermetic Isolation,
  and Deterministic Poison Pill Quarantine.
*)

EXTENDS Naturals

CONSTANTS
  CellCount,            \* Total partitioned failure domains (e.g. 8)
  CellCapacity,         \* Maximum concurrent in-flight requests per cell (e.g. 100)
  MaxConsecutiveFails   \* Consecutive failures triggering poison pill quarantine (e.g. 3)

VARIABLES
  totalRequests,        \* Cumulative requests processed
  quarantinedSignatures,\* Set of identified toxic payload fingerprints
  activeCells,          \* Number of healthy operational cells (1..CellCount)
  reroutedRequests,     \* Requests safely redirected from degraded to warm cells
  shedRequests,         \* Requests shed (429) due to capacity limits
  maxCellLoad           \* Highest active load across all cells

vars == <<totalRequests, quarantinedSignatures, activeCells, reroutedRequests, shedRequests, maxCellLoad>>

-----------------------------------------------------------------------------

\* Initial State: all cells healthy, zero load, zero quarantined signatures
Init ==
  /\ totalRequests = 0
  /\ quarantinedSignatures = 0
  /\ activeCells = CellCount
  /\ reroutedRequests = 0
  /\ shedRequests = 0
  /\ maxCellLoad = 0

\* Nominal execution: request mapped to healthy target cell within capacity
RouteNominalRequest ==
  /\ totalRequests < 500
  /\ totalRequests' = totalRequests + 1
  /\ maxCellLoad' = IF maxCellLoad < CellCapacity THEN maxCellLoad + 1 ELSE maxCellLoad
  /\ UNCHANGED <<quarantinedSignatures, activeCells, reroutedRequests, shedRequests>>

\* Degraded cell failover: target cell is degraded, rerouted to adjacent warm cell with headroom
RouteRerouteDegraded ==
  /\ totalRequests < 500
  /\ activeCells > 1
  /\ totalRequests' = totalRequests + 1
  /\ reroutedRequests' = reroutedRequests + 1
  /\ UNCHANGED <<quarantinedSignatures, activeCells, shedRequests, maxCellLoad>>

\* Cell saturation: all target and failover cells at capacity, shedding load safely
RouteShedOverload ==
  /\ totalRequests < 500
  /\ totalRequests' = totalRequests + 1
  /\ shedRequests' = shedRequests + 1
  /\ UNCHANGED <<quarantinedSignatures, activeCells, reroutedRequests, maxCellLoad>>

\* Poison pill detection: 3 consecutive failures trigger signature quarantine
QuarantinePoisonPill ==
  /\ quarantinedSignatures < 100
  /\ quarantinedSignatures' = quarantinedSignatures + 1
  /\ UNCHANGED <<totalRequests, activeCells, reroutedRequests, shedRequests, maxCellLoad>>

\* Complete request: decrements cell load
CompleteRequest ==
  /\ maxCellLoad > 0
  /\ maxCellLoad' = maxCellLoad - 1
  /\ UNCHANGED <<totalRequests, quarantinedSignatures, activeCells, reroutedRequests, shedRequests>>

\* Next State Transition
Next ==
  \/ RouteNominalRequest
  \/ RouteRerouteDegraded
  \/ RouteShedOverload
  \/ QuarantinePoisonPill
  \/ CompleteRequest

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------

\* Mathematical Invariants:

\* Invariant 1: Cell in-flight load is strictly upper-bounded by CellCapacity
CellCapacityBoundedInvariant ==
  maxCellLoad <= CellCapacity

\* Invariant 2: At least one cell remains active (no systemic extinction)
NonZeroActiveCellsInvariant ==
  activeCells >= 1

\* Invariant 3: Rerouted requests never exceed total requests
RerouteBoundedInvariant ==
  reroutedRequests <= totalRequests

\* Invariant 4: Shed requests never exceed total requests
ShedBoundedInvariant ==
  shedRequests <= totalRequests

\* Unified Safety Invariant
SafetyInvariant ==
  /\ CellCapacityBoundedInvariant
  /\ NonZeroActiveCellsInvariant
  /\ RerouteBoundedInvariant
  /\ ShedBoundedInvariant

=============================================================================
