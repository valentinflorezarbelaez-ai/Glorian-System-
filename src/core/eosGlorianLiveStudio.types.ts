/**
 * @fileoverview Type definitions for EosGlorianLiveStudio.
 *
 * Implements SPEC-361 / CHANGE-223: Glorian Live Studio & Interactive Visual HUD.
 * Pure Layer-0 types with zero external dependencies.
 */

export type StudioServerState = "STOPPED" | "STARTING" | "RUNNING" | "STOPPING" | "ERROR";

export type StudioTelemetryType =
  "SWARM_METRIC" | "SCHEDULER_METRIC" | "LEDGER_TX" | "FLEET_STATUS" | "CANVAS_UPDATE" | "AUDIT_PULSE" | "SYSTEM_ALERT";

export interface StudioServerConfig {
  /** Target HTTP port (0 for ephemeral) */
  readonly port?: number;
  /** Bind host address, defaults to '127.0.0.1' */
  readonly host?: string;
  /** Maximum number of recent telemetry events to retain in-memory */
  readonly maxEventsHistory?: number;
  /** Whether to allow local CORS headers */
  readonly enableCors?: boolean;
}

export interface StudioTelemetryEvent {
  readonly id: number;
  readonly timestamp: number;
  readonly type: StudioTelemetryType;
  readonly source: string;
  readonly payload: Record<string, unknown>;
}

export interface StudioSystemMetrics {
  readonly componentId: string;
  readonly version: string;
  readonly lifecycleTier: string;
  readonly specsCount: number;
  readonly modelsCount: number;
  readonly modulesCount: number;
  readonly testsCount: number;
  readonly uptimeSec: number;
  readonly memoryUsageMb: number;
}

export interface StudioSwarmTelemetry {
  readonly leaderId: string;
  readonly term: number;
  readonly nodesCount: number;
  readonly healthyCount: number;
  readonly clusterQuorumMet: boolean;
}

export interface StudioSchedulerTelemetry {
  readonly activeWorkers: number;
  readonly queueDepth: number;
  readonly completedTasks: number;
  readonly stolenTasks: number;
  readonly throughputOpsSec: number;
}

export interface StudioBitemporalTelemetry {
  readonly latestTxId: number;
  readonly datomsCount: number;
  readonly lastValidTime: number;
}

export interface StudioFleetTelemetry {
  readonly registeredCount: number;
  readonly verifiedCount: number;
  readonly averageSoundcheckScore: number;
}

export interface StudioSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly system: StudioSystemMetrics;
  readonly swarm: StudioSwarmTelemetry;
  readonly scheduler: StudioSchedulerTelemetry;
  readonly bitemporal: StudioBitemporalTelemetry;
  readonly fleet: StudioFleetTelemetry;
  readonly recentEvents: readonly StudioTelemetryEvent[];
  readonly integrityHash: string;
}

export interface StudioBitemporalQuery {
  readonly asOfTx?: number;
  readonly asOfValid?: number;
}

export interface StudioBitemporalProjectionResult {
  readonly asOfTx: number;
  readonly asOfValid: number;
  readonly activeEntities: readonly string[];
  readonly factsCount: number;
  readonly queryDurationMs: number;
}

export interface StudioBlastRadiusResult {
  readonly targetNode: string;
  readonly upstreamAncestors: readonly string[];
  readonly downstreamDependents: readonly string[];
  readonly totalImpactedCount: number;
  readonly criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly calculationDurationMs: number;
}

export interface EosGlorianLiveStudioReceipt {
  readonly receiptId: string;
  readonly specId: "SPEC-361";
  readonly changeId: "CHANGE-223";
  readonly timestamp: number;
  readonly serverState: StudioServerState;
  readonly boundAddress: string;
  readonly activeSseClients: number;
  readonly totalEventsBroadcast: number;
  readonly checks: {
    readonly httpHealthRoute: "PASS" | "FAIL";
    readonly hudHtmlDelivery: "PASS" | "FAIL";
    readonly sseStreamMonotonicity: "PASS" | "FAIL";
    readonly bitemporalProjection: "PASS" | "FAIL";
    readonly blastRadiusComputation: "PASS" | "FAIL";
    readonly zeroDependencyPurity: "PASS" | "FAIL";
  };
  readonly integrityHash: string;
}
