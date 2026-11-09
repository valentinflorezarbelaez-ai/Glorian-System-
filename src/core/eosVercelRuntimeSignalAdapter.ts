/**
 * Vercel runtime → ACA signal adapter (Layer-0) — SPEC-107 FR-282
 * Maps provider aggregates into CanaryTelemetryInput. Offline fixtures OK.
 * WITHIN_TESTED_SCOPE — does not call Vercel APIs (I/O stays in scripts).
 */

import fs from "node:fs";
import path from "node:path";

import { deepFreeze } from "./eosKernelPrimitives.ts";
import type { CanaryStage, CanaryTelemetryInput } from "./eosVercelCanaryObservability.ts";

export interface VercelRuntimeErrorCluster {
  readonly name?: string;
  readonly count?: number;
  readonly occurrenceCount?: number;
  readonly route?: string;
}

export interface VercelRuntimeSignalSnapshot {
  readonly deploymentId: string;
  readonly environment?: "production" | "preview";
  readonly stage?: CanaryStage;
  readonly requestCount: number;
  readonly latencyP99Ms: number;
  readonly errorClusters?: readonly VercelRuntimeErrorCluster[];
  readonly errorRate5xx?: number;
}

export interface MappedVercelAcaSignals {
  readonly source: "FIXTURE" | "LIVE_SNAPSHOT";
  readonly signals: readonly CanaryTelemetryInput[];
  readonly totalErrorEvents: number;
}

function clusterCount(cluster: VercelRuntimeErrorCluster): number {
  const n = cluster.occurrenceCount ?? cluster.count ?? 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Pure map: runtime error aggregates + request volume → canary telemetry. */
export function mapVercelRuntimeSnapshotToSignals(
  snapshot: VercelRuntimeSignalSnapshot,
  source: "FIXTURE" | "LIVE_SNAPSHOT" = "LIVE_SNAPSHOT",
): MappedVercelAcaSignals {
  const requestCount = Math.max(1, Math.floor(snapshot.requestCount || 0));
  const totalErrorEvents = (snapshot.errorClusters || []).reduce((acc, c) => acc + clusterCount(c), 0);
  const derivedRate = Math.min(1, totalErrorEvents / requestCount);
  const errorRate5xx =
    typeof snapshot.errorRate5xx === "number" && snapshot.errorRate5xx >= 0
      ? Math.min(1, snapshot.errorRate5xx)
      : derivedRate;

  const signal: CanaryTelemetryInput = deepFreeze({
    deploymentId: String(snapshot.deploymentId || "unknown-deployment"),
    environment: snapshot.environment === "preview" ? "preview" : "production",
    stage: snapshot.stage || "CANARY_1_PCT",
    errorRate5xx,
    latencyP99Ms: Math.max(0, snapshot.latencyP99Ms || 0),
    requestCount,
  });

  return deepFreeze({
    source,
    signals: [signal],
    totalErrorEvents,
  });
}

/** Load a committed fixture snapshot for hermetic CI / offline ACA. */
export function loadVercelRuntimeSignalFixture(
  projectRoot: string,
  relativePath: string = path.join("docs", "evidence", "fixtures", "vercel-runtime-signals.json"),
): MappedVercelAcaSignals {
  const filePath = path.join(projectRoot, relativePath);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    readonly snapshots?: readonly VercelRuntimeSignalSnapshot[];
  };
  const snapshots = Array.isArray(parsed.snapshots) ? parsed.snapshots : [];
  if (snapshots.length === 0) {
    throw new Error("VERCEL_RUNTIME_FIXTURE_EMPTY");
  }
  const signals: CanaryTelemetryInput[] = [];
  let totalErrorEvents = 0;
  for (const snap of snapshots) {
    const mapped = mapVercelRuntimeSnapshotToSignals(snap, "FIXTURE");
    signals.push(...mapped.signals);
    totalErrorEvents += mapped.totalErrorEvents;
  }
  return deepFreeze({ source: "FIXTURE", signals, totalErrorEvents });
}
