/**
 * EOS SYSTEM — SOVEREIGN FLEET AUTONOMOUS CI/CD DISPATCHER (Layer 0)
 * Governed by ADR-011, FR-018 & BDD-013
 *
 * v11.0.0 — Real health checks: filesystem presence, git cleanliness, and live HTTP probing.
 * Fleet project paths are now resolved from environment variables first, falling back to
 * per-user defaults — eliminating hardcoded absolute Windows paths in source code.
 *
 * Zero external runtime dependencies.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import http from "node:http";
import path from "node:path";

export interface FleetProjectManifest {
  readonly id: string;
  readonly name: string;
  readonly localPath: string;
  readonly remoteUrl: string;
  readonly productionUrl: string;
  readonly type: string;
  readonly status: "REGISTERED" | "UNREGISTERED";
  readonly authorization: "LEVEL_3_PRODUCTION_AUTHORIZED" | "LEVEL_2_AUTHORIZED";
}

export interface FleetProjectStatusReport {
  readonly id: string;
  readonly name: string;
  readonly pathExists: boolean;
  readonly isGitRepo: boolean;
  readonly hooksInjected: boolean;
  readonly workingTreeClean: boolean;
  readonly productionHealth: "HEALTHY_200" | "UNREACHABLE" | "PENDING";
  readonly epistemicState: "PRODUCTION_READY" | "VERIFIED" | "NEEDS_AUDIT";
  readonly gitDirtyFiles: readonly string[];
  readonly healthCheckMs: number;
}

export interface FleetDispatchResult {
  readonly dispatchId: string;
  readonly version: "11.0.0-sovereign-fleet-dispatcher";
  readonly timestamp: string;
  readonly projectsAudited: number;
  readonly allPassFailClosed: boolean;
  readonly reports: readonly FleetProjectStatusReport[];
}

// ---------------------------------------------------------------------------
// Path resolution — env vars override hardcoded defaults (cross-machine safe)
// ---------------------------------------------------------------------------

function resolveFleetPath(envKey: string, defaultRelative: string): string {
  if (process.env[envKey]) {
    return process.env[envKey] as string;
  }
  // Derive from EOS_FLEET_BASE or the OS home dir
  const base =
    process.env["EOS_FLEET_BASE"] ??
    process.env["USERPROFILE"] ??
    process.env["HOME"] ??
    "C:\\Users\\valen";
  return path.join(base, defaultRelative);
}

export const CANONICAL_FLEET_PROJECTS: readonly FleetProjectManifest[] = Object.freeze([
  {
    id: "eos-system",
    name: "EOS System (Control Plane Core)",
    localPath: resolveFleetPath("EOS_PATH_EOS_SYSTEM", "Eos-System"),
    remoteUrl: "https://github.com/valentinflorezarbelaez-ai/Eos-System.git",
    productionUrl: "https://eos-system-ten.vercel.app",
    type: "control-plane-monolith",
    status: "REGISTERED",
    authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
  },
  {
    id: "aberamentho",
    name: "Aberamentho Pleroma Music",
    localPath: resolveFleetPath("EOS_PATH_ABERAMENTHO", "Aberamentho-s-Pleroma-music"),
    remoteUrl: "https://github.com/valentinflorezarbelaez-ai/Aberamentho-s-Pleroma-music.git",
    productionUrl: "https://aberamentosprelomamusic.vercel.app",
    type: "sacred-acoustic-app",
    status: "REGISTERED",
    authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
  },
  {
    id: "portafolio",
    name: "Portafolio Oficial — Valentín Flórez",
    localPath: resolveFleetPath("EOS_PATH_PORTAFOLIO", "portafolio"),
    remoteUrl: "https://github.com/valentinflorezarbelaez-ai/portafolio.git",
    productionUrl: "https://portafolio-valentin.vercel.app",
    type: "executive-showcase",
    status: "REGISTERED",
    authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
  },
  {
    id: "ptg",
    name: "PTG — Performance Talent Group",
    localPath: resolveFleetPath("EOS_PATH_PTG", "Performance-Talent-Group-1"),
    remoteUrl: "https://github.com/valentinflorezarbelaez-ai/Performance-Talent-Group.git",
    productionUrl: "https://ptg-performance-talent-group.vercel.app",
    type: "enterprise-operations",
    status: "REGISTERED",
    authorization: "LEVEL_2_AUTHORIZED",
  },
]);

// ---------------------------------------------------------------------------
// Real git working-tree cleanliness check
// ---------------------------------------------------------------------------

interface GitStatusResult {
  readonly isRepo: boolean;
  readonly isClean: boolean;
  readonly dirtyFiles: readonly string[];
  readonly hooksInjected: boolean;
}

function checkGitStatus(localPath: string): GitStatusResult {
  const gitDir = path.join(localPath, ".git");
  if (!fs.existsSync(gitDir)) {
    return { isRepo: false, isClean: false, dirtyFiles: [], hooksInjected: false };
  }

  let dirtyFiles: string[] = [];
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      cwd: localPath,
      encoding: "utf8",
      timeout: 5_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    dirtyFiles = out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    // git binary unavailable or timeout — treat as unknown dirty state
    dirtyFiles = ["(git-status-unavailable)"];
  }

  const hooksDir = path.join(localPath, ".githooks");
  const hooksInjected = fs.existsSync(hooksDir);

  return {
    isRepo: true,
    isClean: dirtyFiles.length === 0,
    dirtyFiles,
    hooksInjected,
  };
}

// ---------------------------------------------------------------------------
// Real HTTP health probe (non-blocking, with timeout)
// ---------------------------------------------------------------------------

function probeUrl(url: string, timeoutMs = 4_000): Promise<"HEALTHY_200" | "UNREACHABLE"> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("UNREACHABLE"), timeoutMs);
    const lib = url.startsWith("https") ? https : http;

    try {
      const req = lib.get(url, { timeout: timeoutMs }, (res) => {
        clearTimeout(timer);
        const status = res.statusCode ?? 0;
        res.destroy(); // don't read body
        resolve(status >= 200 && status < 400 ? "HEALTHY_200" : "UNREACHABLE");
      });

      req.on("error", () => {
        clearTimeout(timer);
        resolve("UNREACHABLE");
      });

      req.on("timeout", () => {
        clearTimeout(timer);
        req.destroy();
        resolve("UNREACHABLE");
      });
    } catch {
      clearTimeout(timer);
      resolve("UNREACHABLE");
    }
  });
}

// ---------------------------------------------------------------------------
// Sync snapshot (offline mode — no HTTP, fast path for local CI)
// ---------------------------------------------------------------------------

export function evaluateFleetStatusSnapshot(): FleetDispatchResult {
  const reports: FleetProjectStatusReport[] = CANONICAL_FLEET_PROJECTS.map((p) => {
    const pathExists = fs.existsSync(p.localPath);
    const git = pathExists ? checkGitStatus(p.localPath) : { isRepo: false, isClean: false, dirtyFiles: [], hooksInjected: false };

    const epistemicState: FleetProjectStatusReport["epistemicState"] =
      pathExists && git.isRepo && git.isClean ? "PRODUCTION_READY" : "NEEDS_AUDIT";

    return {
      id: p.id,
      name: p.name,
      pathExists,
      isGitRepo: git.isRepo,
      hooksInjected: git.hooksInjected,
      workingTreeClean: git.isClean,
      productionHealth: "PENDING", // sync mode — HTTP not probed; use evaluateFleetStatusAsync for live check
      epistemicState,
      gitDirtyFiles: git.dirtyFiles,
      healthCheckMs: 0,
    };
  });

  const allClean = reports.every((r) => r.workingTreeClean && r.pathExists && r.isGitRepo);

  return {
    dispatchId: `FLEET-DISPATCH-V11-${Date.now()}`,
    version: "11.0.0-sovereign-fleet-dispatcher",
    timestamp: new Date().toISOString(),
    projectsAudited: CANONICAL_FLEET_PROJECTS.length,
    allPassFailClosed: allClean,
    reports,
  };
}

// ---------------------------------------------------------------------------
// Async live-health snapshot (runs real HTTP probes against production URLs)
// ---------------------------------------------------------------------------

export async function evaluateFleetStatusAsync(timeoutMs = 4_000): Promise<FleetDispatchResult> {
  const probeResults = await Promise.all(
    CANONICAL_FLEET_PROJECTS.map(async (p) => {
      const t0 = Date.now();
      const pathExists = fs.existsSync(p.localPath);
      const git = pathExists ? checkGitStatus(p.localPath) : { isRepo: false, isClean: false, dirtyFiles: [], hooksInjected: false };
      const health = await probeUrl(p.productionUrl, timeoutMs);
      const healthCheckMs = Date.now() - t0;

      const epistemicState: FleetProjectStatusReport["epistemicState"] =
        pathExists && git.isRepo && git.isClean && health === "HEALTHY_200"
          ? "PRODUCTION_READY"
          : health === "HEALTHY_200" && git.isClean
            ? "VERIFIED"
            : "NEEDS_AUDIT";

      return {
        id: p.id,
        name: p.name,
        pathExists,
        isGitRepo: git.isRepo,
        hooksInjected: git.hooksInjected,
        workingTreeClean: git.isClean,
        productionHealth: health,
        epistemicState,
        gitDirtyFiles: git.dirtyFiles,
        healthCheckMs,
      } satisfies FleetProjectStatusReport;
    })
  );

  const allPass =
    probeResults.every((r) => r.productionHealth === "HEALTHY_200") &&
    probeResults.every((r) => r.workingTreeClean);

  return {
    dispatchId: `FLEET-DISPATCH-V11-${Date.now()}`,
    version: "11.0.0-sovereign-fleet-dispatcher",
    timestamp: new Date().toISOString(),
    projectsAudited: CANONICAL_FLEET_PROJECTS.length,
    allPassFailClosed: allPass,
    reports: probeResults,
  };
}
