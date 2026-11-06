#!/usr/bin/env node

/**
 * EOS SYSTEM — GENTLEMAN AI STACK UNATTENDED OS SCHEDULER INSTALLER (Layer 1)
 * Governed by SPEC-045, CHANGE-038, ADR-051, FR-141, BDD-137 (v51.0.0)
 *
 * Registers an unattended, zero-window background OS scheduled task that runs
 * `eos gentleman update --apply --quiet` every 6 hours:
 * - Windows: Per-user Scheduled Task `EOS-Gentleman-Stack-AutoUpdate` via `schtasks.exe`
 *   using a silent `wscript.exe //B //NoLogo` (`SW_HIDE`) VBScript launcher (0 console popups).
 * - macOS / Linux: Generates executable shell wrapper in `.eos/state/` and installs/queries user crontab.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, "..");

export const GENTLEMAN_TASK_NAME = "EOS-Gentleman-Stack-AutoUpdate";

export function synthesizeSilentVbsLauncher(nodeExePath, eosBinPath) {
  const escapedNode = String(nodeExePath).replace(/"/g, '""');
  const escapedBin = String(eosBinPath).replace(/"/g, '""');
  return [
    "' EOS System v51.0.0 — Silent Background Launcher for Gentleman Stack Evergreen Auto-Update",
    "Option Explicit",
    "Dim shell, cmd",
    'Set shell = CreateObject("WScript.Shell")',
    `cmd = """${escapedNode}"" ""${escapedBin}"" gentleman update --apply --quiet"`,
    "shell.Run cmd, 0, True",
    ""
  ].join("\r\n");
}

export function synthesizePosixCronLine(nodeExePath, eosBinPath, intervalHours = 6) {
  const safeHours = Math.max(1, Math.min(24, Math.floor(intervalHours)));
  return `0 */${safeHours} * * * "${nodeExePath}" "${eosBinPath}" gentleman update --apply --quiet >/dev/null 2>&1 # ${GENTLEMAN_TASK_NAME}`;
}

