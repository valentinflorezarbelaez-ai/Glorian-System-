/**
 * SPEC-153 — Cursor & Antigravity session hook enforcement (BDD-467..471)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  EosUniversalAgentSessionContract,
  PREFERRED_IDE_FAMILIES
} from "../src/core/eosUniversalAgentSessionContract.ts";
import { evaluateHookEvent } from "../integrations/antigravity/eos-governance/scripts/eos-hook.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

test("BDD-467: Durable ledger shared across processes", () => {
  const a = new EosUniversalAgentSessionContract(projectRoot);
  const opened = a.openSession({
    ideFamily: "cursor",
    directive: "SPEC-153 durable ledger probe across process boundaries",
    target: "eos-system"
  });
  const b = new EosUniversalAgentSessionContract(projectRoot);
  const active = b.getActiveSessionForIde("cursor");
  assert.ok(active);
  assert.equal(active.sessionId, opened.sessionId);
  assert.equal(active.sessionReceipt, opened.sessionReceipt);
  assert.ok(fs.existsSync(a.getLedgerPath()));
});

test("BDD-468: Preferred SessionStart ensure", () => {
  assert.deepEqual([...PREFERRED_IDE_FAMILIES], ["cursor", "antigravity"]);
  const contract = new EosUniversalAgentSessionContract(projectRoot);
  const ensured = contract.ensurePreferredIdeSession({
    ideFamily: "antigravity",
    directive: "Ensure preferred Antigravity session for SPEC-153"
  });
  assert.ok(ensured.sessionId);
  assert.ok(ensured.mandatoryTools.length >= 1);
  const again = contract.ensurePreferredIdeSession({ ideFamily: "antigravity" });
  assert.equal(again.sessionId, ensured.sessionId);
});

test("BDD-469: Cursor write deny then allow after DAG", () => {
  const contract = new EosUniversalAgentSessionContract(projectRoot);
  const opened = contract.ensurePreferredIdeSession({
    ideFamily: "cursor",
    directive: "SPEC-153 write gate deny-then-allow probe"
  });
  // Fresh session: incomplete DAG
  // Re-open to guarantee incomplete completed set for this probe id
  const fresh = contract.openSession({
    ideFamily: "cursor",
    directive: "SPEC-153 fresh incomplete DAG for write gate",
    target: "eos-system"
  });
  const denied = contract.evaluatePreferredWriteGate("cursor");
  assert.equal(denied.decision, "deny");
  assert.equal(denied.reason, "MANDATORY_DAG_INCOMPLETE");
  for (const tool of fresh.mandatoryTools) {
    contract.recordToolInvocation(fresh.sessionId, tool);
  }
  const allowed = contract.evaluatePreferredWriteGate("cursor");
  assert.equal(allowed.decision, "allow");
  assert.equal(allowed.sessionId, fresh.sessionId);
  assert.ok(opened.sessionId);
});

test("BDD-470: Antigravity hook SessionStart mentions session contract", () => {
  const sessionHookResult = {
    sessionId: "test-session-153",
    mandatoryTools: ["eos_turbo_verify"],
    sessionReceipt: "a".repeat(64)
  };
  const sessionRes = evaluateHookEvent("SessionStart", "{}", {
    projectRoot,
    sessionHookResult
  });
  const msg = sessionRes.injectSteps[0].systemMessage.systemMessage;
  assert.ok(msg.includes("eos_antigravity_direct"));
  assert.ok(msg.includes("eos_agent_session_contract"));
  assert.ok(msg.includes("sessionId=test-session-153"));
  assert.ok(msg.includes("Gentleman") || msg.includes("gentle-ai") || msg.includes("Engram"));
});

test("BDD-471: Cursor hook script denies Write without DAG", () => {
  const contract = new EosUniversalAgentSessionContract(projectRoot);
  contract.openSession({
    ideFamily: "cursor",
    directive: "SPEC-153 cursor hook deny probe incomplete DAG",
    target: "eos-system"
  });
  const hook = path.join(projectRoot, "scripts", "eos-ide-session-hook.mjs");
  const proc = spawnSync(
    process.execPath,
    [hook, "cursor", "preToolUse"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 15000,
      input: JSON.stringify({ tool_name: "Write", file_path: "src/core/example.ts" }),
      env: { ...process.env, EOS_PROJECT_ROOT: projectRoot }
    }
  );
  assert.equal(proc.status, 0, proc.stderr || "hook failed");
  const body = JSON.parse(proc.stdout.trim());
  assert.equal(body.permission, "deny");
  assert.equal(body.decision, "deny");
});

test("BDD-136 Cursor: SessionStart reports opportunistic Gentleman update decision", async () => {
  const { evaluateIdeSessionHook } = await import("../scripts/eos-ide-session-hook.mjs");
  const prev = process.env.EOS_DISABLE_AUTOUPDATE_HOOK;
  process.env.EOS_DISABLE_AUTOUPDATE_HOOK = "1";
  try {
    const body = await evaluateIdeSessionHook("cursor", "sessionStart", "{}", projectRoot);
    assert.ok(body.sessionId);
    assert.equal(body.opportunisticGentlemanUpdate.triggered, false);
    assert.equal(body.opportunisticGentlemanUpdate.reason, "DISABLED");
  } finally {
    if (prev === undefined) delete process.env.EOS_DISABLE_AUTOUPDATE_HOOK;
    else process.env.EOS_DISABLE_AUTOUPDATE_HOOK = prev;
  }
});

test("BDD-126 regression: npm test still allowed; Gamma still denies force-push", () => {
  const allowRes = evaluateHookEvent(
    "PreToolUse",
    JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine: "npm run test" } } }),
    { projectRoot, writeGateResult: { decision: "allow" } }
  );
  assert.deepEqual(allowRes, { decision: "allow" });

  const denyRes = evaluateHookEvent(
    "PreToolUse",
    JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine: "git push --force origin main" } } }),
    { projectRoot }
  );
  assert.equal(denyRes.decision, "deny");
});
