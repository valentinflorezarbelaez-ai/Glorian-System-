#!/usr/bin/env node
/**
 * Ingest product-canary probe samples into EosMultiWindowSloGovernor and seal a receipt.
 * Exit 2 when deployment is frozen (pages on-call via eos-sre-burn-rate.yml).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosMultiWindowSloGovernor } from "../src/core/eosMultiWindowSloGovernor.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canaryPath = path.join(root, "docs/evidence/PRODUCT_CANARY_PERFORMANCE_TALENT_GROUP_RECEIPT.json");
if (!fs.existsSync(canaryPath)) {
  console.error("Missing PTG product canary receipt — run npm run canary:product first");
  process.exit(1);
}

const canary = JSON.parse(fs.readFileSync(canaryPath, "utf8"));
const serviceId = "performance-talent-group";
const now = Date.now();
const events = (canary.probes || []).map((p, i) => ({
  timestamp: now - (canary.probes.length - i) * 60_000,
  isError: Boolean(p.isError),
  statusCode: p.statusCode || (p.isError ? 500 : 200),
  latencyMs: p.latencyMs,
}));

const gov = new EosMultiWindowSloGovernor(0.999);
gov.registerService({ serviceId, availabilitySlo: 0.999, latencyThresholdMs: 800 });
gov.ingestBatch(serviceId, events);
const report = gov.evaluateService(serviceId, now);

const out = {
  measuredAt: new Date().toISOString(),
  serviceId,
  canarySha256: canary.sha256,
  report,
  onCallRunbook: "docs/runbooks/ON_CALL.md",
};
const outPath = path.join(root, "docs/evidence/SRE_BURN_RATE_PTG_RECEIPT.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

console.log(
  JSON.stringify(
    {
      isDeploymentFrozen: report.isDeploymentFrozen,
      healthState: report.healthState,
      errorBudgetRemainingPct: report.errorBudgetRemainingPct,
      activeAlerts: report.activeAlerts,
      receipt: "docs/evidence/SRE_BURN_RATE_PTG_RECEIPT.json",
    },
    null,
    2,
  ),
);

if (report.isDeploymentFrozen) process.exit(2);