export function installGentlemanAutoUpdateSchedule(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || DEFAULT_PROJECT_ROOT);
  const intervalHours = Math.max(1, Math.min(24, Math.floor(options.intervalHours || 6)));
  const dryRun = Boolean(options.dryRun);
  const taskName = options.taskName || GENTLEMAN_TASK_NAME;
  const nodeExePath = options.nodeExePath || process.execPath;
  const eosBinPath = path.join(projectRoot, "bin", "eos.mjs");
  const stateDir = path.join(projectRoot, ".eos", "state");

  fs.mkdirSync(stateDir, { recursive: true });

  if (process.platform === "win32") {
    const vbsPath = path.join(stateDir, "run-gentleman-autoupdate-silent.vbs");
    const vbsContent = synthesizeSilentVbsLauncher(nodeExePath, eosBinPath);
    fs.writeFileSync(vbsPath, vbsContent, "utf8");

    const taskRunCommand = `wscript.exe //B //NoLogo "${vbsPath}"`;
    if (!dryRun) {
      execFileSync(
        "schtasks.exe",
        [
          "/Create",
          "/SC",
          "HOURLY",
          "/MO",
          String(intervalHours),
          "/TN",
          taskName,
          "/TR",
          taskRunCommand,
          "/F"
        ],
        {
          encoding: "utf8",
          timeout: 15000,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        }
      );
    }

    return {
      installed: true,
      dryRun,
      platform: "win32",
      scheduler: "Windows Task Scheduler (schtasks.exe)",
      taskName,
      intervalHours,
      launcherPath: vbsPath,
      taskCommand: taskRunCommand
    };
  }

  // POSIX (Linux / macOS) user crontab registration
  const shPath = path.join(stateDir, "run-gentleman-autoupdate-silent.sh");
  const shContent = [
    "#!/usr/bin/env sh",
    `"${nodeExePath}" "${eosBinPath}" gentleman update --apply --quiet`,
    ""
  ].join("\n");
  fs.writeFileSync(shPath, shContent, { encoding: "utf8", mode: 0o755 });
  const cronLine = synthesizePosixCronLine(nodeExePath, eosBinPath, intervalHours);

  if (!dryRun) {
    let existingCron = "";
    try {
      existingCron = execFileSync("crontab", ["-l"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch {
      existingCron = "";
    }
    const filtered = existingCron
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0 && !line.includes(taskName));
    filtered.push(cronLine);
    const tmpCron = path.join(stateDir, "gentleman.crontab.tmp");
    fs.writeFileSync(tmpCron, filtered.join("\n") + "\n", "utf8");
    try {
      execFileSync("crontab", [tmpCron], { stdio: ["ignore", "pipe", "pipe"] });
    } finally {
      fs.rmSync(tmpCron, { force: true });
    }
  }

  return {
    installed: true,
    dryRun,
    platform: process.platform,
    scheduler: "POSIX crontab",
    taskName,
    intervalHours,
    launcherPath: shPath,
    taskCommand: cronLine
  };
}

export function queryGentlemanAutoUpdateSchedule(options = {}) {
  const taskName = options.taskName || GENTLEMAN_TASK_NAME;
  if (process.platform === "win32") {
    try {
      const out = execFileSync(
        "schtasks.exe",
        ["/Query", "/TN", taskName, "/FO", "LIST", "/V"],
        {
          encoding: "utf8",
          timeout: 10000,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        }
      );
      return {
        registered: true,
        platform: "win32",
        taskName,
        rawDetails: out.trim()
      };
    } catch {
      return {
        registered: false,
        platform: "win32",
        taskName,
        rawDetails: ""
      };
    }
  }

  try {
    const out = execFileSync("crontab", ["-l"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const matched = out
      .split(/\r?\n/)
      .find((line) => line.includes(taskName));
    return {
      registered: Boolean(matched),
      platform: process.platform,
      taskName,
      rawDetails: matched || ""
    };
  } catch {
    return {
      registered: false,
      platform: process.platform,
      taskName,
      rawDetails: ""
    };
  }
}

export function uninstallGentlemanAutoUpdateSchedule(options = {}) {
  const taskName = options.taskName || GENTLEMAN_TASK_NAME;
  if (process.platform === "win32") {
    try {
      execFileSync("schtasks.exe", ["/Delete", "/TN", taskName, "/F"], {
        encoding: "utf8",
        timeout: 10000,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
      return { uninstalled: true, taskName };
    } catch {
      return { uninstalled: false, taskName };
    }
  }

  try {
    const existingCron = execFileSync("crontab", ["-l"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const filtered = existingCron
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0 && !line.includes(taskName));
    const tmpCron = path.join(DEFAULT_PROJECT_ROOT, ".eos", "state", "gentleman.crontab.rm.tmp");
    fs.mkdirSync(path.dirname(tmpCron), { recursive: true });
    fs.writeFileSync(tmpCron, filtered.join("\n") + (filtered.length ? "\n" : ""), "utf8");
    try {
      execFileSync("crontab", [tmpCron], { stdio: ["ignore", "pipe", "pipe"] });
    } finally {
      fs.rmSync(tmpCron, { force: true });
    }
    return { uninstalled: true, taskName };
  } catch {
    return { uninstalled: false, taskName };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const res = installGentlemanAutoUpdateSchedule();
  console.log("======================================================================");
  console.log(" EOS SYSTEM v51.0.0 — GENTLEMAN STACK EVERGREEN SCHEDULER INSTALLER");
  console.log("======================================================================");
  console.log(`  [+] Scheduler      : ${res.scheduler}`);
  console.log(`  [+] Task Name      : ${res.taskName}`);
  console.log(`  [+] Cadence        : Every ${res.intervalHours} hours (silent background)`);
  console.log(`  [+] Silent Launcher: ${res.launcherPath}`);
}
