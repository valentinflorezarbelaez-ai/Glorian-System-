------------------- MODULE UniversalAgentSessionContract -------------------
(*
  Bounded model of IDE agent session write authorization.
  SPEC-152. Inventoried by scripts/verify-formal-tla.mjs — not TLC-executed.
*)

EXTENDS Naturals, FiniteSets

CONSTANTS Tools, IdeFamilies

VARIABLES
  sessionOpen,
  completed,
  writeAllowed

vars == <<sessionOpen, completed, writeAllowed>>

Init ==
  /\ sessionOpen = FALSE
  /\ completed = {}
  /\ writeAllowed = FALSE

OpenSession ==
  /\ sessionOpen = FALSE
  /\ sessionOpen' = TRUE
  /\ completed' = {}
  /\ writeAllowed' = FALSE

RecordTool(t) ==
  /\ sessionOpen = TRUE
  /\ t \in Tools
  /\ completed' = completed \union {t}
  /\ UNCHANGED <<sessionOpen, writeAllowed>>

AuthorizeWrite ==
  /\ sessionOpen = TRUE
  /\ completed = Tools
  /\ writeAllowed' = TRUE
  /\ UNCHANGED <<sessionOpen, completed>>

DenyIncomplete ==
  /\ sessionOpen = TRUE
  /\ completed # Tools
  /\ writeAllowed' = FALSE
  /\ UNCHANGED <<sessionOpen, completed>>

Next ==
  \/ OpenSession
  \/ \E t \in Tools : RecordTool(t)
  \/ AuthorizeWrite
  \/ DenyIncomplete

WriteRequiresFullDagInvariant ==
  writeAllowed => (sessionOpen /\ completed = Tools)

=============================================================================
