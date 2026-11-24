#!/usr/bin/env node
/**
 * Fleet production SLO probe (customer-facing edge signals).
 *
 * Reads productionUrl from docs/projects/registry.json, probes each HTTPS origin
 * for status + TTFB, derives a coarse availability error budget, and seals
 * docs/evidence/FLEET_PRODUCTION_SLO_RECEIPT.json.
 *
 * Epistemic: SYNTHETIC_EDGE_PROBE_WITHIN_TESTED_SCOPE — not browser RUM / CrUX.
 * Forbidden claims: multi-region SRE, Level-5, FEDERAL_ATO.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "docs/projects/registry.json"), "utf8"));
const projects = (registry.projects || []).filter(
  (p) => typeof p.productionUrl === "string" && p.productionUrl.startsWith("https://"),
);

const AVAILABILITY_SLO = 0.999;
const TTFB_BUDGET_MS = 1500;
const PROBES_PER_TARGET = Number(process.env.EOS_FLEET_SLO_PROBES || 3);

async function probe(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": "eos-fleet-production-slo/1.0" },
    });
    // Drain body so keep-alive sockets do not leak on Node.
    await res.arrayBuffer().catch(() => undefined);
    const ttfbMs = Date.now() - started;
    const ok = res.status >= 200 && res.status < 400;
    return { ok, statusCode: res.status, ttfbMs, isError: !ok || ttfbMs > TTFB_BUDGET_MS * 2 };
  } catch {
    return { ok: false, statusCode: 0, ttfbMs: Date.now() - started, isError: true };
  }
}

const services = [];
for (const project of projects) {
  const samples = [];
  // Warm-up discard (Vercel cold start).
  await probe(project.productionUrl);
  for (let i = 0; i < PROBES_PER_TARGET; i++) {
    samples.push(await probe(project.productionUrl));
  }
  const errors = samples.filter((s) => s.isError).length;
  const successes = samples.length - errors;
  const availability = samples.length === 0 ? 0 : successes / samples.length;
  const p50 = [...samples].sort((a, b) => a.ttfbMs - b.ttfbMs)[Math.floor(samples.length / 2)]?.ttfbMs ?? 0;
  // Small-N honesty: classic 0.1% monthly budget cannot be inferred from <10 probes.
  // With short synthetic bursts, map outcomes to NOMINAL / DEGRADED / EXHAUSTED without
  // freezing deploy on a single cold-start blip.
  let healthState = "NOMINAL_HEALTHY";
  let remainingPct = 100;
  let isDeploymentFrozen = false;
  if (samples.length < 10) {
    if (errors === 0) {
      // Defaults already NOMINAL_HEALTHY / 100 — keep for small-N green probes.
    } else if (availability > 0) {
      healthState = "DEGRADED";
      remainingPct = Number((availability * 100).toFixed(2));
    } else {
      healthState = "BUDGET_EXHAUSTED";
      remainingPct = 0;
      isDeploymentFrozen = true;
    }
  } else {
    const errorBudgetFraction = 1 - AVAILABILITY_SLO;
    const consumed = Math.max(0, AVAILABILITY_SLO - availability) / errorBudgetFraction;
    remainingPct = Math.max(0, Math.min(100, (1 - consumed) * 100));
    healthState = remainingPct <= 0 ? "BUDGET_EXHAUSTED" : errors > 0 ? "DEGRADED" : "NOMINAL_HEALTHY";
    isDeploymentFrozen = remainingPct <= 0;
  }
  services.push({
    serviceId: project.id,
    productionUrlHost: new URL(project.productionUrl).host,
    probes: samples.length,
    errors,
    availability,
    ttfbP50Ms: p50,
    ttfbBudgetMs: TTFB_BUDGET_MS,
    errorBudgetRemainingPct: remainingPct,
    healthState,
    isDeploymentFrozen,
    samplePolicy: samples.length < 10 ? "SMALL_N_SOFT" : "CLASSIC_ERROR_BUDGET",
  });
}

const allOk = services.every((s) => s.healthState === "NOMINAL_HEALTHY");
const receipt = {
  epistemicState: "SYNTHETIC_EDGE_PROBE_WITHIN_TESTED_SCOPE",
  claimsDenied: ["browser RUM", "CrUX field data", "multi-region SRE", "Level-5", "FEDERAL_ATO"],
  measuredAt: new Date().toISOString(),
  availabilitySlo: AVAILABILITY_SLO,
  ttfbBudgetMs: TTFB_BUDGET_MS,
  services,
  metrics: {
    targets: services.length,
    nominal: services.filter((s) => s.healthState === "NOMINAL_HEALTHY").length,
    degraded: services.filter((s) => s.healthState === "DEGRADED").length,
    frozen: services.filter((s) => s.isDeploymentFrozen).length,
    allOk,
  },
};
receipt.sha256 = crypto.createHash("sha256").update(JSON.stringify(receipt)).digest("hex");

const outPath = path.join(root, "docs/evidence/FLEET_PRODUCTION_SLO_RECEIPT.json");
fs.writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
console.log(
  JSON.stringify(
    {
      allOk: receipt.metrics.allOk,
      targets: receipt.metrics.targets,
      nominal: receipt.metrics.nominal,
      degraded: receipt.metrics.degraded,
      receipt: "docs/evidence/FLEET_PRODUCTION_SLO_RECEIPT.json",
      sha256: receipt.sha256,
    },
    null,
    2,
  ),
);
process.exit(allOk ? 0 : 2);
