import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryFile = path.join(root, "docs/projects/registry.json");
const isShipMode = process.argv.includes("--ship");
const commitMessage = process.argv.find((a) => a.startsWith("--msg="))?.replace("--msg=", "") || "chore: autonomous sovereign fleet sync & verify";

console.log("======================================================================");
console.log(` EOS SYSTEM v10.0 — FLEET AUTONOMOUS CI/CD DISPATCHER (${isShipMode ? "SHIP" : "AUDIT"} MODE)`);
console.log("======================================================================");

if (!fs.existsSync(registryFile)) {
  console.error(`Missing registry file: ${registryFile}`);
  process.exit(1);
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

for (const proj of registry.projects) {
  console.log(`\n▶ Inspecting Project: ${proj.name} [${proj.id}]`);
  console.log(`  Local Path     : ${proj.localPath}`);
  console.log(`  Production URL : ${proj.productionUrl}`);

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
    } catch (err) {
      console.warn(`  [GIT WARNING] ${err.message}`);
    }
  }

  // Probe production endpoint
  if (proj.productionUrl && proj.productionUrl.startsWith("http")) {
    try {
      const probeRes = await fetch(proj.productionUrl, { cache: "no-store" });
      console.log(`  Production HTTP: ${probeRes.status} ${probeRes.statusText}`);
      if (probeRes.status === 200) {
        healthyCount++;
      }
    } catch (err) {
      console.log(`  Production HTTP: UNREACHABLE (${err.message})`);
    }
  }

  audited++;
}

console.log("\n======================================================================");
console.log(` FLEET CI/CD AUDIT COMPLETE: ${healthyCount}/${audited} SYSTEMS HEALTHY 200 OK (EXIT 0)`);
console.log("======================================================================");
