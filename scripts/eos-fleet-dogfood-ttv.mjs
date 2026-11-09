#!/usr/bin/env node
/**
 * Fleet dogfood TTV (Big Tech EngProd):
 * 1) Control-plane product factory dry-run
 * 2) flow inspect against self + any sibling fleet paths from registry env vars
 *
 * WITHIN_TESTED_SCOPE — records SKIPPED_SIBLING when a fleet checkout is absent.
 * Does not clone remotes or push.
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDemoLedgerManifest,
  loadDefaultIamPolicyPack,
  runBigTechProductFactory,
  writeBigTechFactoryReceipt,
} from "../src/core/eosBigTechProductFactory.ts";
import { resolveFleetRegistryPaths } from "../src/core/eosFleetPathResolver.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const eosBin = path.join(projectRoot, "bin", "eos.mjs");

function msNow() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function loadRegistry() {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, "docs", "projects", "registry.json"), "utf8"));
}

function redactPath(absolutePath) {
  if (!absolutePath) return null;
  // Law VI: never persist machine-local absolute paths in committed evidence.
  return path.basename(path.resolve(absolutePath));
}

function resolveFleetTargets(registry) {
  return resolveFleetRegistryPaths(projectRoot, registry.projects || []).map((t) => ({
    id: t.id,
    name: t.name,
    localPathEnv: t.localPathEnv,
    path: t.path,
    status: t.status,
    resolution: t.resolution,
  }));
}

function flowInspect(repoPath) {
  const t0 = msNow();
  const child = spawnSync(process.execPath, [eosBin, "flow", "inspect", repoPath], {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env,
    timeout: 120_000,
  });
  return {
    ok: child.status === 0,
    durationMs: msNow() - t0,
    exitCode: child.status === null ? 1 : child.status,
    stderrTail: String(child.stderr || "")
      .split("\n")
      .slice(-5)
      .join("\n"),
  };
}

const registry = loadRegistry();
const targets = resolveFleetTargets(registry);
const paths = [];

{
  const t0 = msNow();
  const factory = runBigTechProductFactory(buildDemoLedgerManifest(), {
    projectRoot,
    dryRun: true,
    policies: loadDefaultIamPolicyPack(projectRoot),
  });
  writeBigTechFactoryReceipt(projectRoot, factory);
  paths.push({
    id: "CONTROL_PLANE_PRODUCT_FACTORY",
    ok: factory.status === "SUCCESS" || factory.reason === "SCORECARD_FLOOR",
    durationMs: factory.durationMs || msNow() - t0,
    status: factory.status,
    sha256Receipt: factory.sha256Receipt,
  });
}

const inspectResults = [];
for (const target of targets) {
  if (target.status !== "AVAILABLE") {
    inspectResults.push({
      id: `FLOW_INSPECT:${target.id}`,
      ok: true,
      skipped: true,
      status: "SKIPPED_SIBLING",
      durationMs: 0,
      path: null,
    });
    continue;
  }
  const result = flowInspect(target.path);
  inspectResults.push({
    id: `FLOW_INSPECT:${target.id}`,
    ok: result.ok,
    skipped: false,
    status: result.ok ? "SUCCESS" : "FAILED",
    durationMs: result.durationMs,
    path: redactPath(target.path),
    exitCode: result.exitCode,
  });
}

paths.push(...inspectResults);

const available = targets.filter((t) => t.status === "AVAILABLE").length;
const skipped = targets.filter((t) => t.status === "SKIPPED_SIBLING").length;
const allOk = paths.every((p) => p.ok);
const totalMs = paths.reduce((acc, p) => acc + (p.durationMs || 0), 0);

const receipt = {
  epistemicState: allOk ? "FLEET_DOGFOOD_TTV_WITHIN_TESTED_SCOPE" : "REMEDIATION_REQUIRED",
  generatedAt: new Date().toISOString(),
  catalogFreeze: {
    active: available <= 1,
    rule: "No new OpenSpec ids after 185 until fleet dogfood has >=1 AVAILABLE sibling and this receipt stays green.",
    openSpecCountAtSeal: 180,
    unlocked: available > 1,
  },
  fleet: {
    registered: targets.length,
    available,
    skippedSibling: skipped,
    targets: targets.map((t) => ({
      id: t.id,
      name: t.name,
      localPathEnv: t.localPathEnv,
      path: redactPath(t.path),
      status: t.status,
      resolution: t.resolution,
    })),
  },
  paths,
  metrics: {
    pathCount: paths.length,
    allOk,
    totalDurationMs: totalMs,
    maxPathDurationMs: Math.max(0, ...paths.map((p) => p.durationMs || 0)),
    p99BudgetMs: 180_000,
    withinBudget: Math.max(0, ...paths.map((p) => p.durationMs || 0)) <= 180_000,
    siblingDogfoodReady: available > 1,
  },
  sha256Receipt: "",
};
receipt.sha256Receipt = sha256(
  JSON.stringify({ paths: receipt.paths, fleet: receipt.fleet, metrics: receipt.metrics }),
);

const outDir = path.join(projectRoot, "docs", "evidence");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "FLEET_DOGFOOD_TTV_RECEIPT.json");
fs.writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

console.log(JSON.stringify(receipt, null, 2));
console.log(`[FLEET-DOGFOOD] wrote ${path.relative(projectRoot, outPath)}`);

if (!allOk || !receipt.metrics.withinBudget) process.exitCode = 1;
