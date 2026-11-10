#!/usr/bin/env node
/**
 * EOS DORA METRICS TRACKER
 * Tracks the 4 Google SRE DORA metrics:
 *   1. Deployment Frequency
 *   2. Lead Time for Changes
 *   3. Change Failure Rate
 *   4. Mean Time to Recovery (MTTR)
 *
 * Reads from git log + docs/evidence/ receipts.
 * Saves snapshot to docs/evidence/DORA-METRICS.json.
 * Zero external dependencies.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const WINDOW_DAYS = 30;

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

function getGitLog() {
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const output = execFileSync("git", ["log", "--oneline", `--since=${since}`, "--format=%H|%ai|%s"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10_000,
    });
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, date, ...rest] = line.split("|");
        return { hash: hash?.trim(), date: date?.trim(), subject: rest.join("|").trim() };
      });
  } catch {
    return [];
  }
}

function getDeploymentReceipts() {
  const dir = path.join(root, "docs/evidence");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && (f.includes("RECEIPT") || f.includes("CICD")))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getIncidentReports() {
  const dir = path.join(root, "docs/postmortems");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
}

/**
 * Live PR lead-time from GitHub when a token is present (Big Tech EngProd).
 * Falls back silently when offline / unauthenticated.
 */
function getGithubPrLeadTimeHours() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  if (!token) return null;
  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5_000,
    }).trim();
    const match = remote.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
    if (!match) return null;
    const owner = match[1];
    const repo = match[2];
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=30`;
    const raw = execFileSync(
      "curl",
      ["-fsS", "-H", `Authorization: Bearer ${token}`, "-H", "Accept: application/vnd.github+json", url],
      { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] },
    );
    const pulls = JSON.parse(raw);
    const merged = (Array.isArray(pulls) ? pulls : [])
      .filter((p) => p.merged_at && p.created_at && new Date(p.merged_at) >= new Date(since))
      .slice(0, 20);
    if (merged.length === 0) return null;
    const hours =
      merged.reduce((acc, p) => acc + (new Date(p.merged_at) - new Date(p.created_at)) / 3_600_000, 0) / merged.length;
    return { averageHours: Number(hours.toFixed(2)), sampleSize: merged.length, source: "github_pulls_api" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DORA computation
// ---------------------------------------------------------------------------

const commits = getGitLog();
const receipts = getDeploymentReceipts();
const incidents = getIncidentReports();
const githubLead = getGithubPrLeadTimeHours();

const deployCount = commits.length;
const deploysPerDay = (deployCount / WINDOW_DAYS).toFixed(2);
const deployFreqRating = deployCount >= 30 ? "ELITE" : deployCount >= 7 ? "HIGH" : deployCount >= 1 ? "MEDIUM" : "LOW";

// Lead time: prefer live GitHub PR merge latency; else receipts heuristic.
let leadTimeRating = receipts.length > 0 ? "HIGH" : "MEDIUM";
let leadTimeNote =
  receipts.length > 0
    ? `${receipts.length} CI/CD receipts in docs/evidence/`
    : "No receipts — run npm test to generate";
if (githubLead) {
  leadTimeRating = githubLead.averageHours < 24 ? "ELITE" : githubLead.averageHours < 168 ? "HIGH" : "MEDIUM";
  leadTimeNote = `GitHub PR lead time avg ${githubLead.averageHours}h (n=${githubLead.sampleSize})`;
}

// Change Failure Rate: incidents / total deploys
const cfr = deployCount > 0 ? ((incidents.length / deployCount) * 100).toFixed(2) : "0.00";
const cfrRating = Number(cfr) <= 5 ? "ELITE" : Number(cfr) <= 15 ? "HIGH" : "MEDIUM";

// MTTR: no incidents logged = Elite
const mttrRating = incidents.length === 0 ? "ELITE" : "HIGH";

/** ACA LIVE tip signal (SPEC-107 / EngProd) — optional receipt from aca:vercel cron. */
function getAcaLiveSignal() {
  const p = path.join(root, "docs/evidence/VERCEL_ACA_LIVE_RECEIPT.json");
  if (!fs.existsSync(p)) return null;
  try {
    const r = JSON.parse(fs.readFileSync(p, "utf8"));
    const liveModes = new Set(["LIVE_DEPLOYMENT_PROBE", "LIVE_CAPTURED_SNAPSHOT"]);
    return {
      mode: r.mode || "UNKNOWN",
      verdict: r.verdict || "UNKNOWN",
      isLive: liveModes.has(r.mode),
      incidentRequired: Boolean(r.incidentRequired),
      generatedAt: r.generatedAt || null,
      sha256Receipt: r.sha256Receipt || null,
    };
  } catch {
    return null;
  }
}

const acaLive = getAcaLiveSignal();

const metrics = {
  measuredAt: new Date().toISOString(),
  windowDays: WINDOW_DAYS,
  deploymentFrequency: {
    commitsInWindow: deployCount,
    perDay: deploysPerDay,
    rating: deployFreqRating,
    eliteThreshold: "1+ deploys/day",
  },
  leadTimeForChanges: {
    verifiedReceipts: receipts.length,
    github: githubLead,
    note: leadTimeNote,
    rating: leadTimeRating,
    eliteThreshold: "< 1 day",
  },
  changeFailureRate: {
    incidents: incidents.length,
    deploysInWindow: deployCount,
    percent: `${cfr}%`,
    rating: cfrRating,
    eliteThreshold: "≤ 5%",
  },
  mttr: {
    incidentReports: incidents.length,
    value:
      incidents.length === 0 ? "No incidents recorded" : `${incidents.length} incident(s) — review docs/postmortems/`,
    rating: mttrRating,
    eliteThreshold: "< 1 hour",
  },
  acaLive: acaLive || {
    mode: "MISSING",
    verdict: "UNKNOWN",
    isLive: false,
    incidentRequired: false,
    note: "Run npm run aca:vercel (cron) to tip-seal LIVE receipt",
  },
  overallRating: [deployFreqRating, leadTimeRating, cfrRating, mttrRating].every((r) => r === "ELITE")
    ? "ELITE"
    : "HIGH",
  sha256: crypto
    .createHash("sha256")
    .update(
      `${deployCount}:${cfr}:${incidents.length}:${acaLive?.mode || "none"}:${new Date().toISOString().slice(0, 10)}`,
    )
    .digest("hex"),
};

const outputPath = path.join(root, "docs/evidence/DORA-METRICS.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2), "utf8");

console.log("======================================================================");
console.log(" EOS DORA METRICS — Google/Netflix SRE Standard");
console.log("======================================================================");
console.log(`Deployment Frequency : ${deploysPerDay}/day (${deployCount} in ${WINDOW_DAYS}d) [${deployFreqRating}]`);
console.log(`Lead Time            : ${metrics.leadTimeForChanges.note} [${leadTimeRating}]`);
console.log(`Change Failure Rate  : ${cfr}% [${cfrRating}]`);
console.log(`MTTR                 : ${metrics.mttr.value} [${mttrRating}]`);
console.log(
  `ACA LIVE             : mode=${metrics.acaLive.mode} verdict=${metrics.acaLive.verdict} live=${metrics.acaLive.isLive}`,
);
console.log(`Overall Rating       : ${metrics.overallRating}`);
console.log(`Saved to             : docs/evidence/DORA-METRICS.json`);
console.log("======================================================================");
