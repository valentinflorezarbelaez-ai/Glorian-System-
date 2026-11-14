/**
 * SPEC-243 / CHANGE-122 — Layer-0 Fleet Multi-Repo Ship Orchestrator Types.
 */

export interface FleetProjectRecordInput {
  readonly id: string;
  readonly name: string;
  readonly resolvedLocalDir?: string;
  readonly productionUrl?: string;
  readonly status: string;
  readonly intake: string;
  readonly specification: string;
  readonly audit: string;
  readonly ownerApproval: string;
  readonly authorization: string;
  readonly headCommitSha?: string;
}

export interface OrchestrateFleetShipOptions {
  readonly projectRoot?: string;
  readonly registryRelPath?: string;
  readonly projectsOverride?: readonly FleetProjectRecordInput[];
  readonly probeLocalCheckouts?: boolean;
}

export interface FleetRepoShipStatus {
  readonly id: string;
  readonly name: string;
  readonly lawIvBarrierPassed: boolean;
  readonly missingPreconditions: readonly string[];
  readonly localCheckoutPresent: boolean;
  readonly shipReady: boolean;
  readonly readinessScore: number;
  readonly repoDigestSha256: string;
}

export type FleetVerdictStatus = "FLEET_SHIP_READY" | "FLEET_PARTIAL_BLOCK";

export interface FleetShipOrchestrationReport {
  readonly totalProjects: number;
  readonly authorizedProjects: number;
  readonly blockedProjects: number;
  readonly averageReadinessScore: number;
  readonly fleetVerdict: FleetVerdictStatus;
  readonly projectStatuses: readonly FleetRepoShipStatus[];
  readonly fleetShipDigestSha256: string;
}
