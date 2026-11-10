/**
 * Fleet local path resolver (Layer-0) — SPEC-100 / SPEC-124 / SPEC-132
 * Prefer env overrides, then sibling checkout via resolvedLocalDir.
 * Never hardcodes machine-local absolute user paths (Law VI).
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
  return (
    fs.existsSync(path.join(candidate, "index.html")) &&
    fs.existsSync(path.join(candidate, "vercel.json"))
  );
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
  return out;
}

/** Resolve one registered fleet project to a local git checkout when present. */
export function resolveFleetProjectPath(
  projectRoot: string,
  project: FleetPathProject,
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
    const fromEnv = process.env[envName]?.trim();
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
): readonly ResolvedFleetPath[] {
  return deepFreeze(projects.map((p) => resolveFleetProjectPath(projectRoot, p)));
}
