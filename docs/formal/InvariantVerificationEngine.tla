---------------- MODULE InvariantVerificationEngine ----------------
(*
 * EOS SYSTEM — FORMAL SPECIFICATION
 * Invariant Verification Engine & Exhaustive Property-Based State Exploration
 * Governed by SPEC-049, CHANGE-042, ADR-055 (v55.0.0)
 *)

EXTENDS Naturals, Sequences

VARIABLES
  exploredStates,
  invariantsChecked,
  violationsDetected,
  shrunkTraces,
  faultsInjected,
  stateHashChainLength

TypeInvariant ==
  /\ exploredStates \in Nat
  /\ invariantsChecked \in Nat
  /\ violationsDetected \in Nat
  /\ shrunkTraces \in Nat
  /\ faultsInjected \in Nat
  /\ stateHashChainLength \in Nat

SafetyInvariant ==
  /\ violationsDetected <= exploredStates
  /\ shrunkTraces <= violationsDetected
  /\ stateHashChainLength = exploredStates

Init ==
  /\ exploredStates = 0
  /\ invariantsChecked = 0
  /\ violationsDetected = 0
  /\ shrunkTraces = 0
  /\ faultsInjected = 0
  /\ stateHashChainLength = 0

ExploreSafeStep ==
  /\ exploredStates' = exploredStates + 1
  /\ invariantsChecked' = invariantsChecked + 1
  /\ stateHashChainLength' = stateHashChainLength + 1
  /\ UNCHANGED <<violationsDetected, shrunkTraces, faultsInjected>>

ExploreFaultStep ==
  /\ exploredStates' = exploredStates + 1
  /\ invariantsChecked' = invariantsChecked + 1
  /\ faultsInjected' = faultsInjected + 1
  /\ stateHashChainLength' = stateHashChainLength + 1
  /\ UNCHANGED <<violationsDetected, shrunkTraces>>

DetectAndShrinkViolation ==
  /\ exploredStates' = exploredStates + 1
  /\ invariantsChecked' = invariantsChecked + 1
  /\ violationsDetected' = violationsDetected + 1
  /\ shrunkTraces' = shrunkTraces + 1
  /\ stateHashChainLength' = stateHashChainLength + 1
  /\ UNCHANGED <<faultsInjected>>

Next ==
  \/ ExploreSafeStep
  \/ ExploreFaultStep
  \/ DetectAndShrinkViolation

=============================================================================