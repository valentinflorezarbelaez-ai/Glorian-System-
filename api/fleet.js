import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";

/**
 * EOS SYSTEM — FLEET AUTONOMOUS CI/CD DISPATCHER SERVERLESS ENDPOINT (/api/fleet)
 * v11.0.0 — Real filesystem, git, and HTTP health checks.
 *            Fleet paths resolved from env vars — no hardcoded Windows paths.
 * Zero external dependencies.
 */

// ---------------------------------------------------------------------------
// Path resolution (mirrors eosFleetDispatcher.ts — env-first, cross-machine)
// ---------------------------------------------------------------------------
function resolveFleetPath(envKey, defaultRelative) {
  if (process.env[envKey]) return process.env[envKey];
  const base =
    process.env["EOS_FLEET_BASE"] ??
    process.env["USERPROFILE"] ??
    process.env["HOME"] ??
    "C:\\Users\\valen";
  return path.join(base, defaultRelative);
}

const FLEET_PROJECTS = [
  {
    id: "eos-system",
    name: "EOS System (Control Plane Core)",
    localPath: resolveFleetPath("EOS_PATH_EOS_SYSTEM", "Eos-System"),
    remote: "https://github.com/valentinflorezarbelaez-ai/Eos-System.git",
    productionUrl: "https://eos-system-ten.vercel.app",
    authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
  },
  {
    id: "aberamentho",
    name: "Aberamentho Pleroma Music",
    localPath: resolveFleetPath("EOS_PATH_ABERAMENTHO", "Aberamentho-s-Pleroma-music"),
    remote: "https://github.com/valentinflorezarbelaez-ai/Aberamentho-s-Pleroma-music.git",
    productionUrl: "https://aberamentosprelomamusic.vercel.app",
    authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
  },
  {
    id: "portafolio",
    name: "Portafolio Oficial — Valentín Flórez",
    localPath: resolveFleetPath("EOS_PATH_PORTAFOLIO", "portafolio"),
    remote: "https://github.com/valentinflorezarbelaez-ai/portafolio.git",
    productionUrl: "https://portafolio-valentin.vercel.app",
    authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
  },
  {
    id: "ptg",
    name: "PTG — Performance Talent Group",
    localPath: resolveFleetPath("EOS_PATH_PTG", "Performance-Talent-Group-1"),
    remote: "https://github.com/valentinflorezarbelaez-ai/Performance-Talent-Group.git",
    productionUrl: "https://ptg-performance-talent-group.vercel.app",
    authorization: "LEVEL_2_AUTHORIZED",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkGitStatus(localPath) {
  const gitDir = path.join(localPath, ".git");
  if (!fs.existsSync(gitDir)) {
    return { isRepo: false, isClean: false, dirtyFiles: [] };
  }
  let dirtyFiles = [];
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      cwd: localPath,
      encoding: "utf8",
      timeout: 4_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    dirtyFiles = out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    dirtyFiles = ["(git-status-unavailable)"];
  }
  return { isRepo: true, isClean: dirtyFiles.length === 0, dirtyFiles };
}

function probeUrl(url, timeoutMs = 4_000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("UNREACHABLE"), timeoutMs);
    const lib = url.startsWith("https") ? https : http;
    try {
      const req = lib.get(url, { timeout: timeoutMs }, (res) => {
        clearTimeout(timer);
        const code = res.statusCode ?? 0;
        res.destroy();
        resolve(code >= 200 && code < 400 ? "HEALTHY_200" : "UNREACHABLE");
      });
      req.on("error", () => { clearTimeout(timer); resolve("UNREACHABLE"); });
      req.on("timeout", () => { clearTimeout(timer); req.destroy(); resolve("UNREACHABLE"); });
    } catch {
      clearTimeout(timer);
      resolve("UNREACHABLE");
    }
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function _handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=120");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const action = (req.query && req.query.action) || "status";
  const liveProbe = action === "live"; // ?action=live triggers real HTTP probes

  // Run real checks for every project in parallel
  const reports = await Promise.all(
    FLEET_PROJECTS.map(async (p) => {
      const t0 = Date.now();
      const pathExists = fs.existsSync(p.localPath);
      const git = pathExists
        ? checkGitStatus(p.localPath)
        : { isRepo: false, isClean: false, dirtyFiles: [] };

      const productionHealth = liveProbe
        ? await probeUrl(p.productionUrl)
        : "PENDING"; // skip HTTP probe for fast sync mode

      const healthCheckMs = Date.now() - t0;

      const epistemicState =
        pathExists && git.isRepo && git.isClean && productionHealth === "HEALTHY_200"
          ? "PRODUCTION_READY"
          : pathExists && git.isClean && !liveProbe
            ? "VERIFIED" // sync mode — no HTTP verdict yet
            : "NEEDS_AUDIT";

      return {
        id: p.id,
        name: p.name,
        localPath: p.localPath,
        remoteUrl: p.remote,
        productionUrl: p.productionUrl,
        authorization: p.authorization,
        pathExists,
        isGitRepo: git.isRepo,
        workingTreeClean: git.isClean,
        gitDirtyFiles: git.dirtyFiles,
        productionHealth,
        epistemicState,
        healthCheckMs,
      };
    })
  );

  const allHealthy = reports.every(
    (r) => r.workingTreeClean && (liveProbe ? r.productionHealth === "HEALTHY_200" : true)
  );

  const digest = crypto
    .createHash("sha256")
    .update(`EOS_FLEET_V11:${reports.map((r) => r.id + r.epistemicState).join(":")}`)
    .digest("hex");

  return res.status(200).json({
    status: allHealthy ? "FLEET_FULLY_HEALTHY" : "FLEET_NEEDS_AUDIT",
    version: "11.0.0-sovereign-fleet-dispatcher",
    liveProbeMode: liveProbe,
    fleetSize: FLEET_PROJECTS.length,
    allPassFailClosed: allHealthy,
    note: liveProbe
      ? "Live HTTP probes executed against all production URLs."
      : "Sync mode — filesystem & git only. Use ?action=live for full HTTP probe.",
    commands: {
      fleetShip: "npm run fleet:ship",
      fleetVerify: "npm run fleet:verify",
      fleetInjectHooks: "npm run fleet:hooks",
    },
    reports,
    merkleDigest: `sha256:${digest}`,
  });
}

// Rate limiting — 10 req/min burst per IP (git/HTTP calls per request)
import { withRateLimit } from "../src/core/eosApiRateLimit.ts";
export default withRateLimit({ capacity: 10, refillPerSecond: 0.17 })(_handler);
