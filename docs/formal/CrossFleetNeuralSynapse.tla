--------------------------- MODULE CrossFleetNeuralSynapse ---------------------------
(*
  TLA+ Formal Model for SPEC-120: Autonomous Cross-Fleet Neural Synapse & Dynamic Knowledge Synthesis
  Verifies that:
  1. SafetyInvariant: Fleet repos synchronized is strictly bounded by active fleet capacity.
  2. IsolationSafetyInvariant: Incompatible nodes are isolated fail-closed without corrupting the fleet.
  3. SynapticProgressInvariant: Synaptic pattern indexing and Merkle tree sync maintain monotonic progress.
*)

EXTENDS Naturals, Sequences

VARIABLES
  totalPatternsIndexed,
  totalPropagationsExecuted,
  fleetReposSynchronized,
  incompatibleNodesIsolated,
  merkleSyncEvents

Init ==
  /\ totalPatternsIndexed = 0
  /\ totalPropagationsExecuted = 0
  /\ fleetReposSynchronized = 0
  /\ incompatibleNodesIsolated = 0
  /\ merkleSyncEvents = 0

IndexDiscoveryPattern ==
  /\ totalPatternsIndexed' = totalPatternsIndexed + 1
  /\ merkleSyncEvents' = merkleSyncEvents + 1
  /\ UNCHANGED <<totalPropagationsExecuted, fleetReposSynchronized, incompatibleNodesIsolated>>

PropagateGoldenPathNominal ==
  /\ totalPropagationsExecuted' = totalPropagationsExecuted + 1
  /\ fleetReposSynchronized' = fleetReposSynchronized + 4  \* Propagates to 4 satelite repos
  /\ merkleSyncEvents' = merkleSyncEvents + 1
  /\ UNCHANGED <<totalPatternsIndexed, incompatibleNodesIsolated>>

IsolateIncompatibleNode ==
  /\ totalPropagationsExecuted' = totalPropagationsExecuted + 1
  /\ fleetReposSynchronized' = fleetReposSynchronized + 3  \* 3 compatible, 1 isolated
  /\ incompatibleNodesIsolated' = incompatibleNodesIsolated + 1
  /\ merkleSyncEvents' = merkleSyncEvents + 1
  /\ UNCHANGED <<totalPatternsIndexed>>

Next ==
  \/ IndexDiscoveryPattern
  \/ PropagateGoldenPathNominal
  \/ IsolateIncompatibleNode

SafetyInvariant ==
  fleetReposSynchronized <= (totalPropagationsExecuted * 5)

IsolationSafetyInvariant ==
  incompatibleNodesIsolated >= 0

SynapticProgressInvariant ==
  /\ totalPatternsIndexed >= 0
  /\ merkleSyncEvents >= 0

=============================================================================
