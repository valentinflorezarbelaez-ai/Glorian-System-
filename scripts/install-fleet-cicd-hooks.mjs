import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveFleetProjectPath } from "./lib/fleet-project-path.mjs";

const root = process.cwd();
const registryFile = path.join(root, "docs/projects/registry.json");

function fail(message) {
  console.error(`[ERROR] ${message}`);
  process.exitCode = 1;
}

function isPathWithin(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function makeHook(gateRelativePath) {
  const shellPath = gateRelativePath.split(path.sep).join("/");
  return `#!/bin/sh
set -eu
REPO_ROOT=$(git rev-parse --show-toplevel)
GATE_SCRIPT="$REPO_ROOT"/${shellQuote(shellPath)}
case "$GATE_SCRIPT" in
  *.js|*.mjs)
    command -v node >/dev/null 2>&1 || { echo "[EOS] Node.js is required to run the configured CI gate." >&2; exit 1; }
    exec node "$GATE_SCRIPT"
    ;;
  *.ps1)
    if command -v powershell.exe >/dev/null 2>&1; then
      POWERSHELL=powershell.exe
    elif command -v pwsh >/dev/null 2>&1; then
      POWERSHELL=pwsh
    else
      echo "[EOS] PowerShell is required to run the configured CI gate." >&2
      exit 1
    fi
    case "$(uname -s 2>/dev/null || true)" in
      MINGW*|MSYS*|CYGWIN*)
        if command -v cygpath >/dev/null 2>&1; then GATE_SCRIPT=$(cygpath -w "$GATE_SCRIPT"); fi
        ;;
    esac
    exec "$POWERSHELL" -NoProfile -File "$GATE_SCRIPT"
    ;;
  *)
    echo "[EOS] Unsupported configured CI gate type: $GATE_SCRIPT" >&2
    exit 1
    ;;
esac
`;
}

function resolveGate(project, checkoutRoot) {
  if (typeof project.cicdGateScript !== "string" || project.cicdGateScript.trim() === "") {
    throw new Error("No CI gate script is configured for this project.");
  }
  const configuredPath = project.cicdGateScript.trim();
  const gatePath = path.resolve(checkoutRoot, configuredPath);
  const relative = path.relative(checkoutRoot, gatePath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Configured CI gate must stay inside the selected repository.");
  }
  if (!fs.existsSync(gatePath)) throw new Error(`Configured CI gate was not found: ${configuredPath}`);

  const realCheckout = fs.realpathSync(checkoutRoot);
  const realGate = fs.realpathSync(gatePath);
  const realRelative = path.relative(realCheckout, realGate);
  if (realRelative === ".." || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
    throw new Error("Configured CI gate resolves outside the selected repository.");
  }
  if (!fs.statSync(realGate).isFile()) throw new Error("Configured CI gate must be a regular file.");

  const extension = path.extname(realGate).toLowerCase();
  if (![".js", ".mjs", ".ps1"].includes(extension)) {
    throw new Error(`Unsupported CI gate type: ${extension || "no extension"}. Use .js, .mjs, or .ps1.`);
  }
  return path.relative(realCheckout, realGate);
}

console.log("======================================================================");
console.log(" EOS SYSTEM — EXPLICIT FLEET CI GATE HOOK INSTALLER                   ");
console.log("======================================================================");

if (!fs.existsSync(registryFile)) {
  fail(`Missing registry file: ${registryFile}`);
} else {
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
  } catch {
    fail("Fleet registry is not valid JSON.");
  }

  if (registry && typeof registry === "object" && Array.isArray(registry.projects)) {
    const selectedProjectId = process.argv.find((arg) => arg.startsWith("--project="))?.slice("--project=".length);
    const confirmation = process.argv.find((arg) => arg.startsWith("--confirm-project="))?.slice("--confirm-project=".length);
    if (!selectedProjectId || confirmation !== selectedProjectId) {
      fail("Hook installation requires one --project=<id> and a matching --confirm-project=<id>. No repository was changed.");
    } else {
      const projects = Array.isArray(registry.projects) ? registry.projects : [];
      const selectedProjects = projects.filter((project) => project.id === selectedProjectId);
      if (selectedProjects.length !== 1) {
        fail(`Unknown project id: ${selectedProjectId}`);
      } else {
        const project = selectedProjects[0];
        const projectPath = resolveFleetProjectPath(project, root);
        if (!projectPath || !fs.existsSync(projectPath)) {
          fail(`Local checkout for ${project.id} is not configured or does not exist. No repository was changed.`);
        } else {
          try {
            const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
              cwd: projectPath,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"]
            }).trim();
            const checkoutRoot = fs.realpathSync(gitRoot);
            if (checkoutRoot !== fs.realpathSync(projectPath)) throw new Error("Configured path is not the repository root.");

            const gateRelativePath = resolveGate(project, checkoutRoot);
            const hooksDir = path.join(checkoutRoot, ".githooks");
            fs.mkdirSync(hooksDir, { recursive: true });
            const realHooksDir = fs.realpathSync(hooksDir);
            if (!isPathWithin(checkoutRoot, realHooksDir)) {
              throw new Error(".githooks must resolve inside the selected repository.");
            }
            const hookContent = makeHook(gateRelativePath);

            for (const hookName of ["pre-commit", "pre-push"]) {
              const hookPath = path.join(realHooksDir, hookName);
              if (fs.existsSync(hookPath) && !fs.lstatSync(hookPath).isFile()) {
                throw new Error(`${hookName} must be a regular file before it can be replaced.`);
              }
              fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
              fs.chmodSync(hookPath, 0o755);
            }
            execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: checkoutRoot, stdio: "inherit" });
            console.log(`[CONFIGURED] pre-commit and pre-push run ${gateRelativePath} in ${project.name}.`);
          } catch (error) {
            fail(`Could not configure CI gate hooks for ${project.id}: ${error.message}`);
          }
        }
      }
    }
  } else if (registry !== undefined) {
    fail("Fleet registry must contain a projects array.");
  }
}
