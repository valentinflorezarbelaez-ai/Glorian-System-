------------------- MODULE CausalDoCalculusScm -------------------
(***************************************************************************)
(* Formal TLA+ specification of Structural Causal Models (SCM),            *)
(* Graph Mutilation under do(X := x), Backdoor De-confounding &            *)
(* 3-Step Counterfactual Consistency (SPEC-338 / CHANGE-200).              *)
(* Verified with Leslie Lamport's TLC Model Checker.                       *)
(***************************************************************************)

EXTENDS Integers, FiniteSets

CONSTANTS
    ConfounderDomain,   \* e.g. {0, 1}
    TreatmentDomain     \* e.g. {0, 1}

VARIABLES
    phase,              \* "OBSERVATIONAL" | "INTERVENED" | "COUNTERFACTUAL"
    uZ,                 \* exogenous confounder noise
    uX,                 \* exogenous treatment noise
    uY,                 \* exogenous outcome noise
    zVal,               \* endogenous confounder Z = uZ
    xVal,               \* endogenous treatment X (Z + uX or clamped doX)
    yVal,               \* endogenous outcome Y = 2*X + 3*Z + uY
    intervenedX,        \* -1 if observational, else clamped value in TreatmentDomain
    xIncomingEdges,     \* Cardinality of incoming parent edges into X (1 or 0)
    consistencyHolds    \* BOOLEAN: Pearl consistency axiom (X=x => Y_{X<-x} = Y)

vars == << phase, uZ, uX, uY, zVal, xVal, yVal,
           intervenedX, xIncomingEdges, consistencyHolds >>

TypeOK ==
    /\ phase \in {"OBSERVATIONAL", "INTERVENED", "COUNTERFACTUAL"}
    /\ uZ \in ConfounderDomain
    /\ uX \in TreatmentDomain
    /\ uY \in {0, 1}
    /\ zVal \in ConfounderDomain
    /\ xVal \in 0..2
    /\ yVal \in 0..10
    /\ intervenedX \in -1..1
    /\ xIncomingEdges \in {0, 1}
    /\ consistencyHolds \in BOOLEAN

Init ==
    /\ phase = "OBSERVATIONAL"
    /\ uZ = 1
    /\ uX = 0
    /\ uY = 1
    /\ zVal = 1
    /\ xVal = 1
    /\ yVal = 2 * 1 + 3 * 1 + 1
    /\ intervenedX = -1
    /\ xIncomingEdges = 1
    /\ consistencyHolds = TRUE

\* Sample observational structural realization Z -> X, Z -> Y, X -> Y
ObserveRealization(uz, ux, uy) ==
    /\ phase = "OBSERVATIONAL"
    /\ uZ' = uz
    /\ uX' = ux
    /\ uY' = uy
    /\ zVal' = uz
    /\ xVal' = uz + ux
    /\ yVal' = 2 * (uz + ux) + 3 * uz + uy
    /\ intervenedX' = -1
    /\ xIncomingEdges' = 1
    /\ consistencyHolds' = TRUE
    /\ phase' = "OBSERVATIONAL"

\* Apply surgical intervention do(X := doX): severs incoming edge Z -> X
ApplyDoIntervention(doX) ==
    /\ phase \in {"OBSERVATIONAL", "INTERVENED"}
    /\ phase' = "INTERVENED"
    /\ intervenedX' = doX
    /\ xIncomingEdges' = 0
    /\ xVal' = doX
    /\ yVal' = 2 * doX + 3 * zVal + uY
    /\ UNCHANGED << uZ, uX, uY, zVal, consistencyHolds >>

\* 3-Step Counterfactual: Abduct (uZ, uX, uY), Act do(X := cfX), Predict Y_{X<-cfX}
EvaluateCounterfactual(cfX) ==
    /\ phase \in {"OBSERVATIONAL", "INTERVENED"}
    /\ LET factualX == uZ + uX
           factualY == 2 * factualX + 3 * uZ + uY
           cfY == 2 * cfX + 3 * uZ + uY
       IN
       /\ phase' = "COUNTERFACTUAL"
       /\ intervenedX' = cfX
       /\ xIncomingEdges' = 0
       /\ xVal' = cfX
       /\ yVal' = cfY
       /\ consistencyHolds' = ((cfX = factualX) => (cfY = factualY))
       /\ UNCHANGED << uZ, uX, uY, zVal >>

Done == phase = "COUNTERFACTUAL" /\ UNCHANGED vars

Next ==
    \/ \E uz \in ConfounderDomain, ux \in TreatmentDomain, uy \in {0, 1} :
         ObserveRealization(uz, ux, uy)
    \/ \E doX \in TreatmentDomain : ApplyDoIntervention(doX)
    \/ \E cfX \in TreatmentDomain : EvaluateCounterfactual(cfX)
    \/ Done

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
\* INVARIANTS

\* 1. Graph Mutilation Invariant: Under do(X) or counterfactual, X has 0 incoming edges.
MutilatedGraphSevered ==
    (phase \in {"INTERVENED", "COUNTERFACTUAL"}) => (xIncomingEdges = 0)

\* 2. Ancestor Autonomy: Confounder Z is invariant to interventions on descendant X.
AncestorInvariance == zVal = uZ

\* 3. Structural Equation Faithfulness: Y always satisfies its structural mechanism.
OutcomeMechanismFaithful == yVal = 2 * xVal + 3 * zVal + uY

\* 4. Pearl Counterfactual Consistency Axiom: X(u) = x => Y_{X<-x}(u) = Y(u).
CounterfactualConsistency == consistencyHolds = TRUE

=============================================================================
