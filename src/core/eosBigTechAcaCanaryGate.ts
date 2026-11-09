/**
 * Big Tech ACA + Progressive Canary gate (Layer-0)
 * Composes SPEC-042 (mesh), SPEC-066 / SPEC-156 (statistical ACA).
 * Signal-driven rollback + incident receipt stub on FAIL.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { EosCanaryAnalysisEngine, type CanaryMetricConfig } from "./eosCanaryAnalysisEngine.ts";
import { deepFreeze } from "./eosKernelPrimitives.ts";
import {
  EosProgressiveCanaryMesh,
  type CanaryRolloutReport,
  type CanaryTelemetry,
} from "./eosProgressiveCanaryMesh.ts";

export interface AcaCanaryGateInput {
  readonly versionTarget: string;
  readonly previousStableVersion: string;
  readonly telemetrySequence: readonly CanaryTelemetry[];
  readonly baselineSamples: Record<string, number[]>;
  readonly canarySamples: Record<string, number[]>;
  readonly metricConfigs?: readonly CanaryMetricConfig[];
}

export interface AcaCanaryGateResult {
  readonly verdict: "PASS" | "MARGINAL" | "FAIL" | "ROLLED_BACK_SAFE";
  readonly acaVerdict: "PASS" | "MARGINAL" | "FAIL";
  readonly canaryScore: number;
  readonly mesh: CanaryRolloutReport;
  readonly incidentRequired: boolean;
  readonly sha256Receipt: string;
}

const DEFAULT_METRICS: readonly CanaryMetricConfig[] = deepFreeze([
  { name: "errorRate", importance: "HARD", upperBound: 0.001 },
  { name: "p99LatencyMs", importance: "HARD", upperBound: 500 },
  { name: "memoryMb", importance: "SOFT", upperBound: 1024 },
]);

/** Run progressive mesh then fail-closed if ACA reports HARD FAIL. */
export function runBigTechAcaCanaryGate(input: AcaCanaryGateInput): AcaCanaryGateResult {
  const aca = new EosCanaryAnalysisEngine().analyze(
    input.baselineSamples,
    input.canarySamples,
    input.metricConfigs ?? DEFAULT_METRICS,
  );
  // ACA hard breach gates promotion: no stage advances, so the mesh cannot reach FULL_PRODUCTION_100_PCT.
  const acaHardFail = aca.verdict === "FAIL" || aca.hardFailCount > 0;
  const mesh = new EosProgressiveCanaryMesh(input.versionTarget, input.previousStableVersion);
  const meshReport = mesh.executeRollout(acaHardFail ? [] : [...input.telemetrySequence]);

  let verdict: AcaCanaryGateResult["verdict"] = "PASS";
  let incidentRequired = false;

  if (meshReport.rollbackExecuted) {
    verdict = "ROLLED_BACK_SAFE";
    incidentRequired = true;
  } else if (acaHardFail) {
    verdict = "FAIL";
    incidentRequired = true;
  } else if (aca.verdict === "MARGINAL" || !meshReport.verifiedSafe) {
    verdict = "MARGINAL";
  }

  const sha256Receipt = crypto
    .createHash("sha256")
    .update(
      `ACA_CANARY:${input.versionTarget}:${verdict}:${aca.verdict}:${aca.canaryScore}:${meshReport.sha256Receipt}`,
    )
    .digest("hex");

  return deepFreeze({
    verdict,
    acaVerdict: aca.verdict,
    canaryScore: aca.canaryScore,
    mesh: meshReport,
    incidentRequired,
    sha256Receipt,
  });
}

/** Persist canary/incident evidence under docs/evidence (control-plane only). */
export function writeAcaCanaryEvidence(
  projectRoot: string,
  result: AcaCanaryGateResult,
): { readonly canaryPath: string; readonly incidentPath: string | null } {
  const evidenceDir = path.join(projectRoot, "docs", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const canaryPath = path.join(evidenceDir, "BIGTECH_ACA_CANARY_RECEIPT.json");
  const payload = {
    epistemicState:
      result.verdict === "PASS"
        ? "ACA_CANARY_PASS_WITHIN_TESTED_SCOPE"
        : result.incidentRequired
          ? "REMEDIATION_REQUIRED"
          : "AUDIT_EXECUTED",
    generatedAt: new Date().toISOString(),
    verdict: result.verdict,
    acaVerdict: result.acaVerdict,
    canaryScore: result.canaryScore,
    meshFinalStage: result.mesh.finalStage,
    meshVerifiedSafe: result.mesh.verifiedSafe,
    rollbackExecuted: result.mesh.rollbackExecuted,
    incidentRequired: result.incidentRequired,
    sha256Receipt: result.sha256Receipt,
  };
  fs.writeFileSync(canaryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  let incidentPath: string | null = null;
  if (result.incidentRequired) {
    incidentPath = path.join(evidenceDir, "INCIDENT_CANARY_ROLLBACK_RECEIPT.json");
    fs.writeFileSync(
      incidentPath,
      `${JSON.stringify(
        {
          epistemicState: "REMEDIATION_REQUIRED",
          generatedAt: new Date().toISOString(),
          trigger: "ACA_OR_MESH_ROLLBACK",
          requiredNext: ["blameless_postmortem", "remediation_correlate", "revalidation"],
          canaryReceipt: result.sha256Receipt,
          sha256Receipt: crypto
            .createHash("sha256")
            .update(`INCIDENT:${result.sha256Receipt}`)
            .digest("hex"),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
  return deepFreeze({ canaryPath, incidentPath });
}

/** Healthy dogfood samples for CI seal (identical distributions → PASS). */
export function buildHealthyAcaDogfoodInput(): AcaCanaryGateInput {
  const healthy = (stage: CanaryTelemetry["stage"]): CanaryTelemetry =>
    deepFreeze({
      stage,
      sampleRequests: 10_000,
      failedRequests: 0,
      p99LatencyMs: 40,
      baselineP99LatencyMs: 42,
    });
  return deepFreeze({
    versionTarget: "v75.1.0",
    previousStableVersion: "v75.0.0",
    telemetrySequence: [
      healthy("CANARY_1_PCT"),
      healthy("CANARY_5_PCT"),
      healthy("CANARY_25_PCT"),
      healthy("FULL_PRODUCTION_100_PCT"),
    ],
    baselineSamples: {
      errorRate: [0.00001, 0.00002, 0.00001, 0.000015],
      p99LatencyMs: [40, 41, 39, 42],
      memoryMb: [256, 260, 258, 255],
    },
    canarySamples: {
      errorRate: [0.00001, 0.000012, 0.000011, 0.00001],
      p99LatencyMs: [38, 40, 39, 41],
      memoryMb: [250, 252, 249, 251],
    },
  });
}
