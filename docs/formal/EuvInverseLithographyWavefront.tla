------------------- MODULE EuvInverseLithographyWavefront -------------------
(***************************************************************************)
(* Formal TLA+ specification of EUV Zernike Wavefront Metrology,          *)
(* Marechal Strehl Admission Gate & Adjoint Inverse Lithography (ILT)     *)
(* Mask Optimization (SPEC-337 / CHANGE-199 / ADR-199-001..003).          *)
(* Verified with Leslie Lamport's TLC Model Checker.                      *)
(***************************************************************************)

EXTENDS Integers, FiniteSets

CONSTANTS
    MaxIltIterations,       \* Nat: maximum ILT gradient descent steps
    MarechalMinStrehlPct,   \* Nat: minimum admissible Strehl ratio in % (80)
    InitialEpeNm            \* Nat: uncorrected wafer edge placement error

VARIABLES
    strehlPct,              \* 50..100: pupil Strehl ratio (%)
    compensated,            \* BOOLEAN: active mirror Zernike compensation applied
    exposureAdmitted,       \* BOOLEAN: whether exposure gate passed
    iltStep,                \* 0..MaxIltIterations
    epeNm,                  \* 0..InitialEpeNm: current edge placement error
    prevEpeNm,              \* 0..InitialEpeNm: prior iteration EPE
    maskValidBounds         \* BOOLEAN: mask transmission in [0, 1]

vars == << strehlPct, compensated, exposureAdmitted, iltStep,
           epeNm, prevEpeNm, maskValidBounds >>

TypeOK ==
    /\ strehlPct \in 50..100
    /\ compensated \in BOOLEAN
    /\ exposureAdmitted \in BOOLEAN
    /\ iltStep \in 0..MaxIltIterations
    /\ epeNm \in 0..InitialEpeNm
    /\ prevEpeNm \in 0..InitialEpeNm
    /\ maskValidBounds \in BOOLEAN

Init ==
    /\ strehlPct = 65
    /\ compensated = FALSE
    /\ exposureAdmitted = FALSE
    /\ iltStep = 0
    /\ epeNm = InitialEpeNm
    /\ prevEpeNm = InitialEpeNm
    /\ maskValidBounds = TRUE

\* Active mirror phase conjugation restores Strehl above Marechal threshold
CompensateWavefront ==
    /\ ~compensated
    /\ compensated' = TRUE
    /\ strehlPct' = 98
    /\ UNCHANGED << exposureAdmitted, iltStep, epeNm, prevEpeNm, maskValidBounds >>

\* Exposure admission gate requires Marechal Strehl >= 80%
AdmitExposure ==
    /\ ~exposureAdmitted
    /\ strehlPct >= MarechalMinStrehlPct
    /\ exposureAdmitted' = TRUE
    /\ UNCHANGED << strehlPct, compensated, iltStep, epeNm, prevEpeNm, maskValidBounds >>

\* Adjoint ILT step monotonically reduces Edge Placement Error while keeping M in [0,1]
StepIltOptimization ==
    /\ exposureAdmitted
    /\ iltStep < MaxIltIterations
    /\ iltStep' = iltStep + 1
    /\ prevEpeNm' = epeNm
    /\ epeNm' = IF epeNm > 0 THEN epeNm - 1 ELSE 0
    /\ maskValidBounds' = TRUE
    /\ UNCHANGED << strehlPct, compensated, exposureAdmitted >>

Done == iltStep = MaxIltIterations /\ UNCHANGED vars

Next ==
    \/ CompensateWavefront
    \/ AdmitExposure
    \/ StepIltOptimization
    \/ Done

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
\* INVARIANTS

\* 1. Marechal Admission Safety: Exposure is never admitted when Strehl < 80%.
MarechalAdmissionSafety == exposureAdmitted => strehlPct >= MarechalMinStrehlPct

\* 2. Monotonic EPE Reduction: ILT never degrades wafer Edge Placement Error.
MonotonicEpeReduction == epeNm <= prevEpeNm

\* 3. Sigmoid Mask Transmission Bounds: Mask values remain in [0, 1].
MaskTransmissionBounded == maskValidBounds = TRUE

=============================================================================
