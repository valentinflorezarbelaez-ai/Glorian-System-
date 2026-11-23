/**
 * Fleet local path resolver + audit posture (Layer-0) — SPEC-100 / SPEC-124 / SPEC-132
 * Prefer env overrides, then sibling checkout via resolvedLocalDir.
 * Never hardcodes machine-local absolute user paths (Law VI).
 *
 * Posture (P1-2 / PR-G): CONTROL_PLANE_ONLY vs FLEET_VERIFIED.
 * IF any EOS_FLEET_*_PATH is unset, THEN do not claim live Soundcheck success.
 */

import fs from "node:fs";
import path from "node:path";

import { deepFreeze } from "./eosKernelPrimitives.ts";

export interface FleetPathProject {
  readonly id: string;
  readonly name?: string;
  readonly localPathEnv?: string;
  readonly localPath?: string;
  readonly resolvedLocalDir?: string;
}

export interface ResolvedFleetPath {
  readonly id: string;
  readonly name: string;
  readonly path: string | null;
  readonly status: "AVAILABLE" | "SKIPPED_SIBLING";
  readonly localPathEnv: string | null;
  readonly resolution: "ENV" | "CONTROL_PLANE" | "LOCAL_PATH" | "RESOLVED_LOCAL_DIR" | "NONE";
}

function isGitCheckout(candidate: string): boolean {
  return fs.existsSync(candidate) && fs.existsSync(path.join(candidate, ".git"));
}

/**
 * Require a usable project root — empty `git init` residue from failed CI checkouts must not count.
 * Node apps: `package.json`. Static Vercel sites (e.g. donaciones): `index.html` + `vercel.json`.
 */
function hasFleetProjectMarker(candidate: string): boolean {
  if (fs.existsSync(path.join(candidate, "package.json"))) return true;
  return fs.existsSync(path.join(candidate, "index.html")) && fs.existsSync(path.join(candidate, "vercel.json"));
}

function isUsableFleetCheckout(candidate: string): boolean {
  return isGitCheckout(candidate) && hasFleetProjectMarker(candidate);
}

function workspaceCandidates(projectRoot: string, resolvedLocalDir: string): string[] {
  const dir = resolvedLocalDir.trim();
  const out: string[] = [];
  const envRoot = process.env.EOS_WORKSPACE_ROOT?.trim();
  if (envRoot) out.push(path.resolve(envRoot, dir));
  out.push(path.resolve(projectRoot, "..", dir));
  out.push(path.resolve(projectRoot, "../..", dir));
  return out;
}

