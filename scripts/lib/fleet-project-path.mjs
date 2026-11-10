import fs from "node:fs";
import path from "node:path";

/** Resolve an explicitly configured checkout without storing host paths in the public registry. */
export function resolveFleetProjectPath(project, projectRoot = process.cwd()) {
  if (!project || typeof project !== "object") return null;
  if (project.id === "eos-system") return path.resolve(projectRoot);

  const envName = project.localPathEnv;
  if (typeof envName === "string" && /^EOS_FLEET_[A-Z0-9_]+_PATH$/.test(envName)) {
    const configuredPath = process.env[envName];
    if (typeof configuredPath === "string" && configuredPath.trim().length > 0) {
      return path.resolve(projectRoot, configuredPath.trim());
    }
  }

  // Fallback to local sibling directory in parent or grandparent workspace if it exists
  if (typeof project.resolvedLocalDir === "string" && project.resolvedLocalDir.length > 0) {
    const parentDir = path.resolve(projectRoot, "..");
    const candidate = path.resolve(parentDir, project.resolvedLocalDir);
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, ".git"))) {
      return candidate;
    }
    const grandparentDir = path.resolve(projectRoot, "../..");
    const gpCandidate = path.resolve(grandparentDir, project.resolvedLocalDir);
    if (fs.existsSync(gpCandidate) && fs.existsSync(path.join(gpCandidate, ".git"))) {
      return gpCandidate;
    }
  }

  return null;
}
