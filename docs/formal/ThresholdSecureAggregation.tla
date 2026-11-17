------------------- MODULE ThresholdSecureAggregation -------------------
(***************************************************************************)
(* Bounded model of threshold secure aggregation (SPEC-335 / CHANGE-197). *)
(* Parties submit private inputs to a homomorphic aggregate. Once the     *)
(* first partial decryption is released, submissions are frozen. The      *)
(* aggregate is revealed only when >= Threshold distinct custodians have  *)
(* released partial decryptions, and the revealed value equals the sum    *)
(* of exactly the submitted inputs.                                       *)
(***************************************************************************)

EXTENDS Integers, FiniteSets

CONSTANTS
    Parties,        \* Set of party identifiers (model values)
    Threshold,      \* Nat: minimum partial decryptions required
    MaxValue        \* Nat: maximum private input value

VARIABLES
    inputs,         \* [Parties -> 0..MaxValue]: private inputs (0 until submitted)
    submitted,      \* SUBSET Parties: parties whose ciphertext is in the aggregate
    aggregate,      \* Nat: plaintext value the aggregate ciphertext encrypts
    partials,       \* SUBSET Parties: custodians who released partial decryptions
    revealed,       \* BOOLEAN: aggregate plaintext has been reconstructed
    result          \* Nat: reconstructed plaintext (-1 before reveal)

vars == << inputs, submitted, aggregate, partials, revealed, result >>

RECURSIVE SumOver(_)
SumOver(S) ==
    IF S = {} THEN 0
    ELSE LET p == CHOOSE x \in S : TRUE IN inputs[p] + SumOver(S \ {p})

MaxAggregate == MaxValue * Cardinality(Parties)

TypeOK ==
    /\ inputs \in [Parties -> 0..MaxValue]
    /\ submitted \subseteq Parties
    /\ aggregate \in 0..MaxAggregate
    /\ partials \subseteq Parties
    /\ revealed \in BOOLEAN
    /\ result \in -1..MaxAggregate

Init ==
    /\ inputs = [p \in Parties |-> 0]
    /\ submitted = {}
    /\ aggregate = 0
    /\ partials = {}
    /\ revealed = FALSE
    /\ result = -1

\* A party encrypts its input and the aggregator adds it homomorphically.
Submit(p, v) ==
    /\ p \notin submitted
    /\ partials = {}                      \* submissions frozen after decryption starts
    /\ inputs' = [inputs EXCEPT ![p] = v]
    /\ submitted' = submitted \cup {p}
    /\ aggregate' = aggregate + v
    /\ UNCHANGED << partials, revealed, result >>

\* A custodian releases its partial decryption of the aggregate.
ReleasePartial(p) ==
    /\ submitted # {}
    /\ p \notin partials
    /\ ~revealed
    /\ partials' = partials \cup {p}
    /\ UNCHANGED << inputs, submitted, aggregate, revealed, result >>

\* Combiner reconstructs the plaintext; only possible with >= Threshold partials.
Combine ==
    /\ ~revealed
    /\ Cardinality(partials) >= Threshold
    /\ revealed' = TRUE
    /\ result' = aggregate
    /\ UNCHANGED << inputs, submitted, aggregate, partials >>

Done == revealed /\ UNCHANGED vars

Next ==
    \/ \E p \in Parties, v \in 0..MaxValue : Submit(p, v)
    \/ \E p \in Parties : ReleasePartial(p)
    \/ Combine
    \/ Done

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
\* INVARIANTS

\* 1. No reveal without a threshold quorum of partial decryptions.
ThresholdSafety == revealed => Cardinality(partials) >= Threshold

\* 2. The aggregate always encrypts exactly the sum of submitted inputs.
AggregateCorrectness == aggregate = SumOver(submitted)

\* 3. The revealed value equals the sum of submitted inputs only.
RevealCorrectness == revealed => result = SumOver(submitted)

\* 4. Nothing is revealed before reconstruction.
NoPrematureResult == ~revealed => result = -1

=============================================================================
