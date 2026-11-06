#!/usr/bin/env node
/**
 * SPEC-153 — Shared Cursor / Antigravity IDE session hook adapter.
 * Reads the durable SPEC-152 ledger and fail-closes preferred-IDE writes.
 *
 * Usage:
 *   node scripts/eos-ide-session-hook.mjs <ideFamily> <eventName>
 * Events: sessionStart | preToolUse | beforeShellExecution | beforeMCPExecution
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { maybeTriggerOpportunisticGentlemanUpdate } from "../integrations/antigravity/eos-governance/scripts/eos-hook.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const WRITE_TOOL_PATTERN =
  /^(Write|StrReplace|Delete|EditNotebook|search_replace|write_to_file|apply_patch|Edit|Create|DeleteFile)$/i;

const SHELL_WRITE_PATTERN =
  /(?:^|[;&|]\s*)(?:(?:Set-Content|Add-Content|Out-File|ni|New-Item|copy|cp|mv|move|rm|del|erase)\b|>{1,2}|tee\b)/i;

function resolveProjectRoot() {
  if (process.env.EOS_PROJECT_ROOT && fs.existsSync(path.join(process.env.EOS_PROJECT_ROOT, "package.json"))) {
    return path.resolve(process.env.EOS_PROJECT_ROOT);
  }
  if (fs.existsSync(path.join(repoRoot, "package.json"))) return repoRoot;
  return process.cwd();
}

async function loadContract(projectRoot) {
  const modPath = path.join(projectRoot, "src", "core", "eosUniversalAgentSessionContract.ts");
  const mod = await import(pathToFileUrl(modPath));
  return new mod.EosUniversalAgentSessionContract(projectRoot);
}

function pathToFileUrl(filePath) {
  let resolved = path.resolve(filePath);
  if (process.platform === "win32") {
    resolved = resolved.replace(/\\/g, "/");
    if (!resolved.startsWith("/")) resolved = `/${resolved}`;
  }
  return `file://${resolved}`;
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parsePayload(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function extractToolName(payload) {
  return String(
    payload.tool_name ||
      payload.toolName ||
      payload.tool ||
      payload.toolCall?.name ||
      payload.name ||
      ""
  );
}

function extractCommand(payload) {
  return String(
    payload.command ||
      payload.toolCall?.args?.CommandLine ||
      payload.toolCall?.args?.command ||
      payload.arguments?.command ||
      ""
  );
}

function isWriteClassTool(toolName, commandLine) {
  if (WRITE_TOOL_PATTERN.test(toolName)) return true;
  if (toolName === "Shell" || toolName === "run_command" || /shell/i.test(toolName)) {
    return SHELL_WRITE_PATTERN.test(commandLine);
  }
  return false;
}

export async function evaluateIdeSessionHook(ideFamily, eventName, rawStdin, projectRoot = resolveProjectRoot()) {
  const payload = parsePayload(rawStdin);
  const contract = await loadContract(projectRoot);

  if (eventName === "sessionStart" || eventName === "SessionStart") {
    // SPEC-045 FR-141: opportunistic Gentle stack evergreen update (TTL 6h, detached).
    // Cursor and Antigravity SessionStart share this adapter; never block session open.
    let opportunisticUpdate = { triggered: false, reason: "DISABLED" };
    if (!process.env.EOS_DISABLE_AUTOUPDATE_HOOK) {
      try {
        opportunisticUpdate = maybeTriggerOpportunisticGentlemanUpdate(projectRoot);
      } catch {
        opportunisticUpdate = { triggered: false, reason: "HOOK_PROBE_ERROR" };
      }
    }

    const ensured = contract.ensurePreferredIdeSession({
      ideFamily,
      directive:
        "Preferred IDE session for Glorian + Gentleman Gentle-AI co-governance. Complete mandatory MCP DAG before mutating source.",
      target: "eos-system"
    });
    const message = contract.formatCoGovernanceSessionMessage(ideFamily, ensured);
    const alignment = contract.getGentlemanAlignment();
    return {
      // Cursor-shaped
      additional_context: message,
      // Antigravity-shaped
      injectSteps: [{ systemMessage: { systemMessage: message } }],
      sessionId: ensured.sessionId,
      sessionReceipt: ensured.sessionReceipt,
      mandatoryTools: ensured.mandatoryTools,
      opportunisticGentlemanUpdate: opportunisticUpdate,
      gentlemanAlignment: alignment
        ? {
            readinessScore: alignment.readinessScore,
            status: alignment.status,
            sha256Receipt: alignment.sha256Receipt
          }
        : null
    };
  }

  if (
    eventName === "preToolUse" ||
    eventName === "PreToolUse" ||
    eventName === "beforeShellExecution"
  ) {
    const toolName = extractToolName(payload);
    const commandLine = extractCommand(payload);

    // Always keep Gamma destructive shell denials out of this script; Antigravity eos-hook owns Gamma.
    if (!isWriteClassTool(toolName, commandLine) && eventName !== "beforeShellExecution") {
      return { permission: "allow", decision: "allow" };
    }
    if (eventName === "beforeShellExecution" && !SHELL_WRITE_PATTERN.test(commandLine)) {
      return { permission: "allow", decision: "allow" };
    }

    const decision = contract.evaluatePreferredWriteGate(ideFamily, [
      String(payload.file_path || payload.path || commandLine || toolName)
    ]);
    if (decision.decision === "allow") {
      return { permission: "allow", decision: "allow", reason: decision.reason };
    }
    const agentMessage =
      `Blocked by Glorian SPEC-153 (${ideFamily}): ${decision.reason}. ` +
      `Complete mandatory MCP DAG tools first` +
      (decision.missingTools?.length ? `: ${decision.missingTools.join(", ")}` : "") +
      `, then retry.`;
    return {
      permission: "deny",
      decision: "deny",
      reason: agentMessage,
      user_message: agentMessage,
      agent_message: agentMessage,
      missingTools: decision.missingTools
    };
  }

  if (eventName === "beforeMCPExecution") {
    // Observational allow; MCP server auto-records DAG tools on dispatch.
    return { permission: "allow", decision: "allow" };
  }

  return { permission: "allow", decision: "allow" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const ideFamily = process.argv[2] || "cursor";
  const eventName = process.argv[3] || "sessionStart";
  const raw = readStdin();
  evaluateIdeSessionHook(ideFamily, eventName, raw)
    .then((response) => {
      process.stdout.write(JSON.stringify(response) + "\n");
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : "IDE session hook failed";
      process.stdout.write(
        JSON.stringify({
          permission: "deny",
          decision: "deny",
          reason: message,
          agent_message: message,
          user_message: message
        }) + "\n"
      );
    });
}
