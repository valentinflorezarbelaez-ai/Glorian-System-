#!/usr/bin/env node
/**
 * Generate fleet product scorecards from registry governance (Big Tech EngProd).
 * Optional live probes: set EOS_FLEET_SCORECARD_PROBE=1 to HEAD productionUrl.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFleetProductScorecards } from "../src/core/eosFleetProductScorecard.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "docs", "projects", "registry.json"), "utf8"),
);
const projects = registry.projects || [];
const probeEnabled = process.env.EOS_FLEET_SCORECARD_PROBE === "1" || process.env.EOS_FLEET_SCORECARD_PROBE === "true";

/**
 * @param {string} url
 * @returns {Promise<{ reachable: boolean, httpStatus: number, latencyMs: number, probedAt: string }>}
 */
async function probeUrl(url) {
  const probedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "eos-fleet-scorecard-probe/1.0" },
    });
    clearTimeout(timer);
    return {
      reachable: response.status > 0 && response.status < 500,
      httpStatus: response.status,
      latencyMs: Date.now() - started,
      probedAt,
    };
  } catch {
    return {
      reachable: false,
      httpStatus: 0,
      latencyMs: Date.now() - started,
      probedAt,
    };
  }
}

/** @type {Record<string, { reachable: boolean, httpStatus: number, latencyMs: number, probedAt: string }>} */
const liveProbes = {};
if (probeEnabled) {
  for (const project of projects) {
    if (!project?.id || project.id === "eos-system" || project.status !== "REGISTERED") continue;
    const url = typeof project.productionUrl === "string" ? project.productionUrl : "";
    if (!url.startsWith("https://")) continue;
    liveProbes[project.id] = await probeUrl(url);
  }
}

const result = writeFleetProductScorecards(projectRoot, projects, liveProbes);

const receipt = {
  epistemicState: "FLEET_PRODUCT_SCORECARDS_WITHIN_TESTED_SCOPE",
  generatedAt: new Date().toISOString(),
  probeEnabled,
  probedCount: Object.keys(liveProbes).length,
  written: result.written,
  count: result.scorecards.length,
  grades: Object.fromEntries(
    result.scorecards.map((s) => [
      s.productId,
      {
        score: s.score,
        grade: s.grade,
        liveReachability: s.liveReachability,
        liveProbe: s.liveProbe,
      },
    ]),
  ),
  sha256Receipt: crypto
    .createHash("sha256")
    .update(JSON.stringify(result.scorecards.map((s) => s.sha256Receipt)))
    .digest("hex"),
};

const out = path.join(projectRoot, "docs", "evidence", "FLEET_PRODUCT_SCORECARDS_RECEIPT.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify(receipt, null, 2));
if (result.scorecards.length < 1) process.exitCode = 1;
