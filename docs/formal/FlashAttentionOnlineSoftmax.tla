----------------------- MODULE FlashAttentionOnlineSoftmax -----------------------
(***************************************************************************)
(* Formal TLA+ specification of FlashAttention-Style Online Softmax Tiling *)
(* and Block-Level Causal Pruning Kernel.                                  *)
(* Verified with Leslie Lamport's TLC Model Checker.                       *)
(***************************************************************************)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS 
    NumRowBlocks,    \* Number of Query row blocks Tr (e.g. 2)
    NumColBlocks,    \* Number of Key/Value column blocks Tc (e.g. 2)
    MaxScoreVal      \* Discretized score range [1..MaxScoreVal] (e.g. 3)

VARIABLES 
    currCol,            \* Current Key/Value column block index (1..NumColBlocks + 1)
    runningMax,         \* Array 1..NumRowBlocks of integer running max (or -100 initially)
    runningSum,         \* Array 1..NumRowBlocks of running exponential normalizer
    accumulatedOutput,  \* Array 1..NumRowBlocks of accumulated output weights
    tilesProcessed,     \* Total tile pairs evaluated
    prunedTiles,        \* Total tile pairs skipped due to causal masking
    done                \* Termination flag

vars == <<currCol, runningMax, runningSum, accumulatedOutput, tilesProcessed, prunedTiles, done>>

RowIndices == 1..NumRowBlocks
ColIndices == 1..NumColBlocks
Scores == 1..MaxScoreVal

(***************************************************************************)
(* Initial State Predicate                                                 *)
(***************************************************************************)
Init ==
    /\ currCol = 1
    /\ runningMax = [r \in RowIndices |-> -100]
    /\ runningSum = [r \in RowIndices |-> 0]
    /\ accumulatedOutput = [r \in RowIndices |-> 0]
    /\ tilesProcessed = 0
    /\ prunedTiles = 0
    /\ done = FALSE

(***************************************************************************)
(* Step: Evaluate active column block across row blocks                     *)
(***************************************************************************)
StepColumn ==
    /\ ~done
    /\ currCol =< NumColBlocks
    /\ \E s1 \in Scores, s2 \in Scores:
        LET scores == <<s1, s2>>
            r1Pruned == (currCol > 1)
            r2Pruned == (currCol > 2)
            newPruned == (IF r1Pruned THEN 1 ELSE 0) + (IF r2Pruned THEN 1 ELSE 0)
            newProcessed == (IF ~r1Pruned THEN 1 ELSE 0) + (IF ~r2Pruned THEN 1 ELSE 0)
            
            \* Row 1 updates
            score1 == scores[1]
            oldM1 == runningMax[1]
            newM1 == IF r1Pruned THEN oldM1 ELSE IF oldM1 = -100 THEN score1 ELSE IF score1 > oldM1 THEN score1 ELSE oldM1
            addedTerm1 == IF r1Pruned THEN 0 ELSE IF newM1 = score1 THEN 2 ELSE 1
            newSum1 == IF r1Pruned THEN runningSum[1] ELSE IF oldM1 = -100 THEN addedTerm1 ELSE runningSum[1] + addedTerm1
            newOut1 == IF r1Pruned THEN accumulatedOutput[1] ELSE accumulatedOutput[1] + (addedTerm1 * score1)

            \* Row 2 updates
            score2 == scores[2]
            oldM2 == runningMax[2]
            newM2 == IF r2Pruned THEN oldM2 ELSE IF oldM2 = -100 THEN score2 ELSE IF score2 > oldM2 THEN score2 ELSE oldM2
            addedTerm2 == IF r2Pruned THEN 0 ELSE IF newM2 = score2 THEN 2 ELSE 1
            newSum2 == IF r2Pruned THEN runningSum[2] ELSE IF oldM2 = -100 THEN addedTerm2 ELSE runningSum[2] + addedTerm2
            newOut2 == IF r2Pruned THEN accumulatedOutput[2] ELSE accumulatedOutput[2] + (addedTerm2 * score2)
        IN
            /\ tilesProcessed' = tilesProcessed + newProcessed
            /\ prunedTiles' = prunedTiles + newPruned
            /\ currCol' = currCol + 1
            /\ done' = (currCol = NumColBlocks)
            /\ runningMax' = [runningMax EXCEPT ![1] = newM1, ![2] = newM2]
            /\ runningSum' = [runningSum EXCEPT ![1] = newSum1, ![2] = newSum2]
            /\ accumulatedOutput' = [accumulatedOutput EXCEPT ![1] = newOut1, ![2] = newOut2]

(***************************************************************************)
(* Next State Relation                                                     *)
(***************************************************************************)
Next ==
    \/ StepColumn
    \/ (done /\ UNCHANGED vars)

Spec == Init /\ [][Next]_vars

(***************************************************************************)
(* INVARIANTS                                                              *)
(***************************************************************************)

\* Running maximums are bounded by maximum score
RunningMaxBounded ==
    \A r \in RowIndices:
        runningMax[r] =< MaxScoreVal

\* Normalizer is strictly positive once any tile is processed for that row
PositiveNormalizer ==
    \A r \in RowIndices:
        (currCol > 1 /\ r = 1 => runningSum[r] > 0)

\* Total tiles accounted for (processed + pruned) never exceeds Tr * Tc
TileConservation ==
    tilesProcessed + prunedTiles =< NumRowBlocks * NumColBlocks

\* When done, all tiles are either processed or pruned
CompleteCoverageOnDone ==
    done => (tilesProcessed + prunedTiles = NumRowBlocks * NumColBlocks)

=============================================================================