/** Resolve one registered fleet project to a local git checkout when present. */
export function resolveFleetProjectPath(
  projectRoot: string,
  project: FleetPathProject,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedFleetPath {
  const id = String(project.id || "").trim();
  const name = String(project.name || id);
  const envName = typeof project.localPathEnv === "string" ? project.localPathEnv.trim() : "";

  if (id === "eos-system") {
    return deepFreeze({
      id,
      name,
      path: path.resolve(projectRoot),
      status: "AVAILABLE",
      localPathEnv: envName || null,
      resolution: "CONTROL_PLANE",
    });
  }

  if (envName && /^EOS_FLEET_[A-Z0-9_]+_PATH$/.test(envName)) {
    const fromEnv = env[envName]?.trim();
    if (fromEnv) {
      const candidate = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(projectRoot, fromEnv);
      if (isUsableFleetCheckout(candidate)) {
        return deepFreeze({
          id,
          name,
          path: path.resolve(candidate),
          status: "AVAILABLE",
          localPathEnv: envName,
          resolution: "ENV",
        });
      }
    }
  }

  if (typeof project.localPath === "string" && project.localPath.trim()) {
    const candidate = path.resolve(project.localPath.trim());
    if (isUsableFleetCheckout(candidate)) {
      return deepFreeze({
        id,
        name,
        path: candidate,
        status: "AVAILABLE",
        localPathEnv: envName || null,
        resolution: "LOCAL_PATH",
      });
    }
  }

  if (typeof project.resolvedLocalDir === "string" && project.resolvedLocalDir.trim()) {
    for (const candidate of workspaceCandidates(projectRoot, project.resolvedLocalDir)) {
      if (isUsableFleetCheckout(candidate)) {
        return deepFreeze({
          id,
          name,
          path: path.resolve(candidate),
          status: "AVAILABLE",
          localPathEnv: envName || null,
          resolution: "RESOLVED_LOCAL_DIR",
        });
      }
    }
  }

  return deepFreeze({
    id,
    name,
    path: null,
    status: "SKIPPED_SIBLING",
    localPathEnv: envName || null,
    resolution: "NONE",
  });
}

/** Resolve all registry projects. */
export function resolveFleetRegistryPaths(
  projectRoot: string,
  projects: readonly FleetPathProject[],
  env: NodeJS.ProcessEnv = process.env,
): readonly ResolvedFleetPath[] {
  return deepFreeze(projects.map((p) => resolveFleetProjectPath(projectRoot, p, env)));
}

/** Explicit fleet dogfood postures advertised in receipts and environment docs. */
export type FleetAuditPosture = "CONTROL_PLANE_ONLY" | "FLEET_VERIFIED";

export interface FleetPathEnvStatus {
  readonly projectId: string;
  readonly localPathEnv: string;
  readonly envSet: boolean;
  readonly isControlPlane: boolean;
}

export interface FleetPostureSnapshot {
  readonly posture: FleetAuditPosture;
  /** True only when posture is FLEET_VERIFIED (paths mounted for live audit). */
  readonly fleetLiveAudit: boolean;
  readonly registeredProjects: number;
  readonly controlPlaneProjects: number;
  readonly siblingProjects: number;
  readonly envPathsDeclared: number;
  readonly envPathsUnset: readonly string[];
  readonly siblingsAvailable: number;
  readonly siblingsSkipped: number;
  readonly resolved: readonly ResolvedFleetPath[];
  readonly reason: string;
}

const FLEET_ENV_RE = /^EOS_FLEET_[A-Z0-9_]+_PATH$/;

function isControlPlaneProject(project: FleetPathProject): boolean {
  return String(project.id || "").trim() === "eos-system";
}

/** List registered EOS_FLEET_*_PATH keys and whether each is set in the process env. */
export function listFleetPathEnvStatus(
  projects: readonly FleetPathProject[],
  env: NodeJS.ProcessEnv = process.env,
): readonly FleetPathEnvStatus[] {
  const out: FleetPathEnvStatus[] = [];
  for (const project of projects) {
    const envName = typeof project.localPathEnv === "string" ? project.localPathEnv.trim() : "";
    if (!envName || !FLEET_ENV_RE.test(envName)) continue;
    const raw = env[envName];
    const envSet = typeof raw === "string" && raw.trim().length > 0;
    out.push(
      deepFreeze({
        projectId: String(project.id || "").trim(),
        localPathEnv: envName,
        envSet,
        isControlPlane: isControlPlaneProject(project),
      }),
    );
  }
  return deepFreeze(out);
}

/**
 * Evaluate fleet posture from registry projects + process env + disk resolution.
 *
 * FLEET_VERIFIED requires:
 * 1. Every declared EOS_FLEET_*_PATH is set (including control-plane env when declared)
 * 2. Every non-control-plane sibling resolves AVAILABLE
 *
 * Otherwise CONTROL_PLANE_ONLY with fleetLiveAudit: false.
 */
export function evaluateFleetPosture(
  projectRoot: string,
  projects: readonly FleetPathProject[],
  env: NodeJS.ProcessEnv = process.env,
): FleetPostureSnapshot {
  const envStatuses = listFleetPathEnvStatus(projects, env);
  const envPathsUnset = envStatuses.filter((e) => !e.envSet).map((e) => e.localPathEnv);
  const resolved = resolveFleetRegistryPaths(projectRoot, projects, env);
  const controlPlaneProjects = projects.filter((p) => isControlPlaneProject(p)).length;
  const siblingResolved = resolved.filter((r) => r.id !== "eos-system");
  const siblingsAvailable = siblingResolved.filter((r) => r.status === "AVAILABLE").length;
  const siblingsSkipped = siblingResolved.filter((r) => r.status === "SKIPPED_SIBLING").length;

  const allEnvsSet = envPathsUnset.length === 0 && envStatuses.length > 0;
  const allSiblingsMounted = siblingResolved.length > 0 && siblingsSkipped === 0;
  const verified = allEnvsSet && allSiblingsMounted;

  let reason: string;
  if (verified) {
    reason =
      "All registered EOS_FLEET_*_PATH values are set and every sibling checkout resolves AVAILABLE.";
  } else if (envPathsUnset.length > 0) {
    reason = `Unset fleet path env(s): ${envPathsUnset.join(", ")}. Advertise CONTROL_PLANE_ONLY; do not claim live Soundcheck success.`;
  } else if (envStatuses.length === 0) {
    reason = "No EOS_FLEET_*_PATH declarations on registry projects; default CONTROL_PLANE_ONLY.";
  } else {
    reason = `Fleet path envs are set but ${siblingsSkipped} sibling checkout(s) are SKIPPED_SIBLING; CONTROL_PLANE_ONLY until dogfood mounts succeed.`;
  }

  return deepFreeze({
    posture: verified ? "FLEET_VERIFIED" : "CONTROL_PLANE_ONLY",
    fleetLiveAudit: verified,
    registeredProjects: projects.length,
    controlPlaneProjects,
    siblingProjects: siblingResolved.length,
    envPathsDeclared: envStatuses.length,
    envPathsUnset,
    siblingsAvailable,
    siblingsSkipped,
    resolved,
    reason,
  });
}

/** Compact receipt fields safe to embed in LOCAL-CHECKS / fleet audit receipts (no host paths). */
export function fleetPostureReceiptFields(snapshot: FleetPostureSnapshot): Record<string, unknown> {
  return deepFreeze({
    posture: snapshot.posture,
    fleetLiveAudit: snapshot.fleetLiveAudit,
    envPathsDeclared: snapshot.envPathsDeclared,
    envPathsUnsetCount: snapshot.envPathsUnset.length,
    envPathsUnset: [...snapshot.envPathsUnset],
    siblingsAvailable: snapshot.siblingsAvailable,
    siblingsSkipped: snapshot.siblingsSkipped,
    reason: snapshot.reason,
  });
}
