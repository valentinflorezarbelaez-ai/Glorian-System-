#!/usr/bin/env node

/**
 * EOS SYSTEM — ANTIGRAVITY LIFECYCLE HOOK HANDLER (Layer 1 Adapter)
 * Governed by SPEC-043 & SPEC-045, FR-130, FR-141, BDD-126, BDD-136 (v51.0.0)
 *
 * Cross-platform Node.js lifecycle hook for Google Antigravity:
 * - SessionStart:
 *   1. Injects EOS Sovereign Control Plane context once per session.
 *   2. Opportunistically checks `.eos/state/gentleman-auto-update.json` (<2ms) and spawns a
 *      detached, zero-window background Gentleman AI stack update worker when TTL (>6h) is stale.
 * - PreToolUse (run_command): Enforces EOS Gamma Security Barrier (Law VI) in <20ms.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GAMMA_DESTRUCTIVE_PATTERNS = [
  { id: "GAMMA-001-ROOT-WIPE", regex: /(?:^|[;&|]\s*)rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+(?:\/|~|\*|\.\.)(?:\s|$)/i },
  { id: "GAMMA-002-FORCE-PUSH-MAIN", regex: /\bgit\s+push\s+(?:--force|-f)\s+\S+\s+(?:main|master)\b/i },
  { id: "GAMMA-003-SQL-DROP", regex: /\bDROP\s+(?:DATABASE|SCHEMA|TABLE)\b/i },
  { id: "GAMMA-004-DISK-FORMAT", regex: /\b(?:Format-Volume|mkfs\.[a-z0-9]+|diskpart)\b/i },
  {
    id: "GAMMA-005-WIN-SYSTEM-DEL",
    regex: /\b(?:del|erase|rd|rmdir)\s+\/[a-z\s/]*[sq][a-z\s/]*\s+[a-z]:\\(?:\s|$|\*)/i,
  },
];

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const LOCK_STALE_MS = 30 * 60 * 1000;

export function maybeTriggerOpportunisticGentlemanUpdate(projectRoot, options = {}) {
  const ttlMs = typeof options.ttlMs === "number" ? options.ttlMs : DEFAULT_TTL_MS;
  const nowMs = typeof options.nowMs === "number" ? options.nowMs : Date.now();
  const dryRun = Boolean(options.dryRun);

  try {
    const eosBin = path.join(projectRoot, "bin", "eos.mjs");
    if (!fs.existsSync(eosBin)) {
      return { triggered: false, reason: "EOS_BIN_NOT_FOUND" };
    }

    const lockPath = path.join(projectRoot, ".eos", "state", "gentleman-autoupdate.lock");
    if (fs.existsSync(lockPath)) {
      let acquiredAt = fs.statSync(lockPath).mtimeMs;
      try {
        const parsedLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
        if (typeof parsedLock?.acquiredAtMs === "number") acquiredAt = parsedLock.acquiredAtMs;
      } catch {
        // Fallback to stat mtimeMs
      }
      if (nowMs - acquiredAt < LOCK_STALE_MS) {
        return { triggered: false, reason: "LOCK_ACTIVE" };
      }
    }

    const statePath = path.join(projectRoot, ".eos", "state", "gentleman-auto-update.json");
    if (fs.existsSync(statePath)) {
      const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
      if (typeof parsed?.lastCheckedAtMs === "number" && nowMs - parsed.lastCheckedAtMs < ttlMs) {
        return { triggered: false, reason: "FRESH_TTL" };
      }
    }

    if (!dryRun) {
      const child = spawn(process.execPath, [eosBin, "gentleman", "update", "--apply", "--quiet"], {
        cwd: projectRoot,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();
    }

    return { triggered: true, reason: "STALE_TTL_SPAWNED" };
  } catch {
    return { triggered: false, reason: "HOOK_PROBE_ERROR" };
  }
}

export function evaluateHookEvent(eventName, rawStdin) {
  let payload = {};
  if (typeof rawStdin === "string" && rawStdin.trim().length > 0) {
    try {
      payload = JSON.parse(rawStdin);
    } catch {
      payload = {};
    }
  }

  if (eventName === "SessionStart") {
    return {
      injectSteps: [
        {
          systemMessage: {
            systemMessage:
              "EOS Sovereign Control Plane (MCP server `eos-system`) is ACTIVE with Evergreen Gentleman AI Stack Co-Governance. " +
              "For non-trivial engineering, architecture, security, or fleet tasks, invoke `eos_antigravity_direct` via `call_mcp_tool` " +
              '(ServerName: "eos-system") to classify the mission profile, verify Law IV write barriers, and follow the prescribed EOS MCP tool DAG.',
          },
        },
      ],
    };
  }

  if (eventName === "PreToolUse") {
    const args = payload?.toolCall?.args ?? {};
    const commandLine = String(args.CommandLine ?? args.command ?? "");
    for (const rule of GAMMA_DESTRUCTIVE_PATTERNS) {
      if (rule.regex.test(commandLine)) {
        return {
          decision: "deny",
          reason: `Blocked by EOS Gamma Security Barrier (Law VI) [${rule.id}]: Destructive command pattern prohibited.`,
        };
      }
    }
    return { decision: "allow" };
  }

  return {};
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("eos-hook.mjs")) {
  const eventName = process.argv[2] || "SessionStart";
  let rawInput = "";
  try {
    rawInput = fs.readFileSync(0, "utf8");
  } catch {
    rawInput = "";
  }

  if (eventName === "SessionStart" && !process.env.EOS_DISABLE_AUTOUPDATE_HOOK) {
    try {
      const realScript = fs.realpathSync(fileURLToPath(import.meta.url));
      const resolvedProjectRoot = path.resolve(path.dirname(realScript), "..", "..", "..", "..");
      maybeTriggerOpportunisticGentlemanUpdate(resolvedProjectRoot);
    } catch {
      // Never block SessionStart response
    }
  }

  const response = evaluateHookEvent(eventName, rawInput);
  process.stdout.write(JSON.stringify(response) + "\n");
}
