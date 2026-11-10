#!/usr/bin/env node
/**
 * Product canary — one fleet sibling with measured deploy probe, error budget, rollback.
 * Default target: performance-talent-group (PTG). Override: --sibling=donaciones
 *
 * Usage:
 *   node scripts/product-canary-sibling.mjs
 *   node scripts/product-canary-sibling.mjs --sibling=donaciones
 *   npm run canary:product
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosVercelCanaryObservability } from "../src/core/eosVercelCanaryObservability.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siblingArg = process.argv.find((a) => a.startsWith("--sibling="));
const siblingId = siblingArg ? siblingArg.slice("--sibling=".length) : "performance-talent-group";

const registry = JSON.parse(fs.readFileSync(path.join(root, "docs/projects/registry.json"), "utf8"));
const project = (registry.projects || []).find((p) => p.id === siblingId);
if (!project?.productionUrl) {
  console.error(`Unknown sibling or missing productionUrl: ${siblingId}`);
  process.exit(1);
}

async function probeOnce() {
  const started = Date.now();
  let statusCode = 0;
  let ok = false;
  try {
    const res = await fetch(project.productionUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": "eos-product-canary/1.0" },
    });
    statusCode = res.status;
    ok = res.status >= 200 && res.status < 400;
  } catch {
    statusCode = 0;
    ok = false;
  }
  return { latencyMs: Date.now() - started, statusCode, isError: !ok };
}

// Cold-start warm-up (discarded) — Vercel edge often fails the first hit.
await probeOnce();
await new Promise((r) => setTimeout(r, 250));

const probes = Number(process.env.EOS_CANARY_PROBES || 50);
const samples = [];
for (let i = 0; i < probes; i++) {
  let sample = await probeOnce();
  // One retry on transport failure so transient DNS/TLS does not burn the budget.
  if (sample.statusCode === 0) {
    await new Promise((r) => setTimeout(r, 200));
    sample = await probeOnce();
  }
  samples.push(sample);
}

const requestCount = samples.length;
const errorCount = samples.filter((s) => s.isError).length;
const errorRate5xx = requestCount > 0 ? errorCount / requestCount : 1;
const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
const p99Index = Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.99) - 1);
const latencyP99Ms = latencies[Math.max(0, p99Index)] ?? 9999;

const deploymentId = `live_${siblingId}_${new Date().toISOString().replace(/[:.]/g, "-")}`;
const evaluation = EosVercelCanaryObservability.evaluateMetrics({
  deploymentId,
  environment: "production",
  stage: "CANARY_5_PCT",
  errorRate5xx,
  latencyP99Ms,
  requestCount,
});

const rollbackPlan = {
  trigger: evaluation.decision === "ROLLBACK_TRIGGERED",
  actions: [
    "Freeze progressive delivery (hold canary stage).",
    `vercel rollback --yes for project ${siblingId} to last READY production deployment (operator).`,
    "Open GitHub incident with label incident; page on-call via docs/runbooks/ON_CALL.md.",
    "Re-run npm run canary:product after fix; require PROCEED_TO_NEXT_STAGE before 25%/100%.",
  ],
};

const receipt = {
  schema: "eos.product-canary.v1",
  siblingId,
  productionUrl: project.productionUrl,
  authorization: project.authorization,
  measuredAt: new Date().toISOString(),
  probes: samples,
  metrics: { requestCount, errorCount, errorRate5xx, latencyP99Ms },
  evaluation,
  rollbackPlan,
  epistemic: evaluation.decision === "ROLLBACK_TRIGGERED" ? "REMEDIATION_REQUIRED" : "WITHIN_TESTED_SCOPE",
};
receipt.sha256 = crypto
  .createHash("sha256")
  .update(JSON.stringify({ ...receipt, sha256: undefined }))
  .digest("hex");

const outDir = path.join(root, "docs/evidence");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `PRODUCT_CANARY_${siblingId.toUpperCase().replace(/-/g, "_")}_RECEIPT.json`);
fs.writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");

console.log(
  JSON.stringify(
    {
      ok: evaluation.decision !== "ROLLBACK_TRIGGERED",
      siblingId,
      decision: evaluation.decision,
      canaryHealthIndex: evaluation.canaryHealthIndex,
      errorBudgetRemainingPercent: evaluation.errorBudgetRemainingPercent,
      receipt: path.relative(root, outPath).replaceAll("\\", "/"),
      sha256: receipt.sha256,
    },
    null,
    2,
  ),
);

if (evaluation.decision === "ROLLBACK_TRIGGERED") process.exit(2);
