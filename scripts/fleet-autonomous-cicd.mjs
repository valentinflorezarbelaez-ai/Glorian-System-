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
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const n = Number(out);
    return Number.isFinite(n) ? n : 0;
  } catch {
    try {
      const out = execFileSync("git", ["rev-list", "--count", "origin/main..HEAD"], {
        cwd: checkoutRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
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

// SECURITY: validate every registry entry before any path is used. A tampered
// registry could otherwise inject arbitrary local paths or gate scripts.
function validateRegistryEntry(proj) {
  if (typeof proj.localPath !== "string" || proj.localPath.includes("..")) {
    throw new Error(`invalid localPath in registry for "${proj.id}"`);
  }
  if (proj.cicdGateScript) {
    if (
      typeof proj.cicdGateScript !== "string" ||
      path.isAbsolute(proj.cicdGateScript) ||
      proj.cicdGateScript.includes("..") ||
      !proj.cicdGateScript.match(/^[a-zA-Z0-9_\-./]+$/)
    ) {
      throw new Error(`invalid cicdGateScript in registry for "${proj.id}"`);
    }
  }
  if (proj.productionUrl && !proj.productionUrl.startsWith("https://")) {
    throw new Error(`productionUrl must use https:// for "${proj.id}"`);
  }
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

  if (
    registry &&
    typeof registry === "object" &&
    Array.isArray(registry.projects) &&
    registry.projects.every(
      (project) => project && typeof project === "object" && typeof project.id === "string" && project.id.length > 0,
    ) &&
    new Set(registry.projects.map((project) => project.id)).size === registry.projects.length
  ) {
    const projects = registry.projects;
    try {
      for (const project of projects) validateRegistryEntry(project);
    } catch (err) {
      fail(`Fleet registry rejected: ${err.message}`);
      process.exit(1);
    }
    let selected = projects;
    if (selectedProjectId) selected = projects.filter((project) => project.id === selectedProjectId);

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

    if (canProceed) {
      let productionProbes = 0;
      let healthyProbes = 0;
      let localCheckFailures = 0;
      let shipsCompleted = 0;

      for (const project of selected) {
        console.log(`\n▶ Project: ${project.name} [${project.id}]`);
        const productionUrl = normalizeProductionUrl(project.productionUrl);
        if (effectiveShip && !productionUrl) {
          localCheckFailures++;
          fail(`A valid HTTPS productionUrl is required for ${project.id}. No repository was changed.`);
          break;
        }

        const projectPath = resolveFleetProjectPath(project, root);
        if (!projectPath) {
          console.log(`  Local checkout : NOT CONFIGURED (${project.localPathEnv || "no environment variable"})`);
          if (effectiveShip) {
            localCheckFailures++;
            fail(`Local checkout for ${project.id} is not configured. No repository was changed.`);
            break;
          }
        } else if (!fs.existsSync(projectPath)) {
          console.log("  Local checkout : NOT FOUND");
          if (effectiveShip) {
            localCheckFailures++;
            fail(`Local checkout for ${project.id} was not found. No repository was changed.`);
            break;
          }
        } else {
          let checkoutRoot;
          let changes = "";
          try {
            const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
              cwd: projectPath,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"],
            }).trim();
            checkoutRoot = fs.realpathSync(gitRoot);
            const normalizedPath = fs.realpathSync(projectPath);
            if (checkoutRoot !== normalizedPath) throw new Error("Configured path is not the Git repository root.");

            changes = execFileSync("git", ["status", "--short"], {
              cwd: checkoutRoot,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"],
            }).trim();
            console.log(`  Git checkout   : VERIFIED (${changes ? "working tree has changes" : "clean"})`);
            if (effectiveShip) {
              const expectedRemote = normalizeGitRemote(project.remoteUrl);
              const actualRemote = execFileSync("git", ["remote", "get-url", "origin"], {
                cwd: checkoutRoot,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
              }).trim();
              if (!expectedRemote || normalizeGitRemote(actualRemote) !== expectedRemote) {
                throw new Error("The checkout's origin does not match the repository registered for this project.");
              }
              console.log("  Git remote     : MATCHES REGISTRY");
            }
          } catch (error) {
            localCheckFailures++;
            console.error(`  Git checkout   : CHECK FAILED (${error.message})`);
            if (effectiveShip) {
              fail(`Git checkout validation failed for ${project.id}; no further actions will run.`);
              break;
            }
          }

          if (checkoutRoot && effectiveShip) {
            try {
              runGate(project, checkoutRoot);
              console.log("  CI gate        : PASSED");
            } catch (error) {
              localCheckFailures++;
              console.error(`  CI gate        : FAILED for ${project.id}; skipping push. ${error.message}`);
              if (!isShipAllMode) {
                fail(`CI gate failed for ${project.id}; no commit or push was attempted. ${error.message}`);
                break;
              }
              continue;
            }

            try {
              // Re-read status after the gate because a configured verifier may create receipts.
              changes = execFileSync("git", ["status", "--short"], {
                cwd: checkoutRoot,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
              }).trim();
              if (changes) {
                execFileSync("git", ["add", "-A"], { cwd: checkoutRoot, stdio: "inherit" });
                execFileSync("git", ["commit", "-m", commitMessage], { cwd: checkoutRoot, stdio: "inherit" });
                console.log("  Ship           : local commit completed");
              } else {
                console.log("  Ship           : working tree clean (no new commit)");
              }

              const ahead = countCommitsAheadOfOrigin(checkoutRoot);
              if (ahead === 0) {
                console.log("  Ship           : already synced with upstream (nothing to push)");
              } else {
                console.log(
                  `  Ship           : pushing HEAD to origin (ahead=${ahead < 0 ? "unknown/new-upstream" : ahead})`,
                );
                try {
                  execFileSync("git", ["push", "-u", "origin", "HEAD"], { cwd: checkoutRoot, stdio: "inherit" });
                } catch {
                  console.log("  Ship           : non-fast-forward; attempting pull --rebase then retry push");
                  execFileSync("git", ["pull", "--rebase", "origin", "HEAD"], { cwd: checkoutRoot, stdio: "inherit" });
                  execFileSync("git", ["push", "-u", "origin", "HEAD"], { cwd: checkoutRoot, stdio: "inherit" });
                }
                console.log("  Ship           : push completed (Vercel auto-deploy if linked)");
                shipsCompleted += 1;
              }
            } catch (error) {
              localCheckFailures++;
              console.error(`  Ship           : FAILED for ${project.id}. ${error.message}`);
              if (!isShipAllMode) {
                fail(`Ship operation failed for ${project.id}. ${error.message}`);
                break;
              }
              continue;
            }
          }
        }

        if (productionUrl) {
          productionProbes++;
          let lastError = null;
          let response = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              response = await fetch(productionUrl, {
                cache: "no-store",
                signal: AbortSignal.timeout(12000),
              });
              lastError = null;
              break;
            } catch (error) {
              lastError = error;
              const code = error?.cause?.code || error?.code || "";
              // Transient local resolver failures (ENOTFOUND/EAI_AGAIN) get bounded retries.
              if (!/ENOTFOUND|EAI_AGAIN|UND_ERR_CONNECT|timeout|TimeoutError/i.test(`${code} ${error.message}`)) {
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
            }
          }
          if (response) {
            console.log(`  Production     : HTTP ${response.status}`);
            if (response.status === 200) healthyProbes++;
            else localCheckFailures++;
          } else {
            localCheckFailures++;
            console.log(`  Production     : UNREACHABLE (${lastError?.message || "fetch failed"})`);
          }
        } else {
          console.log("  Production     : NOT CONFIGURED OR INVALID HTTPS URL");
          localCheckFailures++;
        }
      }

      console.log(
        `\nFleet report: ${healthyProbes}/${productionProbes} production probes returned HTTP 200; ${localCheckFailures} check(s) failed or were unreachable; shipsCompleted=${shipsCompleted}.`,
      );
      if (localCheckFailures > 0 || productionProbes === 0) process.exitCode = 1;
      else console.log("All requested checks completed successfully.");
    }
  } else if (registry !== undefined) {
    fail("Fleet registry must contain unique project entries with non-empty string IDs.");
  }
}
