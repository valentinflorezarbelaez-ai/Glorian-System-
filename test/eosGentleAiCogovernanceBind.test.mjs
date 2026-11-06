/**
 * SPEC-154 — Glorian ↔ Gentleman Gentle-AI Stack co-governance bind (BDD-472..474)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { EosUniversalAgentSessionContract } from "../src/core/eosUniversalAgentSessionContract.ts";
import { EosGentlemanStackBridge } from "../src/core/eosGentlemanStackBridge.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

test("BDD-472: Preferred ensure persists Gentleman alignment", () => {
  const contract = new EosUniversalAgentSessionContract(projectRoot);
  const ensured = contract.ensurePreferredIdeSession({
    ideFamily: "cursor",
    directive: "SPEC-154 bind Glorian session to Gentleman Gentle-AI Stack"
  });
  assert.ok(ensured.sessionId);
  const alignment = contract.getGentlemanAlignment();
  assert.ok(alignment);
  assert.equal(typeof alignment.readinessScore, "number");
  assert.ok(alignment.readinessScore >= 0 && alignment.readinessScore <= 100);
  assert.ok(alignment.status.length > 0);
  assert.match(alignment.sha256Receipt, /^[a-f0-9]{64}$/);
  assert.equal(alignment.source, "Gentleman-Programming/gentle-ai-stack");
  assert.equal(alignment.protocol.length, EosGentlemanStackBridge.CO_GOVERNANCE_PROTOCOL.length);

  const ledger = JSON.parse(fs.readFileSync(contract.getLedgerPath(), "utf8"));
  assert.ok(ledger.gentlemanAlignment);
  assert.equal(ledger.gentlemanAlignment.sha256Receipt, alignment.sha256Receipt);
});

test("BDD-473: SessionStart message cites Engram and GGA", () => {
  const hook = path.join(projectRoot, "scripts", "eos-ide-session-hook.mjs");
  const proc = spawnSync(process.execPath, [hook, "antigravity", "sessionStart"], {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: 30000,
    input: "{}",
    env: { ...process.env, EOS_PROJECT_ROOT: projectRoot }
  });
  assert.equal(proc.status, 0, proc.stderr || "sessionStart hook failed");
  const body = JSON.parse(proc.stdout.trim());
  const text = String(body.additional_context || body.injectSteps?.[0]?.systemMessage?.systemMessage || "");
  assert.match(text, /engram/i);
  assert.match(text, /gga/i);
  assert.match(text, /eos_agent_session_contract/);
  assert.match(text, /gentle-ai|Gentleman/i);
  assert.ok(body.sessionId);
});

test("BDD-474: MCP align_gentleman dispatch", async () => {
  const server = new EosMcpServer(projectRoot, "full");
  const res = await server.handleRequest({
    jsonrpc: "2.0",
    id: "s154-align",
    method: "tools/call",
    params: {
      name: "eos_agent_session_contract",
      arguments: { action: "align_gentleman" }
    }
  });
  assert.ok(res.result, res.error?.message || "align_gentleman failed");
  const body = JSON.parse(res.result.content[0].text);
  assert.equal(body.action, "align_gentleman");
  assert.ok(body.readinessScore >= 0 && body.readinessScore <= 100);
  assert.equal(body.coGovernanceProtocol.length, 6);
  assert.equal(body.canon.site, "https://gentlemanprogramming.com/");
  assert.equal(body.canon.github, "https://github.com/Gentleman-Programming");
  assert.equal(body.canon.youtubeMain, "https://www.youtube.com/@gentlemanprogramming/videos");
  assert.equal(body.canon.youtubeVods, "https://www.youtube.com/@GentlemanProgrammingVods");
  assert.match(body.canon.author, /Alan Buscaglia/i);
  assert.ok(Array.isArray(body.canon.fourLayers) && body.canon.fourLayers.length === 4);
  assert.ok(Array.isArray(body.canon.operatingPrinciples) && body.canon.operatingPrinciples.length >= 6);
  assert.match(body.divisionOfLabor.glorian, /constitution/i);
  assert.match(body.divisionOfLabor.gentleAi, /Engram/i);
  assert.match(body.divisionOfLabor.gentleAi, /YouTube/i);
});

test("SPEC-154: EXTERNAL_CANON cites Gentleman YouTube main + VODs", () => {
  const canon = EosGentlemanStackBridge.EXTERNAL_CANON;
  assert.equal(canon.youtubeMain, "https://www.youtube.com/@gentlemanprogramming/videos");
  assert.equal(canon.youtubeVods, "https://www.youtube.com/@GentlemanProgrammingVods");
  assert.ok(canon.operatingPrinciples.some((p) => /verification over generation/i.test(p)));
  assert.ok(canon.fourLayers.some((l) => /\bODD\b/.test(l)));
  assert.ok(canon.keyTeachingVideos.some((v) => v.url.includes("youtube.com/watch")));
});
