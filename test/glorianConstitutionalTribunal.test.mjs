/**
 * Specification Test Suite for SPEC-135: Glorian Multi-Model Consensus Engine & Constitutional Tribunal
 * Acceptance Criteria: BDD-356, BDD-357, BDD-358
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GlorianConstitutionalTribunal } from "../src/core/glorianConstitutionalTribunal.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

test("BDD-356: 3-Judge Constitutional Adjudication with Quorum Consensus", () => {
  const tribunal = new GlorianConstitutionalTribunal(root);

  const compliantRequest = {
    actionId: "MUT-001-HEALTH-WATCHDOG",
    category: "ARCHITECTURE",
    description: "Formal implementation of Glorian Fleet Health Watchdog governed by SPEC-134 with zero vibe coding and Layer-0 purity.",
    diffOrPayload: "export class GlorianFleetHealthWatchdog { /* Pure Layer-0 logic */ }",
    targetDirectory: "src/core",
    declaredInvariants: ["SafetyInvariant", "AntiSsrfIsolationInvariant"]
  };

  const report = tribunal.adjudicate(compliantRequest);

  assert.equal(report.actionId, "MUT-001-HEALTH-WATCHDOG");
  assert.equal(report.overallVerdict, "SOVEREIGN_TRIBUNAL_APPROVED");
  assert.ok(report.compositeScore >= 80, `Expected score >= 80, got ${report.compositeScore}`);
  assert.equal(report.quorumMet, true);
  assert.equal(report.vetoCount, 0);
  assert.equal(report.approvalsCount, 3);
  assert.equal(report.judges.length, 3);
  assert.equal(report.sha256Receipt.length, 64);

  const formatted = tribunal.formatTribunalSummary(report);
  assert.ok(formatted.includes("GLORIAN CONSTITUTIONAL TRIBUNAL"));
  assert.ok(formatted.includes("SOVEREIGN_TRIBUNAL_APPROVED"));
});

test("BDD-357: Automatic Veto on Plaintext Secret or External Directory Write Violation", () => {
  const tribunal = new GlorianConstitutionalTribunal(root);

  // Scenario A: Plaintext API Secret Detection (Law VI)
  const secretPayloadRequest = {
    actionId: "MUT-002-SECRET-LEAK",
    category: "CODE_MUTATION",
    description: "Improvised API client with embedded developer token.",
    diffOrPayload: 'const apiKey = "' + ['sk', 'ant', 'simulated_leak_test_token_12345'].join('-') + '";',
    targetDirectory: "src/core"
  };

  const reportA = tribunal.adjudicate(secretPayloadRequest);
  assert.equal(reportA.overallVerdict, "TRIBUNAL_VETOED");
  assert.ok(reportA.vetoCount >= 1);
  const secJudgeA = reportA.judges.find((j) => j.judge === "SECURITY_JUDGE");
  assert.equal(secJudgeA?.veto, true);
  assert.ok(secJudgeA?.findings.some((f) => f.includes("Law VI Fatal Violation")));

  // Scenario B: External Write Barrier Breach (Law IV)
  const externalWriteRequest = {
    actionId: "MUT-003-WRITE-BARRIER",
    category: "CODE_MUTATION",
    description: "Write operation targeting external foundation project directory without level 2+ gate.",
    diffOrPayload: "fs.writeFileSync(targetFile, content);",
    targetDirectory: "C:\\Users\\valen\\Documents\\Fundacion\\secret-doc.txt"
  };

  const reportB = tribunal.adjudicate(externalWriteRequest);
  assert.equal(reportB.overallVerdict, "TRIBUNAL_VETOED");
  assert.ok(reportB.vetoCount >= 1);
  const secJudgeB = reportB.judges.find((j) => j.judge === "SECURITY_JUDGE");
  assert.equal(secJudgeB?.veto, true);
  assert.ok(secJudgeB?.findings.some((f) => f.includes("Law IV Fatal Violation")));
});

test("BDD-358: MCP Tool Dispatch & SQLite WAL Receipt Attestation", () => {
  const mcpServer = new EosMcpServer(root, "full");

  // Verify tool presence in tools/list
  const toolsResponse = mcpServer.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  });

  const tools = toolsResponse?.result?.tools || [];
  const tribunalTool = tools.find((t) => t.name === "glorian_constitutional_tribunal");
  assert.ok(tribunalTool, "glorian_constitutional_tribunal tool must be exposed via MCP");

  // Dispatch tool
  const callResponse = mcpServer.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "glorian_constitutional_tribunal",
      arguments: {
        actionId: "MCP-001-INSPECTION",
        category: "ARCHITECTURE",
        description: "Adjudication of system elevation under SPEC-135 with formal contracts.",
        diffOrPayload: "export const version = '93.0.0';",
        targetDirectory: "src/core",
        declaredInvariants: ["SafetyInvariant"]
      }
    }
  });

  assert.ok(callResponse?.result);
  assert.ok(!callResponse?.error);
  const payload = JSON.parse(callResponse?.result?.content[0]?.text);
  assert.equal(payload.overallVerdict, "SOVEREIGN_TRIBUNAL_APPROVED");
  assert.equal(payload.quorumMet, true);
  assert.equal(payload.sha256Receipt.length, 64);
});
