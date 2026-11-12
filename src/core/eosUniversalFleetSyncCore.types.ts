/**
 * EOS SYSTEM — LAYER-0 UNIVERSAL FEDERATED CROSS-FLEET SYNC & HEALTH HEALING TYPES
 * Governed by SPEC-225, CHANGE-110, BDD-1144..BDD-1148 & ADR-225
 *
 * Inviolable Laws of EOS:
 * Law I: Zero external runtime dependencies.
 * Law II: Node 24 strip-only TypeScript (no enums, no namespaces).
 * Law III: Contract-driven design with explicit invariants.
 * Law V: Strict module boundary (<= 800 lines).
 */

export type FleetSyncState =
  "IN_SYNC" | "LOCAL_AHEAD" | "REMOTE_AHEAD" | "DIVERGED" | "FEDERATED_ATTESTED" | "DIRTY_TREE";

export type SoundcheckGrade = "A+" | "A" | "B" | "C" | "F";

export interface FleetProjectRegistryEntry {
  readonly id: string;
  readonly name: string;
  readonly resolvedLocalDir?: string;
  readonly localPathEnv?: string;
  readonly localPath?: string;
  readonly remoteUrl: string;
  readonly productionUrl?: string;
  readonly type?: string;
  readonly status?: string;
  readonly intake?: string;
  readonly specification?: string;
  readonly audit?: string;
  readonly authorization?: string;
  readonly cicdGateScript?: string;
  readonly autoShipScript?: string;
  readonly currentBranch?: string;
  readonly headCommitSha?: string;
  readonly ownerApproval?: string;
}

export interface FleetRegistryData {
  readonly version: string;
  readonly updatedAt: string;
  readonly masterOrchestrator: string;
  readonly totalFleetProjects: number;
  readonly projects: readonly FleetProjectRegistryEntry[];
  readonly registrySha256: string;
}

export interface FleetProjectResolved {
  readonly id: string;
  readonly name: string;
  readonly path: string | null;
  readonly existsLocally: boolean;
  readonly resolvedLocalDir: string;
  readonly remoteUrl: string;
  readonly productionUrl: string;
  readonly cicdGateScript: string;
  readonly autoShipScript: string;
  readonly headCommitSha: string;
  readonly resolution: "ENV" | "CONTROL_PLANE" | "LOCAL_PATH" | "RESOLVED_LOCAL_DIR" | "FEDERATED";
}

export interface FleetProjectSyncResult {
  readonly id: string;
  readonly name: string;
  readonly localPath: string | null;
  readonly syncState: FleetSyncState;
  readonly headCommitSha: string;
  readonly currentBranch: string;
  readonly isClean: boolean;
  readonly details: string;
  readonly syncedAt: number;
}

export interface FleetProjectSoundcheck {
  readonly id: string;
  readonly name: string;
  readonly localPath: string | null;
  readonly productionUrl: string;
  readonly existsLocally: boolean;
  readonly workingTreeClean: boolean;
  readonly gitHealthScore: number; // 0-25
  readonly architectureScore: number; // 0-25
  readonly securityScore: number; // 0-25
  readonly productionAvailabilityScore: number; // 0-25
  readonly totalScore: number; // 0-100
  readonly grade: SoundcheckGrade;
  readonly eligibleForAutonomousDeploy: boolean;
  readonly recommendations: readonly string[];
}

export interface FleetSyncOptions {
  readonly heal?: boolean;
  readonly forceVirtual?: boolean;
  readonly strict?: boolean;
}

export interface FleetSyncReport {
  readonly timestamp: number;
  readonly totalProjects: number;
  readonly inSyncProjects: number;
  readonly federatedAttestedProjects: number;
  readonly divergedProjects: number;
  readonly fleetMerkleRoot: string;
  readonly results: readonly FleetProjectSyncResult[];
  readonly receipt: string;
}

export interface FleetAuditReport {
  readonly auditedTimestamp: number;
  readonly totalProjects: number;
  readonly fleetAverageScore: number;
  readonly gradeCounts: Readonly<Record<SoundcheckGrade, number>>;
  readonly deploymentAuthorizedQuorum: boolean;
  readonly reports: readonly FleetProjectSoundcheck[];
  readonly fleetMerkleRoot: string;
  readonly receipt: string;
}

export interface FleetHealingResult {
  readonly projectId: string;
  readonly healedMarkers: readonly string[];
  readonly configDriftFixed: boolean;
  readonly status: "HEALED" | "ALREADY_NOMINAL" | "SKIPPED";
  readonly details: string;
}

export interface FleetHealAllReport {
  readonly timestamp: number;
  readonly totalEvaluated: number;
  readonly totalHealed: number;
  readonly results: readonly FleetHealingResult[];
  readonly receipt: string;
}

export type FleetSyncOperationType = "fleet_sync" | "fleet_audit" | "fleet_heal";

export interface FleetSyncReceipt {
  readonly operation: FleetSyncOperationType;
  readonly timestamp: number;
  readonly totalProjects: number;
  readonly fleetMerkleRoot: string;
  readonly receiptSha256: string;
}
