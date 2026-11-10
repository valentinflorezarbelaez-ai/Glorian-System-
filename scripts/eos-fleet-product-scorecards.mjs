#!/usr/bin/env node
/**
 * Generate fleet product scorecards from registry governance (Big Tech EngProd).
 * Optional live probes: set EOS_FLEET_SCORECARD_PROBE=1 to HEAD productionUrl.
 * SSRF-hardened: HTTPS allowlisted hosts only, redirects rejected (manual).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFleetProductScorecards } from "../src/core/eosFleetProductScorecard.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(projectRoot, "docs", "projects", "registry.json"), "utf8"));
const projects = registry.projects || [];
const probeEnabled = process.env.EOS_FLEET_SCORECARD_PROBE === "1" || process.env.EOS_FLEET_SCORECARD_PROBE === "true";

const ALLOWED_HOST_SUFFIXES = Object.freeze([".vercel.app"]);

/**
 * @param {string} urlString
 * @returns {boolean}
 */
function isAllowedProductionUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host === "metadata.google.internal"
    ) {
      return false;
    }
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host)) {
      return false;
    }
    if (host.includes(":")) return false; // reject IPv6 literals
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
  } catch {
    return false;
  }
}

/**
 * @param {string} url
 * @returns {Promise<{ reachable: boolean, httpStatus: number, latencyMs: number, probedAt: string }>}
 */
async function probeUrl(url) {
  const probedAt = new Date().toISOString();
  const started = Date.now();
  if (!isAllowedProductionUrl(url)) {
    return { reachable: false, httpStatus: 0, latencyMs: 0, probedAt };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "eos-fleet-scorecard-probe/1.0" },
    });
    clearTimeout(timer);
    // Reject redirects — never follow to runner-local / private targets.
    if (response.status >= 300 && response.status < 400) {
      return {
        reachable: false,
        httpStatus: response.status,
        latencyMs: Date.now() - started,
        probedAt,
      };
    }
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

/** @type {Record<string, { reachable: boolean, httpStatus: number, latencyMs: number, probedAt: string, policy: string }>} */
const liveProbes = {};
if (probeEnabled) {
  for (const project of projects) {
    if (!project?.id || project.id === "eos-system" || project.status !== "REGISTERED") continue;
    const probedAt = new Date().toISOString();
    const url = typeof project.productionUrl === "string" ? project.productionUrl.trim() : "";
    if (!url) {
      liveProbes[project.id] = {
        reachable: false,
        httpStatus: 0,
        latencyMs: 0,
        probedAt,
        policy: "MISSING_URL",
      };
      continue;
    }
    if (!url.startsWith("https://")) {
      liveProbes[project.id] = {
        reachable: false,
        httpStatus: 0,
        latencyMs: 0,
        probedAt,
        policy: "REJECTED_SCHEME",
      };
      continue;
    }
    if (!isAllowedProductionUrl(url)) {
      // Explicit policy reject — never credit neutral "unprobed" reachability.
      liveProbes[project.id] = {
        reachable: false,
        httpStatus: 0,
        latencyMs: 0,
        probedAt,
        policy: "REJECTED_HOST",
      };
      continue;
    }
    liveProbes[project.id] = { ...(await probeUrl(url)), policy: "ALLOWED" };
  }
}

const result = writeFleetProductScorecards(projectRoot, projects, liveProbes);

const receipt = {
  epistemicState: "FLEET_PRODUCT_SCORECARDS_WITHIN_TESTED_SCOPE",
  generatedAt: new Date().toISOString(),
  probeEnabled,
  probedCount: Object.keys(liveProbes).length,
  ssrfPolicy: "https-vercel-app-allowlist-no-redirect",
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
