---- MODULE GentlemanAutoUpdateEngine ----
EXTENDS Naturals

VARIABLES
  activeLockHolders,
  constitutionHashIntact,
  unverifiedBinariesInstalled,
  failedUpgradesRolledBack,
  completedUpdateCycles

Init ==
  /\ activeLockHolders = 0
  /\ constitutionHashIntact = TRUE
  /\ unverifiedBinariesInstalled = 0
  /\ failedUpgradesRolledBack = 0
  /\ completedUpdateCycles = 0

AcquireUpdateLock ==
  /\ activeLockHolders = 0
  /\ activeLockHolders' = 1
  /\ UNCHANGED <<constitutionHashIntact, unverifiedBinariesInstalled, failedUpgradesRolledBack, completedUpdateCycles>>

CommitVerifiedHotSwap ==
  /\ activeLockHolders = 1
  /\ constitutionHashIntact = TRUE
  /\ completedUpdateCycles' = completedUpdateCycles + 1
  /\ activeLockHolders' = 0
  /\ UNCHANGED <<constitutionHashIntact, unverifiedBinariesInstalled, failedUpgradesRolledBack>>

RollbackFailedCandidate ==
  /\ activeLockHolders = 1
  /\ failedUpgradesRolledBack' = failedUpgradesRolledBack + 1
  /\ activeLockHolders' = 0
  /\ UNCHANGED <<constitutionHashIntact, unverifiedBinariesInstalled, completedUpdateCycles>>

Next ==
  \/ AcquireUpdateLock
  \/ CommitVerifiedHotSwap
  \/ RollbackFailedCandidate

MutualExclusionLockInvariant ==
  activeLockHolders <= 1

ZeroUnverifiedInstallInvariant ==
  unverifiedBinariesInstalled = 0

ConstitutionPreservationInvariant ==
  constitutionHashIntact = TRUE

SafetyInvariant ==
  /\ MutualExclusionLockInvariant
  /\ ZeroUnverifiedInstallInvariant
  /\ ConstitutionPreservationInvariant
  /\ completedUpdateCycles >= 0
  /\ failedUpgradesRolledBack >= 0

====
