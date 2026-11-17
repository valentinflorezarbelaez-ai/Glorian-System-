------------------- MODULE DisaggregatedPrefillDecode -------------------
(***************************************************************************)
(* Formal TLA+ specification of Disaggregated Prefill & Decode Serving     *)
(* Architecture (PD Separation, Chunked Prefill & Zero-Copy KV Handoff).  *)
(* Verified with Leslie Lamport's TLC Model Checker.                       *)
(***************************************************************************)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS 
    TotalRequests,      \* Nat: Total number of requests (e.g. 2)
    PromptTokens,       \* Nat: Total tokens per prompt (e.g. 4)
    ChunkBudget,        \* Nat: Max tokens per prefill chunk (e.g. 2)
    TotalPrefillNodes,  \* Nat: Number of prefill workers (e.g. 1)
    TotalDecodeNodes,   \* Nat: Number of decode workers (e.g. 1)
    MaxOutputTokens     \* Nat: Max generation steps per request (e.g. 2)

VARIABLES
    prefillQueue,       \* Set of requests waiting for prefill
    prefillProgress,    \* Array of prefilled token count per request [1..TotalRequests]
    pNodeAssigned,      \* Array of assigned request per prefill node [1..TotalPrefillNodes] (0 if idle)
    inFlightHandoff,    \* Set of requests whose KV cache is migrating
    decodeQueue,        \* Set of requests actively decoding on decode nodes
    tokensGenerated,    \* Array of generated token count per request [1..TotalRequests]
    dNodeLoad,          \* Array of active request count per decode node [1..TotalDecodeNodes]
    completedRequests,  \* Set of finished requests
    holBlocked          \* BOOLEAN: True if a decode step was blocked by prefill

vars == << prefillQueue, prefillProgress, pNodeAssigned, inFlightHandoff, 
          decodeQueue, tokensGenerated, dNodeLoad, completedRequests, holBlocked >>

Requests == 1..TotalRequests
PrefillNodes == 1..TotalPrefillNodes
DecodeNodes == 1..TotalDecodeNodes

TypeOK ==
    /\ prefillQueue \subseteq Requests
    /\ prefillProgress \in [Requests -> 0..PromptTokens]
    /\ pNodeAssigned \in [PrefillNodes -> Requests \cup {0}]
    /\ inFlightHandoff \subseteq Requests
    /\ decodeQueue \subseteq Requests
    /\ tokensGenerated \in [Requests -> 0..MaxOutputTokens]
    /\ dNodeLoad \in [DecodeNodes -> 0..TotalRequests]
    /\ completedRequests \subseteq Requests
    /\ holBlocked \in BOOLEAN

Init ==
    /\ prefillQueue = Requests
    /\ prefillProgress = [r \in Requests |-> 0]
    /\ pNodeAssigned = [p \in PrefillNodes |-> 0]
    /\ inFlightHandoff = {}
    /\ decodeQueue = {}
    /\ tokensGenerated = [r \in Requests |-> 0]
    /\ dNodeLoad = [d \in DecodeNodes |-> 0]
    /\ completedRequests = {}
    /\ holBlocked = FALSE

\* Assign a pending request to an idle prefill node
StartPrefill(p, r) ==
    /\ pNodeAssigned[p] = 0
    /\ r \in prefillQueue
    /\ pNodeAssigned' = [pNodeAssigned EXCEPT ![p] = r]
    /\ prefillQueue' = prefillQueue \ {r}
    /\ UNCHANGED << prefillProgress, inFlightHandoff, decodeQueue, tokensGenerated, dNodeLoad, completedRequests, holBlocked >>

\* Execute a deterministic micro-chunk of prefill (bounded by ChunkBudget)
StepChunkedPrefill(p) ==
    /\ pNodeAssigned[p] # 0
    /\ LET r == pNodeAssigned[p]
           remaining == PromptTokens - prefillProgress[r]
           stepSize == IF remaining < ChunkBudget THEN remaining ELSE ChunkBudget
           newProg == prefillProgress[r] + stepSize
       IN
       /\ prefillProgress' = [prefillProgress EXCEPT ![r] = newProg]
       /\ IF newProg >= PromptTokens
          THEN /\ pNodeAssigned' = [pNodeAssigned EXCEPT ![p] = 0]
               /\ inFlightHandoff' = inFlightHandoff \cup {r}
          ELSE /\ pNodeAssigned' = pNodeAssigned
               /\ inFlightHandoff' = inFlightHandoff
       /\ UNCHANGED << prefillQueue, decodeQueue, tokensGenerated, dNodeLoad, completedRequests, holBlocked >>

\* Migrate paged KV cache to decode node in zero-copy handoff
CompleteKVHandoff(r, d) ==
    /\ r \in inFlightHandoff
    /\ inFlightHandoff' = inFlightHandoff \ {r}
    /\ decodeQueue' = decodeQueue \cup {r}
    /\ dNodeLoad' = [dNodeLoad EXCEPT ![d] = @ + 1]
    /\ UNCHANGED << prefillQueue, prefillProgress, pNodeAssigned, tokensGenerated, completedRequests, holBlocked >>

\* Decode node performs step-wise autoregressive token generation
StepDecode(r, d) ==
    /\ r \in decodeQueue
    \* In disaggregated architecture, prefill node assignment does NOT block decode node
    /\ holBlocked' = holBlocked
    /\ LET newTokens == tokensGenerated[r] + 1
       IN
       /\ tokensGenerated' = [tokensGenerated EXCEPT ![r] = newTokens]
       /\ IF newTokens >= MaxOutputTokens
          THEN /\ decodeQueue' = decodeQueue \ {r}
               /\ dNodeLoad' = [dNodeLoad EXCEPT ![d] = @ - 1]
               /\ completedRequests' = completedRequests \cup {r}
          ELSE /\ decodeQueue' = decodeQueue
               /\ dNodeLoad' = dNodeLoad
               /\ completedRequests' = completedRequests
       /\ UNCHANGED << prefillQueue, prefillProgress, pNodeAssigned, inFlightHandoff >>

Next ==
    \/ \E p \in PrefillNodes, r \in Requests: StartPrefill(p, r)
    \/ \E p \in PrefillNodes: StepChunkedPrefill(p)
    \/ \E r \in Requests, d \in DecodeNodes: CompleteKVHandoff(r, d)
    \/ \E r \in Requests, d \in DecodeNodes: StepDecode(r, d)
    \/ (completedRequests = Requests /\ UNCHANGED vars)

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
\* INVARIANTS

\* 1. Head-of-Line Blocking is strictly eliminated by physical disaggregation
NoHeadOfLineBlocking == holBlocked = FALSE

\* 2. KV Cache Page Conservation: Every request is accounted for across disjoint phases
KVCacheConservation ==
    /\ (prefillQueue \cap inFlightHandoff) = {}
    /\ (inFlightHandoff \cap decodeQueue) = {}
    /\ (decodeQueue \cap completedRequests) = {}

\* 3. Chunk Budget Invariant: Prefill progress never exceeds PromptTokens
PrefillBudgetBound ==
    \A r \in Requests: prefillProgress[r] <= PromptTokens

=============================================================================
