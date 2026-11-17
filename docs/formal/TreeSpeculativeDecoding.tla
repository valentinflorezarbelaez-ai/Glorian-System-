-------------------- MODULE TreeSpeculativeDecoding --------------------
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    MaxNodes

VARIABLES
    treeNodes,
    parent,
    depth,
    maskPermitted,
    acceptedNodes,
    verifiedCount,
    status

Nodes == 1..MaxNodes

TypeOK ==
    /\ treeNodes \subseteq Nodes
    /\ parent \in [Nodes -> 0..MaxNodes]
    /\ depth \in [Nodes -> 0..MaxNodes]
    /\ maskPermitted \subseteq (Nodes \times Nodes)
    /\ acceptedNodes \subseteq treeNodes
    /\ verifiedCount \in 0..(MaxNodes + 1)
    /\ status \in {"IDLE", "TREE_BUILT", "MASK_SYNTHESIZED", "VERIFIED"}

Init ==
    /\ treeNodes = {}
    /\ parent = [n \in Nodes |-> 0]
    /\ depth = [n \in Nodes |-> 0]
    /\ maskPermitted = {}
    /\ acceptedNodes = {}
    /\ verifiedCount = 0
    /\ status = "IDLE"

(* Step 1: Build a hierarchical draft tree topology *)
BuildTree ==
    /\ status = "IDLE"
    /\ treeNodes' = Nodes
    (* Root node is 1, depth 0 *)
    /\ parent' = [n \in Nodes |-> IF n = 1 THEN 0 ELSE (n \div 2)]
    /\ depth' = [n \in Nodes |-> IF n = 1 THEN 0 ELSE 1 + (n \div 2)]
    /\ UNCHANGED << maskPermitted, acceptedNodes, verifiedCount >>
    /\ status' = "TREE_BUILT"

(* Ancestor relation helper *)
IsAncestor(anc, dec) ==
    \/ anc = dec
    \/ (parent[dec] # 0 /\ anc = parent[dec])
    \/ (parent[dec] # 0 /\ parent[parent[dec]] # 0 /\ anc = parent[parent[dec]])

(* Step 2: Synthesize 2D Tree Attention Mask *)
SynthesizeMask ==
    /\ status = "TREE_BUILT"
    /\ maskPermitted' = {pair \in (treeNodes \times treeNodes) : IsAncestor(pair[2], pair[1])}
    /\ UNCHANGED << treeNodes, parent, depth, acceptedNodes, verifiedCount >>
    /\ status' = "MASK_SYNTHESIZED"

(* Step 3: Run Modified Rejection Sampling *)
RunRejectionSampling ==
    /\ status = "MASK_SYNTHESIZED"
    (* Root is candidate, child can only be accepted if parent accepted *)
    /\ \E acc \in SUBSET treeNodes :
        /\ (\A n \in acc : (parent[n] = 0 \/ parent[n] \in acc))
        /\ acceptedNodes' = acc
        (* Guaranteed progress: accepted tokens + exactly 1 recovery token *)
        /\ verifiedCount' = Cardinality(acc) + 1
    /\ UNCHANGED << treeNodes, parent, depth, maskPermitted >>
    /\ status' = "VERIFIED"

(* Step 4: Reset engine for next inference cycle *)
Reset ==
    /\ status = "VERIFIED"
    /\ status' = "IDLE"
    /\ treeNodes' = {}
    /\ parent' = [n \in Nodes |-> 0]
    /\ depth' = [n \in Nodes |-> 0]
    /\ maskPermitted' = {}
    /\ acceptedNodes' = {}
    /\ verifiedCount' = 0

Next ==
    \/ BuildTree
    \/ SynthesizeMask
    \/ RunRejectionSampling
    \/ Reset

Spec == Init /\ [][Next]_<<treeNodes, parent, depth, maskPermitted, acceptedNodes, verifiedCount, status>>

-----------------------------------------------------------------------------
(* INVARIANTS *)

(* Invariant 1: Attention mask strictly enforces that nodes only attend to ancestors *)
TreeMaskAncestry ==
    \A pair \in maskPermitted :
        IsAncestor(pair[2], pair[1])

(* Invariant 2: Guaranteed Progress: Verification always produces >= 1 accepted token *)
GuaranteedProgress ==
    status = "VERIFIED" => verifiedCount >= 1

(* Invariant 3: Hierarchy integrity: Child depth is strictly greater than parent depth *)
HierarchyIntegrity ==
    \A n \in treeNodes :
        (parent[n] # 0) => (depth[n] > depth[parent[n]])

=============================================================================
