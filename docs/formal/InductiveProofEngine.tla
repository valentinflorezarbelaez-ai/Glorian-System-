------------------------- MODULE InductiveProofEngine -------------------------
EXTENDS Naturals, FiniteSets

CONSTANTS MaxLemmas, MaxCex

VARIABLES
  lemmasSynthesized,
  counterexamplesFound,
  baseCaseVerified,
  inductiveStepVerified,
  proofStatus

vars == <<lemmasSynthesized, counterexamplesFound, baseCaseVerified, inductiveStepVerified, proofStatus>>

STATUSES == {
  "IDLE",
  "BASE_CHECKED",
  "CEX_DETECTED",
  "LEMMA_SYNTHESIZED",
  "INDUCTIVE_PROVEN"
}

Init ==
  /\ lemmasSynthesized = 0
  /\ counterexamplesFound = 0
  /\ baseCaseVerified = FALSE
  /\ inductiveStepVerified = FALSE
  /\ proofStatus = "IDLE"

VerifyBaseCase ==
  /\ proofStatus = "IDLE"
  /\ baseCaseVerified' = TRUE
  /\ proofStatus' = "BASE_CHECKED"
  /\ UNCHANGED <<lemmasSynthesized, counterexamplesFound, inductiveStepVerified>>

DetectCounterexample ==
  /\ proofStatus \in {"BASE_CHECKED", "LEMMA_SYNTHESIZED"}
  /\ counterexamplesFound < MaxCex
  /\ counterexamplesFound' = counterexamplesFound + 1
  /\ proofStatus' = "CEX_DETECTED"
  /\ inductiveStepVerified' = FALSE
  /\ UNCHANGED <<lemmasSynthesized, baseCaseVerified>>

SynthesizeLemma ==
  /\ proofStatus = "CEX_DETECTED"
  /\ lemmasSynthesized < MaxLemmas
  /\ lemmasSynthesized' = lemmasSynthesized + 1
  /\ proofStatus' = "LEMMA_SYNTHESIZED"
  /\ UNCHANGED <<counterexamplesFound, baseCaseVerified, inductiveStepVerified>>

ProveInductive ==
  /\ proofStatus \in {"BASE_CHECKED", "LEMMA_SYNTHESIZED"}
  /\ baseCaseVerified = TRUE
  /\ inductiveStepVerified' = TRUE
  /\ proofStatus' = "INDUCTIVE_PROVEN"
  /\ UNCHANGED <<lemmasSynthesized, counterexamplesFound, baseCaseVerified>>

ResetProver ==
  /\ proofStatus = "INDUCTIVE_PROVEN"
  /\ lemmasSynthesized' = 0
  /\ counterexamplesFound' = 0
  /\ baseCaseVerified' = FALSE
  /\ inductiveStepVerified' = FALSE
  /\ proofStatus' = "IDLE"

Next ==
  \/ VerifyBaseCase
  \/ DetectCounterexample
  \/ SynthesizeLemma
  \/ ProveInductive
  \/ ResetProver

TypeOK ==
  /\ lemmasSynthesized \in 0..MaxLemmas
  /\ counterexamplesFound \in 0..MaxCex
  /\ baseCaseVerified \in BOOLEAN
  /\ inductiveStepVerified \in BOOLEAN
  /\ proofStatus \in STATUSES

InductionSoundness ==
  inductiveStepVerified => baseCaseVerified

=============================================================================
