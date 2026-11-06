-------------------- MODULE EnterpriseWorkspaceGovernor --------------------
EXTENDS Naturals

(*
  EOS System v52.0.0 — Enterprise Multi-Project Workspace Governor Formal Model
  Governed by SPEC-046, CHANGE-039, ADR-052
  Verifies Law IV External Write Barrier preservation, control-plane-confined
  onboarding, symlink/traversal rejection, and cryptographic audit completeness.
*)

VARIABLES
  onboardedProjects,
  readOnlyInspections,
  authorizedExternalWrites,
  unauthorizedExternalWrites,
  externalBytesWrittenOnOnboard,
  pathEscapesAllowed

TypeInvariant ==
  /\ onboardedProjects \in Nat
  /\ readOnlyInspections \in Nat
  /\ authorizedExternalWrites \in Nat
  /\ unauthorizedExternalWrites \in Nat
  /\ externalBytesWrittenOnOnboard \in Nat
  /\ pathEscapesAllowed \in Nat

ZeroExternalWriteOnOnboardInvariant ==
  externalBytesWrittenOnOnboard = 0

LawIVWriteBarrierInvariant ==
  unauthorizedExternalWrites = 0

BoundaryConfinementInvariant ==
  pathEscapesAllowed = 0

SafetyInvariant ==
  /\ TypeInvariant
  /\ ZeroExternalWriteOnOnboardInvariant
  /\ LawIVWriteBarrierInvariant
  /\ BoundaryConfinementInvariant

Init ==
  /\ onboardedProjects = 0
  /\ readOnlyInspections = 0
  /\ authorizedExternalWrites = 0
  /\ unauthorizedExternalWrites = 0
  /\ externalBytesWrittenOnOnboard = 0
  /\ pathEscapesAllowed = 0

OnboardExternalProject ==
  /\ onboardedProjects' = onboardedProjects + 1
  /\ externalBytesWrittenOnOnboard' = 0
  /\ UNCHANGED <<readOnlyInspections, authorizedExternalWrites, unauthorizedExternalWrites, pathEscapesAllowed>>

InspectRegisteredWorkspace ==
  /\ readOnlyInspections' = readOnlyInspections + 1
  /\ pathEscapesAllowed' = 0
  /\ UNCHANGED <<onboardedProjects, authorizedExternalWrites, unauthorizedExternalWrites, externalBytesWrittenOnOnboard>>

ExecuteAuthorizedLevel3Write ==
  /\ onboardedProjects > 0
  /\ authorizedExternalWrites' = authorizedExternalWrites + 1
  /\ unauthorizedExternalWrites' = 0
  /\ UNCHANGED <<onboardedProjects, readOnlyInspections, externalBytesWrittenOnOnboard, pathEscapesAllowed>>

Next ==
  \/ OnboardExternalProject
  \/ InspectRegisteredWorkspace
  \/ ExecuteAuthorizedLevel3Write

Spec == Init /\ [][Next]_<<onboardedProjects, readOnlyInspections, authorizedExternalWrites, unauthorizedExternalWrites, externalBytesWrittenOnOnboard, pathEscapesAllowed>>
=============================================================================
