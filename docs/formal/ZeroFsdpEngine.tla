---------------- MODULE ZeroFsdpEngine ----------------
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    NumWorkers,     \* P (e.g. 2)
    NumLayers,      \* L (e.g. 2)
    ParamsPerLayer  \* Psi_l (e.g. 4)

VARIABLES
    workerPhase,        \* Function: w \in Workers -> "INIT" | "FWD" | "BWD" | "OPT_STEP" | "DONE"
    currentLayer,       \* Function: w \in Workers -> 0..(NumLayers + 1)
    transientBuffer,    \* Function: w \in Workers -> Nat (elements materialized in transient gather buffer)
    shardedParams,      \* Function: w \in Workers -> Nat (partitioned parameters owned by worker)
    shardedOptStates,   \* Function: w \in Workers -> Nat (partitioned optimizer states: 2 * shardedParams)
    offloadedToHost     \* Function: w \in Workers -> BOOLEAN

Workers == 0..(NumWorkers - 1)
TotalParams == NumLayers * ParamsPerLayer

vars == <<workerPhase, currentLayer, transientBuffer, shardedParams, shardedOptStates, offloadedToHost>>

TypeOK ==
    /\ DOMAIN workerPhase = Workers
    /\ DOMAIN currentLayer = Workers
    /\ DOMAIN transientBuffer = Workers
    /\ DOMAIN shardedParams = Workers
    /\ DOMAIN shardedOptStates = Workers
    /\ DOMAIN offloadedToHost = Workers
    /\ \A w \in Workers : workerPhase[w] \in {"INIT", "FWD", "BWD", "OPT_STEP", "DONE"}
    /\ \A w \in Workers : currentLayer[w] \in 0..(NumLayers + 1)
    /\ \A w \in Workers : transientBuffer[w] \in 0..ParamsPerLayer
    /\ \A w \in Workers : shardedParams[w] = TotalParams \div NumWorkers
    /\ \A w \in Workers : shardedOptStates[w] = (TotalParams \div NumWorkers) * 2
    /\ \A w \in Workers : offloadedToHost[w] \in {TRUE, FALSE}

Init ==
    /\ workerPhase = [w \in Workers |-> "INIT"]
    /\ currentLayer = [w \in Workers |-> 1]
    /\ transientBuffer = [w \in Workers |-> 0]
    /\ shardedParams = [w \in Workers |-> TotalParams \div NumWorkers]
    /\ shardedOptStates = [w \in Workers |-> (TotalParams \div NumWorkers) * 2]
    /\ offloadedToHost = [w \in Workers |-> FALSE]

\* Start forward pass
StartForward(w) ==
    /\ workerPhase[w] = "INIT"
    /\ workerPhase' = [workerPhase EXCEPT ![w] = "FWD"]
    /\ currentLayer' = [currentLayer EXCEPT ![w] = 1]
    /\ UNCHANGED <<transientBuffer, shardedParams, shardedOptStates, offloadedToHost>>

\* ZeRO-3 / FSDP JIT All-Gather of layer parameters for forward pass
AllGatherLayerForward(w) ==
    /\ workerPhase[w] = "FWD"
    /\ currentLayer[w] \in 1..NumLayers
    /\ transientBuffer[w] = 0
    /\ transientBuffer' = [transientBuffer EXCEPT ![w] = ParamsPerLayer]
    /\ UNCHANGED <<workerPhase, currentLayer, shardedParams, shardedOptStates, offloadedToHost>>

\* Compute layer forward and purge transient gathered buffer immediately
ComputeAndPurgeForward(w) ==
    /\ workerPhase[w] = "FWD"
    /\ currentLayer[w] \in 1..NumLayers
    /\ transientBuffer[w] = ParamsPerLayer
    /\ transientBuffer' = [transientBuffer EXCEPT ![w] = 0]
    /\ currentLayer' = [currentLayer EXCEPT ![w] = currentLayer[w] + 1]
    /\ workerPhase' = [workerPhase EXCEPT ![w] = IF currentLayer[w] = NumLayers THEN "BWD" ELSE "FWD"]
    /\ UNCHANGED <<shardedParams, shardedOptStates, offloadedToHost>>

\* ZeRO-3 / FSDP JIT All-Gather of layer parameters for backward pass
AllGatherLayerBackward(w) ==
    /\ workerPhase[w] = "BWD"
    /\ currentLayer[w] \in 2..(NumLayers + 1)
    /\ transientBuffer[w] = 0
    /\ transientBuffer' = [transientBuffer EXCEPT ![w] = ParamsPerLayer]
    /\ UNCHANGED <<workerPhase, currentLayer, shardedParams, shardedOptStates, offloadedToHost>>

\* Compute layer backward, Reduce-Scatter gradients, and purge transient buffer
ComputeAndPurgeBackward(w) ==
    /\ workerPhase[w] = "BWD"
    /\ currentLayer[w] \in 2..(NumLayers + 1)
    /\ transientBuffer[w] = ParamsPerLayer
    /\ transientBuffer' = [transientBuffer EXCEPT ![w] = 0]
    /\ currentLayer' = [currentLayer EXCEPT ![w] = currentLayer[w] - 1]
    /\ workerPhase' = [workerPhase EXCEPT ![w] = IF currentLayer[w] = 2 THEN "OPT_STEP" ELSE "BWD"]
    /\ UNCHANGED <<shardedParams, shardedOptStates, offloadedToHost>>

\* ZeRO optimizer step on sharded slice
OptimizerStep(w) ==
    /\ workerPhase[w] = "OPT_STEP"
    /\ transientBuffer[w] = 0
    /\ workerPhase' = [workerPhase EXCEPT ![w] = "DONE"]
    /\ UNCHANGED <<currentLayer, transientBuffer, shardedParams, shardedOptStates, offloadedToHost>>

\* Optional toggle host offloading
ToggleHostOffloading(w) ==
    /\ workerPhase[w] \in {"INIT", "OPT_STEP", "DONE"}
    /\ offloadedToHost' = [offloadedToHost EXCEPT ![w] = ~offloadedToHost[w]]
    /\ UNCHANGED <<workerPhase, currentLayer, transientBuffer, shardedParams, shardedOptStates>>

Next ==
    \/ \E w \in Workers : StartForward(w)
    \/ \E w \in Workers : AllGatherLayerForward(w)
    \/ \E w \in Workers : ComputeAndPurgeForward(w)
    \/ \E w \in Workers : AllGatherLayerBackward(w)
    \/ \E w \in Workers : ComputeAndPurgeBackward(w)
    \/ \E w \in Workers : OptimizerStep(w)
    \/ \E w \in Workers : ToggleHostOffloading(w)

Spec == Init /\ [][Next]_vars

\* --- INVARIANTS ---

\* Parameter conservation: partitioned parameter sum equals total parameters
ParameterConservation ==
    \A w \in Workers : shardedParams[w] * NumWorkers = TotalParams

\* Memory ceiling bounded: transient buffer never exceeds single layer parameters,
\* avoiding full model parameter materialization O(Psi)
MemoryCeilingBounded ==
    \A w \in Workers : transientBuffer[w] =< ParamsPerLayer

\* Zero leakage: transient buffer is strictly purged at step completion
ZeroLeakage ==
    \A w \in Workers : (workerPhase[w] = "DONE") => (transientBuffer[w] = 0)

=============================================================================
