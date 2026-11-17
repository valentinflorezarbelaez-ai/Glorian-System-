-------------------- MODULE StreamingLlmAttentionSinks --------------------
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    SinkSize,
    WindowSize,
    MaxStreamSteps

VARIABLES
    streamStep,
    sinkTokens,
    windowTokens,
    evictedTokens,
    activeTokenCount

TypeOK ==
    /\ streamStep \in 0..MaxStreamSteps
    /\ sinkTokens \subseteq 1..MaxStreamSteps
    /\ windowTokens \in Seq(1..MaxStreamSteps)
    /\ evictedTokens \subseteq 1..MaxStreamSteps
    /\ activeTokenCount \in 0..(SinkSize + WindowSize)

Init ==
    /\ streamStep = 0
    /\ sinkTokens = {}
    /\ windowTokens = <<>>
    /\ evictedTokens = {}
    /\ activeTokenCount = 0

(* Step 1: Ingest Initial Tokens as Permanent Attention Sinks *)
IngestSinkToken ==
    /\ streamStep < SinkSize
    /\ streamStep' = streamStep + 1
    /\ sinkTokens' = sinkTokens \cup {streamStep + 1}
    /\ UNCHANGED << windowTokens, evictedTokens >>
    /\ activeTokenCount' = activeTokenCount + 1

(* Step 2: Ingest into Local Sliding Window (Buffer Not Full) *)
IngestWindowToken ==
    /\ streamStep >= SinkSize
    /\ streamStep < MaxStreamSteps
    /\ Len(windowTokens) < WindowSize
    /\ streamStep' = streamStep + 1
    /\ windowTokens' = Append(windowTokens, streamStep + 1)
    /\ UNCHANGED << sinkTokens, evictedTokens >>
    /\ activeTokenCount' = activeTokenCount + 1

(* Step 3: Evict Oldest Window Token When Capacity Exceeded (O(1) Roll-Over) *)
EvictAndRollWindowToken ==
    /\ streamStep >= SinkSize
    /\ streamStep < MaxStreamSteps
    /\ Len(windowTokens) = WindowSize
    /\ streamStep' = streamStep + 1
    (* Evict Head of Window *)
    /\ evictedTokens' = evictedTokens \cup {Head(windowTokens)}
    (* Append New Token to Tail *)
    /\ windowTokens' = Append(Tail(windowTokens), streamStep + 1)
    /\ UNCHANGED << sinkTokens >>
    /\ activeTokenCount' = activeTokenCount

Next ==
    \/ IngestSinkToken
    \/ IngestWindowToken
    \/ EvictAndRollWindowToken

Spec == Init /\ [][Next]_<<streamStep, sinkTokens, windowTokens, evictedTokens, activeTokenCount>>

-----------------------------------------------------------------------------
(* INVARIANTS *)

(* Invariant 1: Attention Sink Immunity: Sinks are strictly NEVER evicted *)
SinkImmunity ==
    sinkTokens \cap evictedTokens = {}

(* Invariant 2: Memory Ceiling Bounded: Active tokens never exceed SinkSize + WindowSize *)
MemoryCeilingBounded ==
    activeTokenCount <= (SinkSize + WindowSize)

(* Invariant 3: Active count matches actual stored tokens *)
ActiveCountConsistency ==
    activeTokenCount = (Cardinality(sinkTokens) + Len(windowTokens))

=============================================================================
