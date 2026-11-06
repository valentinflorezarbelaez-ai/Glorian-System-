import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveFleetProjectPath } from "./lib/fleet-project-path.mjs";

const root = process.cwd();
const registryFile = path.join(root, "docs/projects/registry.json");
const isShipMode = process.argv.includes("--ship");
const isShipAllMode = process.argv.includes("--ship-all");
const effectiveShip = isShipMode || isShipAllMode;
const getOption = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const selectedProjectId = getOption("--project");
const confirmation = getOption("--confirm-project");
const fleetShipConfirm = getOption("--confirm-fleet-ship");
const commitMessage = getOption("--msg") || "chore: fleet sync and verification";

function fail(message) {
  console.error(`[ERROR] ${message}`);
  process.exitCode = 1;
}

function runGate(project, checkoutRoot) {
  if (typeof project.cicdGateScript !== "string" || project.cicdGateScript.trim() === "") {
    throw new Error("No CI gate script is configured for this project.");
  }

  const configuredPath = project.cicdGateScript.trim();

  // Allow registered npm scripts (e.g. "npm test", "npm run verify") without path traversal.
  if (/^npm(\.cmd)?\s+/i.test(configuredPath)) {
    const tokens = configuredPath.split(/\s+/).filter(Boolean);
    const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
    const npmArgs = tokens.slice(1);
    console.log(`  CI gate        : RUNNING (${configuredPath})`);
    execFileSync(npmBin, npmArgs, { cwd: checkoutRoot, stdio: "inherit", shell: process.platform === "win32" });
    return;
  }

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
  console.log(`  CI gate        : RUNNING (${path.relative(realCheckout, realGate).replace(/\\/g, "/")})`);
  if (extension === ".js" || extension === ".mjs") {
    execFileSync(process.execPath, [realGate], { cwd: realCheckout, stdio: "inherit" });
  } else if (extension === ".ps1") {
    const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
    execFileSync(powershell, ["-NoProfile", "-File", realGate], { cwd: realCheckout, stdio: "inherit" });
  } else {
    throw new Error(`Unsupported CI gate type: ${extension || "no extension"}. Use .js, .mjs, .ps1, or npm <script>.`);
  }
}

function countCommitsAheadOfOrigin(checkoutRoot) {
  try {
    const out = execFileSync("git", ["rev-list", "--count", "@{u}..HEAD"], {
      cwd: checkoutRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    const n = Number(out);
    return Number.isFinite(n) ? n : 0;
  } catch {
    try {
      const out = execFileSync("git", ["rev-list", "--count", "origin/main..HEAD"], {
        cwd: checkoutRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }).trim();
      const n = Number(out);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return -1; // unknown / no upstream yet — still attempt push -u
    }
  }
}

function normalizeProductionUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
  return url.href;
}

function normalizeGitRemote(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  let hostname;
  let repositoryPath;
  try {
    const url = new URL(value.trim());
    if (!["https:", "ssh:", "git:"].includes(url.protocol)) return null;
    hostname = url.hostname;
    repositoryPath = url.pathname;
  } catch {
    const scpRemote = value.trim().match(/^(?:[^@]+@)?([^:]+):(.+)$/);
    if (!scpRemote) return null;
    hostname = scpRemote[1];
    repositoryPath = scpRemote[2];
  }
  const normalizedPath = repositoryPath.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
  if (!hostname || !normalizedPath) return null;
  return `${hostname.toLowerCase()}/${normalizedPath.toLowerCase()}`;
}

if (!fs.existsSync(registryFile)) {
  fail("Fleet registry is missing.");
} else {
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
  } catch {
    fail("Fleet registry is not valid JSON.");
  }

const registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));

