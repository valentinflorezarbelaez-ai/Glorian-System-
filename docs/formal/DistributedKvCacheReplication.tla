---------------- MODULE DistributedKvCacheReplication ----------------
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    MaxBlocks,          \* Max physical block capacity (e.g. 4)
    NumWorkers          \* Total distributed worker nodes (e.g. 2)

ASSUME MaxBlocks > 0 /\ NumWorkers > 0

Blocks == 1..MaxBlocks
Workers == 1..NumWorkers

VARIABLES
    allocatedBlocks,        \* Set of currently allocated physical blocks \subseteq Blocks
    pinnedBlocks,           \* Set of pinned immortal physical blocks \subseteq allocatedBlocks
    evictedBlocks,          \* Set of evicted physical blocks \subseteq Blocks
    replicatedBlocks,       \* Function [Workers -> SUBSET Blocks]
    speculativeBuffer       \* Set of speculatively prefetched blocks \subseteq allocatedBlocks

vars == <<allocatedBlocks, pinnedBlocks, evictedBlocks, replicatedBlocks, speculativeBuffer>>

TypeOK ==
    /\ allocatedBlocks \subseteq Blocks
    /\ pinnedBlocks \subseteq allocatedBlocks
    /\ evictedBlocks \subseteq Blocks
    /\ replicatedBlocks \in [Workers -> SUBSET Blocks]
    /\ speculativeBuffer \subseteq allocatedBlocks

Init ==
    /\ allocatedBlocks = {}
    /\ pinnedBlocks = {}
    /\ evictedBlocks = {}
    /\ replicatedBlocks = [w \in Workers |-> {}]
    /\ speculativeBuffer = {}

\* Allocate a new physical block, optionally pinned
AllocateBlock ==
    /\ Cardinality(allocatedBlocks) < MaxBlocks
    /\ \E b \in Blocks \ (allocatedBlocks \cup evictedBlocks):
        /\ \E isPinned \in BOOLEAN:
            /\ allocatedBlocks' = allocatedBlocks \cup {b}
            /\ pinnedBlocks' = IF isPinned THEN pinnedBlocks \cup {b} ELSE pinnedBlocks
            /\ UNCHANGED <<evictedBlocks, replicatedBlocks, speculativeBuffer>>

\* Replicate an allocated block to a target worker
ReplicateToWorker ==
    /\ \E b \in allocatedBlocks:
        /\ \E w \in Workers:
            /\ b \notin replicatedBlocks[w]
            /\ replicatedBlocks' = [replicatedBlocks EXCEPT ![w] = @ \cup {b}]
            /\ UNCHANGED <<allocatedBlocks, pinnedBlocks, evictedBlocks, speculativeBuffer>>

\* Speculatively prefetch an allocated block into active buffer
SpeculativePrefetch ==
    /\ \E b \in allocatedBlocks:
        /\ b \notin speculativeBuffer
        /\ speculativeBuffer' = speculativeBuffer \cup {b}
        /\ UNCHANGED <<allocatedBlocks, pinnedBlocks, evictedBlocks, replicatedBlocks>>

\* Evict an unpinned leaf block under memory pressure
EvictUnpinnedBlock ==
    /\ \E b \in allocatedBlocks \ pinnedBlocks:
        /\ allocatedBlocks' = allocatedBlocks \ {b}
        /\ evictedBlocks' = evictedBlocks \cup {b}
        /\ speculativeBuffer' = speculativeBuffer \ {b}
        /\ UNCHANGED <<pinnedBlocks, replicatedBlocks>>

Next ==
    \/ AllocateBlock
    \/ ReplicateToWorker
    \/ SpeculativePrefetch
    \/ EvictUnpinnedBlock

Spec == Init /\ [][Next]_vars

\* --- INVARIANTS ---

\* Total allocated physical blocks never exceed maximum capacity
MemoryCeilingBounded ==
    Cardinality(allocatedBlocks) <= MaxBlocks

\* Pinned immortal blocks (system prompts) are strictly protected against eviction
PinnedImmunity ==
    pinnedBlocks \cap evictedBlocks = {}

\* Replicated blocks reflect authentic historical or active block allocations
ReplicationIntegrity ==
    \A w \in Workers: replicatedBlocks[w] \subseteq (allocatedBlocks \cup evictedBlocks)

=============================================================================
