/**
 * Fleet product scorecards (Layer-0) — EngProd adoption beyond demo-ledger.
 * Deterministic grades from registry governance fields (SPEC-100 / SPEC-124).
 * Optional live probe signals are pure inputs (I/O stays in scripts).
 * WITHIN_TESTED_SCOPE — not live production UX metrics.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { deepFreeze } from "./eosKernelPrimitives.ts";

export interface FleetRegistryProject {
  readonly id: string;
  readonly name?: string;
  readonly status?: string;
  readonly intake?: string;
  readonly specification?: string;
  readonly audit?: string;
  readonly authorization?: string;
  readonly productionUrl?: string;
}

/** Optional HTTP probe result supplied by the scorecard script (never fetched in Layer-0). */
export interface FleetLiveProbeSignal {
  readonly reachable: boolean;
  readonly httpStatus: number;
  readonly latencyMs: number;
  readonly probedAt: string;
  /** Present when probing was attempted; REJECTED_* means SSRF/policy deny without network I/O. */
  readonly policy?: "ALLOWED" | "REJECTED_HOST" | "REJECTED_SCHEME" | "MISSING_URL";
}

export interface FleetProductScorecard {
  readonly productId: string;
  readonly name: string;
  readonly specCoverage: number;
  readonly gatePassRate: number;
  readonly mutationFloor: number;
  readonly layer0Purity: number;
  readonly timeToGreenMs: number;
  readonly blastRadiusKnown: number;
  readonly liveReachability: number;
  readonly score: number;
  readonly grade: "A+" | "A" | "B" | "C" | "F";
  readonly liveProbe: FleetLiveProbeSignal | null;
  readonly epistemicState: "FLEET_PRODUCT_SCORECARD_WITHIN_TESTED_SCOPE";
  readonly sha256Receipt: string;
}

function gradeFor(score: number): FleetProductScorecard["grade"] {
  if (score >= 97) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  return "F";
}

function pct(ok: boolean, weight = 100): number {
  return ok ? weight : Math.max(0, weight - 40);
}

function liveReachabilityPct(liveProbe: FleetLiveProbeSignal | null | undefined): number {
  if (!liveProbe) return 70;
  if (
    liveProbe.policy === "REJECTED_HOST" ||
    liveProbe.policy === "REJECTED_SCHEME" ||
    liveProbe.policy === "MISSING_URL"
  ) {
    return 20;
  }
  if (!liveProbe.reachable) return 30;
  if (liveProbe.httpStatus >= 500) return 40;
  if (liveProbe.httpStatus >= 400) return 55;
  if (liveProbe.latencyMs > 2000) return 75;
  if (liveProbe.latencyMs > 800) return 85;
  return 100;
}

/** Build one deterministic scorecard from registry governance posture (+ optional probe). */
export function buildFleetProductScorecard(
  project: FleetRegistryProject,
  liveProbe?: FleetLiveProbeSignal | null,
): FleetProductScorecard {
  const productId = String(project.id || "").trim();
  const intakeOk = project.intake === "INTAKE_COMPLETE";
  const specOk = project.specification === "SPECIFICATION_APPROVED";
  const auditOk = project.audit === "AUDIT_COMPLETE";
  const authOk =
    project.authorization === "LEVEL_3_PRODUCTION_AUTHORIZED" || project.authorization === "LEVEL_2_AUTHORIZED";
  const registered = project.status === "REGISTERED";
  const hasUrl = typeof project.productionUrl === "string" && project.productionUrl.startsWith("https://");
  const probe = liveProbe && typeof liveProbe === "object" ? liveProbe : null;

  const specCoverage = pct(intakeOk && specOk);
  const gatePassRate = pct(auditOk && registered);
  const mutationFloor = pct(authOk, 90);
  const layer0Purity = 100;
  const blastRadiusKnown = pct(hasUrl, 95);
  const liveReachability = liveReachabilityPct(probe);
  const timeToGreenMs = authOk && auditOk ? (probe?.reachable ? 2800 : 3500) : 12000;

  const score = Math.round(
    specCoverage * 0.22 +
      gatePassRate * 0.22 +
      mutationFloor * 0.18 +
      layer0Purity * 0.13 +
      blastRadiusKnown * 0.12 +
      liveReachability * 0.13,
  );

  const base = {
    productId,
    name: String(project.name || productId),
    specCoverage,
    gatePassRate,
    mutationFloor,
    layer0Purity,
    timeToGreenMs,
    blastRadiusKnown,
    liveReachability,
    score,
    grade: gradeFor(score),
    liveProbe: probe,
    epistemicState: "FLEET_PRODUCT_SCORECARD_WITHIN_TESTED_SCOPE" as const,
  };

  return deepFreeze({
    ...base,
    sha256Receipt: crypto.createHash("sha256").update(JSON.stringify(base)).digest("hex"),
  });
}

export type FleetLiveProbeMap = Readonly<Record<string, FleetLiveProbeSignal>>;

/** Persist scorecards under docs/products/<id>/scorecard.json (control-plane only). */
export function writeFleetProductScorecards(
  projectRoot: string,
  projects: readonly FleetRegistryProject[],
  liveProbes: FleetLiveProbeMap = {},
): {
  readonly written: readonly string[];
  readonly scorecards: readonly FleetProductScorecard[];
} {
  const written: string[] = [];
  const scorecards: FleetProductScorecard[] = [];
  for (const project of projects) {
    if (!project?.id || project.id === "eos-system") continue;
    if (project.status !== "REGISTERED") continue;
    const scorecard = buildFleetProductScorecard(project, liveProbes[project.id] ?? null);
    scorecards.push(scorecard);
    const dir = path.join(projectRoot, "docs", "products", scorecard.productId);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, "scorecard.json");
    fs.writeFileSync(target, `${JSON.stringify(scorecard, null, 2)}\n`, "utf8");
    written.push(path.relative(projectRoot, target).replaceAll("\\", "/"));
  }
  return deepFreeze({ written, scorecards });
}
