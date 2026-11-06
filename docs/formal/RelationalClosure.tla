---------------------------- MODULE RelationalClosure ----------------------------
(*
  Bounded model of a directed closure over a finite node set.
  SPEC-151. This file is inventoried by scripts/verify-formal-tla.mjs.
  That script does not execute TLC.
*)

EXTENDS Naturals, FiniteSets

CONSTANTS Nodes, MaxDepth

VARIABLES seen, depth

vars == <<seen, depth>>

Init ==
  /\ seen = {}
  /\ depth = 0

\* A known start enters the seen set. Depth stays within MaxDepth.
Close(start) ==
  /\ start \in Nodes
  /\ depth < MaxDepth
  /\ seen' = seen \union {start}
  /\ depth' = depth + 1

\* An unknown start does not extend the seen set.
RejectUnknown(start) ==
  /\ start \notin Nodes
  /\ UNCHANGED <<seen, depth>>

Next ==
  \E start \in (Nodes \union {"missing"}) : Close(start) \/ RejectUnknown(start)

ClosureBoundInvariant ==
  /\ depth <= MaxDepth
  /\ seen \subseteq Nodes

=============================================================================
