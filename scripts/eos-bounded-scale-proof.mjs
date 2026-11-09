#!/usr/bin/env node
/**
 * Bounded scale proof: synthetic load p99 + canary budget + rollback receipt.
 * WITHIN_TESTED_SCOPE — hermetic synthetic only; not production capacity certification.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { EosLoadTestEngine } from "../src/core/eosLoadTestEngine.ts";
import { EosProgressiveCanaryMesh } from "../src/core/eosProgressiveCanaryMesh.ts";
import { buildBreachingCanaryTelemetry, buildCleanCanaryTelemetry } from "../src/core/eosPlatformOpsCeiling.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function sha256(payload) {
  return createHash("sha256").update(payload).digest("hex");
}

const engine = new EosLoadTestEngine(() => performance.now());
const loadReport = await engine.run(
  async () => {
    // Deterministic micro-work so the proof stays hermetic and fast.
    let x = 0;
    for (let i = 0; i < 200; i++) x = (x + i) % 997;
    if (x < 0) throw new Error("unreachable");
  },
  {
    concurrency: 8,
    totalRequests: 64,
    rampUpMs: 0,
    timeoutMs: 1_000,
  },
  {
    p99: 50,
    errorRate: 0.01,
    throughput: 1,
  },
);

const cleanReport = new EosProgressiveCanaryMesh("v75.0.1", "v75.0.0").executeRollout(buildCleanCanaryTelemetry());
const breachReport = new EosProgressiveCanaryMesh("v75.0.1-bad", "v75.0.0").executeRollout(
  buildBreachingCanaryTelemetry(),
);

const p99BudgetMs = 50;
const proof = {
  epistemicState: "BOUNDED_SCALE_PROOF_WITHIN_TESTED_SCOPE",
  generatedAt: new Date().toISOString(),
  load: {
    allSLAPassed: loadReport.allSLAPassed,
    p99Ms: loadReport.latency.p99Ms,
    p99BudgetMs,
    withinBudget: loadReport.latency.p99Ms <= p99BudgetMs,
    errorRate: loadReport.errorRate,
    throughputRps: loadReport.throughputRps,
    sha256Receipt: loadReport.sha256Receipt,
  },
  canary: {
    cleanFinalStage: cleanReport.finalStage,
    cleanVerifiedSafe: cleanReport.verifiedSafe,
    cleanSha256: cleanReport.sha256Receipt,
    breachRollbackExecuted: breachReport.rollbackExecuted,
    breachFinalStage: breachReport.finalStage,
    breachSha256: breachReport.sha256Receipt,
  },
  ok: false,
  sha256Receipt: "",
};

proof.ok =
  proof.load.allSLAPassed &&
  proof.load.withinBudget &&
  proof.canary.cleanVerifiedSafe &&
  proof.canary.breachRollbackExecuted === true;

proof.sha256Receipt = sha256(
  JSON.stringify({
    load: proof.load,
    canary: proof.canary,
    ok: proof.ok,
  }),
);

const outPath = path.join(projectRoot, "docs", "evidence", "BOUNDED_SCALE_PROOF_RECEIPT.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");

console.log(JSON.stringify(proof, null, 2));
console.log(`[SCALE] wrote ${path.relative(projectRoot, outPath).replace(/\\/g, "/")}`);

if (!proof.ok) process.exitCode = 1;