// SECURITY: validate all registry entries before use — tampered registry could inject paths
function validateRegistryEntry(proj) {
  // localPath must be an absolute path or start with known base
  if (typeof proj.localPath !== "string" || proj.localPath.includes("..")) {
    throw new Error(`Security: invalid localPath in registry for "${proj.id}": "${proj.localPath}"`);
  }
  // cicdGateScript must be a relative path (no absolute, no traversal)
  if (proj.cicdGateScript) {
    if (
      typeof proj.cicdGateScript !== "string" ||
      path.isAbsolute(proj.cicdGateScript) ||
      proj.cicdGateScript.includes("..") ||
      !proj.cicdGateScript.match(/^[a-zA-Z0-9_\-./]+$/)
    ) {
      throw new Error(`Security: invalid cicdGateScript in registry for "${proj.id}": "${proj.cicdGateScript}"`);
    }
  }
  // productionUrl must be https:// only
  if (proj.productionUrl && !proj.productionUrl.startsWith("https://")) {
    throw new Error(`Security: productionUrl must use https:// for "${proj.id}"`);
  }
}

for (const proj of registry.projects) {
  validateRegistryEntry(proj);
}
let audited = 0;
let healthyCount = 0;

    let canProceed = true;
    if (selected.length === 0) {
      fail(selectedProjectId ? `Unknown project id: ${selectedProjectId}` : "Fleet registry contains no projects.");
      canProceed = false;
    } else if (isShipAllMode) {
      if (fleetShipConfirm !== "AUTHORIZED") {
        fail("Ship-all mode requires --confirm-fleet-ship=AUTHORIZED. No repository was changed.");
        canProceed = false;
      } else if (selectedProjectId) {
        fail("Ship-all mode cannot combine with --project. No repository was changed.");
        canProceed = false;
      }
    } else if (isShipMode && (!selectedProjectId || selected.length !== 1 || confirmation !== selectedProjectId)) {
      fail("Ship mode requires one --project=<id> and a matching --confirm-project=<id>. No repository was changed.");
      canProceed = false;
    }

  if (!fs.existsSync(proj.localPath)) {
    console.log(`  [STATUS] Path not found locally, checking production URL directly...`);
  } else {
    // Check working tree status
    try {
      const statusOutput = execFileSync("git", ["status", "--short"], { cwd: proj.localPath, encoding: "utf8" }).trim();
      const hasChanges = statusOutput.length > 0;
      console.log(`  Working Tree   : ${hasChanges ? "MODIFIED (Pending changes)" : "CLEAN"}`);

      if (hasChanges && isShipMode) {
        console.log(`  [AUTONOMOUS ACTION] Shipping modified project: ${proj.name}...`);
        // Stage only tracked modified files (not untracked new files)
        execFileSync("git", ["add", "--update"], { cwd: proj.localPath, stdio: "inherit" });
        // Run CI gate before committing if a gate script is configured and exists
        const gateScript = path.join(proj.localPath, proj.cicdGateScript || "");
        if (proj.cicdGateScript && fs.existsSync(gateScript)) {
          console.log(`  [CI GATE] Running ${proj.cicdGateScript} before commit...`);
          execFileSync(process.execPath, [gateScript], { cwd: proj.localPath, stdio: "inherit" });
          console.log(`  [CI GATE] PASSED`);
        }
        execFileSync("git", ["commit", "-m", commitMessage], { cwd: proj.localPath, stdio: "inherit" });
        if (proj.remoteUrl) {
          execFileSync("git", ["push", "origin", "HEAD"], { cwd: proj.localPath, stdio: "inherit" });
          console.log(`  [PUSHED] Changes pushed to ${proj.remoteUrl}`);
        }
      }

      console.log(`\nFleet report: ${healthyProbes}/${productionProbes} production probes returned HTTP 200; ${localCheckFailures} check(s) failed or were unreachable; shipsCompleted=${shipsCompleted}.`);
      if (localCheckFailures > 0 || productionProbes === 0) process.exitCode = 1;
      else console.log("All requested checks completed successfully.");
    }
  } else if (registry !== undefined) {
    fail("Fleet registry must contain unique project entries with non-empty string IDs.");
  }
}
