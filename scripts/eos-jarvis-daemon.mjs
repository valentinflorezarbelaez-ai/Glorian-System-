import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const isDaemonLoop = process.argv.includes("--loop");
const cycleIntervalMs = 60_000;
const requestTimeoutMs = 10_000;
let stopRequested = false;

process.once("SIGINT", () => {
  stopRequested = true;
  console.log("\n[JARVIS] Stop requested; finishing the current bounded check.");
});

function configuredHealthUrl() {
  const registryPath = path.join(root, "docs/projects/registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const project = registry.projects?.find((entry) => entry?.id === "eos-system");
  if (typeof project?.productionUrl !== "string") throw new Error("EOS System production URL is not configured.");

  const url = new URL(project.productionUrl);
  if (url.protocol !== "https:") throw new Error("EOS System production URL must use HTTPS.");
  url.pathname = "/api/health";
  url.search = "";
  url.hash = "";
  return url.href;
}

function runLocalChecks() {
  try {
    console.log("\n[1/3] Running bounded local repository checks (no test suite)...");
    execFileSync(process.execPath, [path.join(root, "bin/eos.mjs"), "turbo"], {
      cwd: root,
      stdio: "inherit"
    });
    console.log("[LOCAL CHECKS] PASSED");
    return true;
  } catch (error) {
    console.error(`[LOCAL CHECKS] FAILED (${error.message})`);
    return false;
  }
}

function runFleetChecks() {
  try {
    console.log("\n[2/3] Running fleet registry, local Git, and configured HTTP checks...");
    execFileSync(process.execPath, [path.join(root, "scripts/fleet-autonomous-cicd.mjs")], {
      cwd: root,
      stdio: "inherit"
    });
    console.log("[FLEET CHECKS] PASSED");
    return true;
  } catch (error) {
    console.error(`[FLEET CHECKS] FAILED (${error.message})`);
    return false;
  }
}

async function probeProcessLiveness() {
  try {
    console.log("\n[3/3] Probing the configured EOS process-liveness endpoint...");
    const response = await fetch(configuredHealthUrl(), {
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
    if (response.status !== 200) {
      console.error(`[PRODUCTION PROCESS] FAILED (HTTP ${response.status})`);
      return false;
    }

    const payload = await response.json();
    const live = payload?.status === "UP" && payload?.service?.verificationScope === "PROCESS_LIVENESS_ONLY";
    console.log(`[PRODUCTION PROCESS] ${live ? "UP" : "UNVERIFIED"} (HTTP 200; process liveness only)`);
    return live;
  } catch (error) {
    console.error(`[PRODUCTION PROCESS] UNREACHABLE (${error.message})`);
    return false;
  }
}

async function runAutonomousJarvisCycle() {
  console.log("======================================================================");
  console.log(` EOS LOCAL STATUS MONITOR — ${new Date().toISOString()} `);
  console.log("======================================================================");

  const localChecksPassed = runLocalChecks();
  const fleetChecksPassed = runFleetChecks();
  const processLivenessPassed = await probeProcessLiveness();
  const allChecksPassed = localChecksPassed && fleetChecksPassed && processLivenessPassed;

  console.log(`\n[JARVIS REPORT] Local checks: ${localChecksPassed ? "PASS" : "FAIL"}; fleet checks: ${fleetChecksPassed ? "PASS" : "FAIL"}; production process liveness: ${processLivenessPassed ? "PASS" : "FAIL"}.`);
  return allChecksPassed;
}

do {
  const cyclePassed = await runAutonomousJarvisCycle();
  process.exitCode = cyclePassed ? 0 : 1;
  if (!isDaemonLoop || stopRequested) break;

  await new Promise((resolve) => {
    const onStop = () => {
      clearTimeout(timer);
      process.removeListener("SIGINT", onStop);
      resolve();
    };
    const timer = setTimeout(() => {
      process.removeListener("SIGINT", onStop);
      resolve();
    }, cycleIntervalMs);
    process.once("SIGINT", onStop);
  });
} while (!stopRequested);
