/**
 * SPEC-249 / CHANGE-124 — Layer-0 Aladdin Systemic Risk & Correlated Contagion Stress Engine.
 * Zero external runtime dependencies (EOS Law V).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deepFreeze } from "./eosKernelPrimitives.ts";
import type {
  AladdinRiskTier,
  AladdinStressOptions,
  AladdinSystemicRiskReport,
} from "./eosAladdinSystemicRiskStressCore.types.ts";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveConfinedPath(projectRoot: string, relPath: string): string {
  const rootAbs = path.resolve(projectRoot);
  const targetAbs = path.resolve(rootAbs, relPath);
  const rel = path.relative(rootAbs, targetAbs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path traversal outside projectRoot is forbidden");
  }
  return targetAbs;
}

function resolvePortfolioSize(projectRoot: string, registryRelPath: string, override?: number): number {
  const confinedPath = resolveConfinedPath(projectRoot, registryRelPath);
  if (typeof override === "number" && Number.isFinite(override)) {
    return Math.max(1, Math.min(256, Math.trunc(override)));
  }
  if (fs.existsSync(confinedPath)) {
    const parsed = JSON.parse(fs.readFileSync(confinedPath, "utf8")) as { projects?: unknown[] };
    if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
      return parsed.projects.length;
    }
  }
  return 9;
}

function nextUniform(prngState: { v: number }): number {
  let x = prngState.v | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  prngState.v = x >>> 0 || 1;
  return (prngState.v % 1_000_000) / 1_000_000;
}

function simulateSingleTrial(
  portfolioSize: number,
  shockProb: number,
  coupling: number,
  prngState: { v: number },
): number {
  const macroEvent = nextUniform(prngState) < shockProb * coupling * 0.35;
  const effectiveProb = macroEvent ? Math.min(0.95, shockProb + coupling * 0.65) : shockProb;
  let failed = 0;
  for (let i = 0; i < portfolioSize; i++) {
    const cascadeBump = failed > 0 ? (failed / portfolioSize) * coupling * 0.35 : 0;
    if (nextUniform(prngState) < Math.min(0.99, effectiveProb + cascadeBump)) {
      failed++;
    }
  }
  return (failed / portfolioSize) * 100;
}

function classifyRiskTier(var99: number): AladdinRiskTier {
  if (var99 <= 25) return "RESILIENT_AAA";
  if (var99 <= 50) return "GUARDED_AA";
  return "SYSTEMIC_CRITICAL";
}

function buildDirectives(tier: AladdinRiskTier, contagionFactor: number): string[] {
  if (tier === "SYSTEMIC_CRITICAL") {
    return [
      "TRIP_FLEET_CIRCUIT_BREAKER: Isolate correlated shared database/region dependencies.",
      `SHED_CONTAGION_COUPLING: Reduce cross-service blast coupling (factor=${contagionFactor}).`,
    ];
  }
  if (tier === "GUARDED_AA") {
    return ["MAINTAIN_CANARY_QUARANTINE: Keep progressive 1%->10% rollout gates active."];
  }
  return ["FLEET_RESILIENT: Tail risk within Sovereign AAA error budget."];
}

export class EosAladdinSystemicRiskStressCore {
  public static runSystemicStressSimulation(options: AladdinStressOptions = {}): AladdinSystemicRiskReport {
    const projectRoot = options.projectRoot ?? process.cwd();
    const registryRelPath = options.registryRelPath ?? "docs/projects/registry.json";
    const portfolioSize = resolvePortfolioSize(projectRoot, registryRelPath, options.portfolioCountOverride);
    const trialsExecuted = Math.max(10, Math.min(5000, Math.trunc(options.trials ?? 200)));
    const seed = (options.seed ?? 42) >>> 0 || 1;
    const shockProb = Math.max(0.001, Math.min(0.95, options.shockProbability ?? 0.06));
    const coupling = Math.max(0, Math.min(0.99, options.contagionCoupling ?? 0.12));

    const prngState = { v: seed };
    const losses: number[] = [];
    for (let t = 0; t < trialsExecuted; t++) {
      losses.push(simulateSingleTrial(portfolioSize, shockProb, coupling, prngState));
    }

    const sorted = [...losses].sort((a, b) => a - b);
    const meanLoss = sorted.reduce((acc, v) => acc + v, 0) / sorted.length;
    const idx95 = Math.min(sorted.length - 1, Math.floor(0.95 * (sorted.length - 1)));
    const idx99 = Math.min(sorted.length - 1, Math.ceil(0.99 * (sorted.length - 1)));
    const tailSlice = sorted.slice(idx99);
    const tailMean = tailSlice.reduce((acc, v) => acc + v, 0) / Math.max(1, tailSlice.length);

    const expectedAvailabilityPercent = round2(Math.max(0, 100 - meanLoss));
    const valueAtRisk95Percent = round2(sorted[idx95]!);
    const valueAtRisk99Percent = round2(sorted[idx99]!);
    const expectedShortfall99Percent = round2(Math.max(valueAtRisk99Percent, tailMean));
    const baselineMean = Math.max(0.5, shockProb * 100);
    const contagionAmplificationFactor = round2(Math.max(1, meanLoss / baselineMean));
    const riskTier = classifyRiskTier(valueAtRisk99Percent);
    const circuitBreakerDirectives = buildDirectives(riskTier, contagionAmplificationFactor);

    const body = {
      portfolioSize,
      trialsExecuted,
      seed,
      expectedAvailabilityPercent,
      valueAtRisk95Percent,
      valueAtRisk99Percent,
      expectedShortfall99Percent,
      contagionAmplificationFactor,
      riskTier,
      circuitBreakerDirectives,
    };
    const aladdinDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
    return deepFreeze({ ...body, aladdinDigestSha256 });
  }
}
