#!/usr/bin/env node

/**
 * EOS SYSTEM — ANTIGRAVITY LIFECYCLE HOOK HANDLER (Layer 1 Adapter)
 * Governed by SPEC-043, SPEC-045, SPEC-152, SPEC-153
 *
 * - SessionStart: inject EOS director context + ensure preferred Antigravity session (SPEC-153)
 * - PreToolUse (run_command): Gamma Law VI + preferred write-gate for mutating shells
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GAMMA_DESTRUCTIVE_PATTERNS = [
  { id: "GAMMA-001-ROOT-WIPE", regex: /(?:^|[;&|]\s*)rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+(?:\/|~|\*|\.\.)(?:\s|$)/i },
  { id: "GAMMA-002-FORCE-PUSH-MAIN", regex: /\bgit\s+push\s+(?:--force|-f)\s+\S+\s+(?:main|master)\b/i },
  { id: "GAMMA-003-SQL-DROP", regex: /\bDROP\s+(?:DATABASE|SCHEMA|TABLE)\b/i },
  { id: "GAMMA-004-DISK-FORMAT", regex: /\b(?:Format-Volume|mkfs\.[a-z0-9]+|diskpart)\b/i },
  { id: "GAMMA-005-WIN-SYSTEM-DEL", regex: /\b(?:del|erase|rd|rmdir)\s+\/[a-z\s/]*[sq][a-z\s/]*\s+[a-z]:\\(?:\s|$|\*)/i }
];

const SHELL_WRITE_PATTERN =
  /(?:^|[;&|]\s*)(?:(?:Set-Content|Add-Content|Out-File|ni|New-Item|copy|cp|mv|move|rm|del|erase)\b|>{1,2}|tee\b)/i;

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const LOCK_STALE_MS = 30 * 60 * 1000;

function resolveProjectRootFromHook() {
  try {
    const realScript = fs.realpathSync(fileURLToPath(import.meta.url));
    return path.resolve(path.dirname(realScript), "..", "..", "..", "..");
  } catch {
    return process.cwd();
  }
}

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
      const child = spawn(
        process.execPath,
        [eosBin, "gentleman", "update", "--apply", "--quiet"],
        {
          cwd: projectRoot,
          detached: true,
          stdio: "ignore",
          windowsHide: true
        }
      );
      child.unref();
    }

    return { triggered: true, reason: "STALE_TTL_SPAWNED" };
  } catch {
    return { triggered: false, reason: "HOOK_PROBE_ERROR" };
  }
}

function syncEnsureAntigravitySession(projectRoot) {
  try {
    const hookScript = path.join(projectRoot, "scripts", "eos-ide-session-hook.mjs");
    if (!fs.existsSync(hookScript)) return null;
    const proc = spawnSync(process.execPath, [hookScript, "antigravity", "SessionStart"], {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 8000,
      input: "{}"
    });
    if (proc.status !== 0 || !proc.stdout) return null;
    return JSON.parse(proc.stdout.trim());
  } catch {
    return null;
  }
}

function syncEvaluateWriteGate(projectRoot, commandLine) {
  try {
    const hookScript = path.join(projectRoot, "scripts", "eos-ide-session-hook.mjs");
    if (!fs.existsSync(hookScript)) return { decision: "allow" };
    const proc = spawnSync(process.execPath, [hookScript, "antigravity", "PreToolUse"], {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 8000,
      input: JSON.stringify({
        toolCall: { name: "run_command", args: { CommandLine: commandLine } }
      })
    });
    if (proc.status !== 0 || !proc.stdout) return { decision: "allow" };
    return JSON.parse(proc.stdout.trim());
  } catch {
    return { decision: "allow" };
  }
}

export function evaluateHookEvent(eventName, rawStdin, options = {}) {
  let payload = {};
  if (typeof rawStdin === "string" && rawStdin.trim().length > 0) {
    try {
      payload = JSON.parse(rawStdin);
    } catch {
      payload = {};
    }
  }

  const projectRoot = options.projectRoot || resolveProjectRootFromHook();

  if (eventName === "SessionStart") {
    const sessionHook = options.sessionHookResult || syncEnsureAntigravitySession(projectRoot);
    const sessionBit = sessionHook?.sessionId
      ? ` EOS/Glorian SPEC-154 antigravity sessionId=${sessionHook.sessionId}. ` +
        `Gentleman Gentle-AI readiness=${sessionHook.gentlemanAlignment?.readinessScore ?? "?"}/100 (${sessionHook.gentlemanAlignment?.status || "pending"}). ` +
        `Mandatory Glorian DAG before writes: ${(sessionHook.mandatoryTools || []).join(", ")}. ` +
        `Co-govern with Engram (mem_context/mem_save), Context7, agent-teams-lite sdd-*, GGA, and eos_agent_session_contract.`
      : " EOS/Glorian SPEC-154: call eos_agent_session_contract action=ensure ideFamily=antigravity, then align_gentleman, before mutating source.";

    return {
      injectSteps: [
        {
          systemMessage: {
            systemMessage:
              "EOS/Glorian Sovereign Control Plane (MCP `eos-system`) co-governs with Gentleman Programming Gentle-AI Stack " +
              "(https://gentlemanprogramming.com/ · https://github.com/Gentleman-Programming · " +
              "https://www.youtube.com/@gentlemanprogramming/videos · https://www.youtube.com/@GentlemanProgrammingVods): " +
              "gentle-ai, engram, gga, context7, agent-teams-lite; ODD+SDD; verification over generation. " +
              "Glorian = constitution, Law IV, session write gates. Gentle AI = memory, ODD workflow, review. " +
              "For non-trivial work invoke `eos_antigravity_direct`, recall Engram, then follow the prescribed MCP DAG." +
              sessionBit
          }
        }
      ]
    };
  }

  if (eventName === "PreToolUse") {
    const args = payload?.toolCall?.args ?? {};
    const commandLine = String(args.CommandLine ?? args.command ?? "");
    for (const rule of GAMMA_DESTRUCTIVE_PATTERNS) {
      if (rule.regex.test(commandLine)) {
        return {
          decision: "deny",
          reason: `Blocked by EOS Gamma Security Barrier (Law VI) [${rule.id}]: Destructive command pattern prohibited.`
        };
      }
    }

    if (SHELL_WRITE_PATTERN.test(commandLine)) {
      const gate = options.writeGateResult || syncEvaluateWriteGate(projectRoot, commandLine);
      if (gate.decision === "deny" || gate.permission === "deny") {
        return {
          decision: "deny",
          reason: gate.reason || gate.agent_message || "Blocked by Glorian SPEC-153 Antigravity write gate."
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

  const projectRoot = resolveProjectRootFromHook();

  if (eventName === "SessionStart" && !process.env.EOS_DISABLE_AUTOUPDATE_HOOK) {
    try {
      maybeTriggerOpportunisticGentlemanUpdate(projectRoot);
    } catch {
      // Never block SessionStart response
    }
  }

  const response = evaluateHookEvent(eventName, rawInput, { projectRoot });
  process.stdout.write(JSON.stringify(response) + "\n");
}
