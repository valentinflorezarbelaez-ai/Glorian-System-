import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Hermetic fleet fixture for Law IV / Unitotal tests.
 *
 * materializeFleetFixture() creates one throwaway checkout per sibling project
 * registered in docs/projects/registry.json (with the canonical .cursor/mcp.json
 * the governance audit expects) and points each project's registered
 * EOS_FLEET_*_PATH env var at it. Tests that depend on fleet disk presence then
 * run deterministically on any machine, without the developer's real sibling
 * checkouts and without writing outside os.tmpdir().
 *
 * disposeFleetFixture() restores the environment so nothing leaks between suites.
 */

/** @param {string} controlPlaneRoot */
function readRegistrySiblings(controlPlaneRoot) {
  const registryPath = path.join(controlPlaneRoot, "docs", "projects", "registry.json");
  const raw = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const entries = Array.isArray(raw?.projects) ? raw.projects : [];
  return entries.filter((p) => p.id !== "eos-system" && typeof p.localPathEnv === "string");
}

/**
 * @param {string} controlPlaneRoot Absolute path of the eos-system checkout.
 * @returns {{ fixtureRoot: string, envNames: string[], complete: boolean }}
 */
export function materializeFleetFixture(controlPlaneRoot) {
  const siblings = readRegistrySiblings(controlPlaneRoot);
  if (siblings.length === 0) {
    return { fixtureRoot: null, envNames: [], complete: false };
  }

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fleet-fixture-"));
  const envNames = [];
  const saved = [];

  for (const project of siblings) {
    const checkoutDir = path.join(fixtureRoot, project.id);
    fs.mkdirSync(path.join(checkoutDir, ".cursor"), { recursive: true });
    fs.writeFileSync(
      path.join(checkoutDir, ".cursor", "mcp.json"),
      JSON.stringify({ mcpServers: {} }, null, 2),
      "utf8",
    );
    envNames.push(project.localPathEnv);
    saved.push(process.env[project.localPathEnv]);
    process.env[project.localPathEnv] = checkoutDir;
  }

  return { fixtureRoot, envNames, complete: true, _saved: saved };
}

/** @param {{ fixtureRoot: string|null, envNames: string[], _saved?: (string|undefined)[] }} fixture */
export function disposeFleetFixture(fixture) {
  if (!fixture) return;
  const { fixtureRoot, envNames, _saved } = fixture;
  envNames.forEach((envName, i) => {
    const previous = _saved ? _saved[i] : undefined;
    if (previous === undefined) delete process.env[envName];
    else process.env[envName] = previous;
  });
  if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
