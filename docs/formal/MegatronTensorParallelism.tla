---------------- MODULE MegatronTensorParallelism ----------------
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    Workers,            \* Set of worker IDs, e.g. {0, 1}
    DimIn,              \* Input dimension, e.g. 2
    DimHidden,          \* Hidden dimension, e.g. 4
    DimOut              \* Output dimension, e.g. 2

VARIABLES
    phase,              \* "INIT", "COL_FORWARD", "ACTIVATION", "ROW_FORWARD", "ALL_REDUCE", "DONE"
    colOutputs,         \* Function: w \in Workers -> sharded output dimension
    actOutputs,         \* Function: w \in Workers -> activated sharded dimension
    rowOutputs,         \* Function: w \in Workers -> partial output computed locally
    finalOutputValid,   \* Boolean: whether full output is synchronized
    allReduceBarriers   \* Nat: number of all-reduce collective barriers executed

vars == <<phase, colOutputs, actOutputs, rowOutputs, finalOutputValid, allReduceBarriers>>

NumWorkers == Cardinality(Workers)
HiddenPerWorker == DimHidden \div NumWorkers

TypeOK ==
    /\ phase \in {"INIT", "COL_FORWARD", "ACTIVATION", "ROW_FORWARD", "ALL_REDUCE", "DONE"}
    /\ finalOutputValid \in BOOLEAN
    /\ allReduceBarriers \in 0..2
    /\ DOMAIN colOutputs = Workers
    /\ DOMAIN actOutputs = Workers
    /\ DOMAIN rowOutputs = Workers

Init ==
    /\ phase = "INIT"
    /\ colOutputs = [w \in Workers |-> 0]
    /\ actOutputs = [w \in Workers |-> 0]
    /\ rowOutputs = [w \in Workers |-> 0]
    /\ finalOutputValid = FALSE
    /\ allReduceBarriers = 0

ColumnForward ==
    /\ phase = "INIT"
    /\ colOutputs' = [w \in Workers |-> HiddenPerWorker]
    /\ phase' = "COL_FORWARD"
    /\ UNCHANGED <<actOutputs, rowOutputs, finalOutputValid, allReduceBarriers>>

LocalActivation ==
    /\ phase = "COL_FORWARD"
    /\ actOutputs' = [w \in Workers |-> colOutputs[w]]
    /\ phase' = "ACTIVATION"
    /\ UNCHANGED <<colOutputs, rowOutputs, finalOutputValid, allReduceBarriers>>

RowForward ==
    /\ phase = "ACTIVATION"
    /\ rowOutputs' = [w \in Workers |-> DimOut]
    /\ phase' = "ROW_FORWARD"
    /\ UNCHANGED <<colOutputs, actOutputs, finalOutputValid, allReduceBarriers>>

AllReduceBarrier ==
    /\ phase = "ROW_FORWARD"
    /\ allReduceBarriers' = allReduceBarriers + 1
    /\ finalOutputValid' = TRUE
    /\ phase' = "ALL_REDUCE"
    /\ UNCHANGED <<colOutputs, actOutputs, rowOutputs>>

Terminate ==
    /\ phase = "ALL_REDUCE"
    /\ phase' = "DONE"
    /\ UNCHANGED <<colOutputs, actOutputs, rowOutputs, finalOutputValid, allReduceBarriers>>

Next ==
    \/ ColumnForward
    \/ LocalActivation
    \/ RowForward
    \/ AllReduceBarrier
    \/ Terminate

Spec == Init /\ [][Next]_vars

\* --- INVARIANTS ---

\* Megatron-LM core efficiency invariant: exactly one collective barrier per 2-layer MLP block
SingleBarrierInvariant ==
    (phase = "DONE") => (allReduceBarriers = 1)

\* Partition integrity: each worker holds exactly DimHidden / NumWorkers
PartitionIntegrity ==
    (phase \in {"COL_FORWARD", "ACTIVATION", "ROW_FORWARD", "ALL_REDUCE", "DONE"}) =>
        (\A w \in Workers : colOutputs[w] = HiddenPerWorker)

\* Validity upon termination
TerminationSafety ==
    (phase = "DONE") => finalOutputValid

=============================================================================
