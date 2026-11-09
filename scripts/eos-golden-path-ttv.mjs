#!/usr/bin/env node
/**
 * Three golden-path dogfood runs with time-to-value (TTV) receipts.
 * Paths: Mission Golden Path · Platform Ops Ceiling · Turbo Verify
 * WITHIN_TESTED_SCOPE — hermetic local dogfood; not production SLA accreditation.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { runMissionGoldenPath } from "../src/core/eosMissionGoldenPathOrchestrator.ts";
import { EosPlatformOpsCeiling } from "../src/core/eosPlatformOpsCeiling.ts";
import { runTurboPipeline } from "../src/core/eosTurboEngine.ts";
import {
  buildDemoLedgerManifest,
  loadDefaultIamPolicyPack,
  runBigTechProductFactory,
  writeBigTechFactoryReceipt,
} from "../src/core/eosBigTechProductFactory.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function msNow() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function sha256(payload) {
  return createHash("sha256").update(payload).digest("hex");
}

const paths = [];

{
  const t0 = msNow();
  const result = runMissionGoldenPath("Dogfood TTV: seal architecture and turbo verify for eos-system", {
    projectRoot,
    target: "eos-system",
    domainHint: "platform",
    sealLedger: false,
  });
  const durationMs = msNow() - t0;
  paths.push({
    id: "MISSION_GOLDEN_PATH",
    ok: result.status === "SUCCESS",
    durationMs: result.durationMs || durationMs,
    status: result.status,
    epistemicState: result.epistemicState,
    sha256Receipt: result.sha256Receipt,
  });
}

{
  const t0 = msNow();
  const attestation = EosPlatformOpsCeiling.runCeilingAttestation({
    projectRoot,
    controlPlanePristine: true,
    runCanary: true,
  });
  const durationMs = msNow() - t0;
  paths.push({
    id: "PLATFORM_OPS_CEILING",
    ok: attestation.ceilingMet === true,
    durationMs: attestation.durationMs || durationMs,
    status: attestation.ceilingMet ? "SUCCESS" : "FAILED",
    epistemicState: attestation.epistemicState,
    sha256Receipt: attestation.sha256Receipt,
  });
}

{
  const t0 = msNow();
  const turbo = runTurboPipeline(projectRoot);
  const durationMs = msNow() - t0;
  paths.push({
    id: "TURBO_VERIFY",
    ok: turbo.success === true,
    durationMs,
    status: turbo.success ? "SUCCESS" : "FAILED",
    epistemicState: turbo.success ? "TURBO_PASS_WITHIN_TESTED_SCOPE" : "REMEDIATION_REQUIRED",
    sha256Receipt: sha256(JSON.stringify(turbo.stages?.map((s) => [s.stageId, s.status]) || [])),
  });
}

{
  const t0 = msNow();
  const factory = runBigTechProductFactory(buildDemoLedgerManifest(), {
    projectRoot,
    dryRun: true,
    policies: loadDefaultIamPolicyPack(projectRoot),
  });
  writeBigTechFactoryReceipt(projectRoot, factory);
  const durationMs = msNow() - t0;
  const factoryOk =
    factory.status === "SUCCESS" || (factory.status === "BLOCKED" && factory.reason === "SCORECARD_FLOOR");
  paths.push({
    id: "PRODUCT_FACTORY_E2E",
    ok: factoryOk,
    durationMs: factory.durationMs || durationMs,
    status: factory.status,
    epistemicState: factory.epistemicState,
    sha256Receipt: factory.sha256Receipt,
  });
}

const allOk = paths.every((p) => p.ok);
const totalMs = paths.reduce((acc, p) => acc + p.durationMs, 0);
const p99BudgetMs = 120_000;
const receipt = {
  epistemicState: allOk ? "GOLDEN_PATH_TTV_WITHIN_TESTED_SCOPE" : "REMEDIATION_REQUIRED",
  generatedAt: new Date().toISOString(),
  paths,
  metrics: {
    pathCount: paths.length,
    allOk,
    totalDurationMs: totalMs,
    maxPathDurationMs: Math.max(...paths.map((p) => p.durationMs)),
    p99BudgetMs,
    withinBudget: Math.max(...paths.map((p) => p.durationMs)) <= p99BudgetMs,
  },
  sha256Receipt: "",
};
receipt.sha256Receipt = sha256(JSON.stringify({ paths: receipt.paths, metrics: receipt.metrics }));

const outDir = path.join(projectRoot, "docs", "evidence");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "GOLDEN_PATH_TTV_RECEIPT.json");
fs.writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

console.log(JSON.stringify(receipt, null, 2));
console.log(`[TTV] wrote ${path.relative(projectRoot, outPath).replace(/\\/g, "/")}`);

if (!allOk || !receipt.metrics.withinBudget) {
  process.exitCode = 1;
}
