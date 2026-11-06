import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosGithubPrGate } from "../src/core/eosGithubPrGate.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-179: GitHub Actions Environment Context Parsing", () => {
  const mockEnv = {
    GITHUB_REPOSITORY: "acme-corp/financial-core",
    GITHUB_SHA: "abcdef1234567890abcdef1234567890abcdef12",
    GITHUB_REF: "refs/pull/42/merge",
    GITHUB_BASE_REF: "main",
    GITHUB_HEAD_REF: "feat/instant-settlement",
    GITHUB_ACTOR: "alice-architect",
    GITHUB_EVENT_NAME: "pull_request"
  };

  const context = EosGithubPrGate.extractContext(mockEnv);

  assert.equal(context.owner, "acme-corp");
  assert.equal(context.repo, "financial-core");
  assert.equal(context.commitSha, "abcdef1234567890abcdef1234567890abcdef12");
  assert.equal(context.prNumber, 42);
  assert.equal(context.baseRef, "main");
  assert.equal(context.headRef, "feat/instant-settlement");
  assert.equal(context.actor, "alice-architect");
  assert.equal(context.eventName, "pull_request");
});

test("BDD-180: Pre-Merge Contract Compatibility Gate Evaluation (Nominal)", () => {
  const evalResult = EosGithubPrGate.evaluatePr({ projectRoot });

  assert.equal(evalResult.conclusion, "success");
  assert.equal(evalResult.allStagesPassed, true);
  assert.equal(evalResult.contractEvolutionVerdict, "APPROVED");
  assert.equal(evalResult.breakingContractionsCount, 0);
  assert.equal(evalResult.stages.length, 7);
  assert.equal(evalResult.sha256Receipt.length, 64);
  assert.ok(evalResult.receiptId.startsWith("pr_gate_"));
});

test("BDD-181: Check-Run Payload Formatting (GitHub API Standard)", () => {
  const evalResult = EosGithubPrGate.evaluatePr({ projectRoot });
  const payload = EosGithubPrGate.formatCheckRunPayload(evalResult);

  assert.equal(payload.name, "EOS Sovereign Gate");
  assert.equal(payload.status, "completed");
  assert.equal(payload.conclusion, "success");
  assert.ok(payload.output.title.includes("EOS Sovereign Gate"));
  assert.ok(payload.output.summary.includes("SPEC-053"));
  assert.ok(payload.output.text.includes("SecDevOps 7-Stage Quality Matrix"));
});

test("BDD-182: Markdown PR Summary Report Generation", () => {
  const evalResult = EosGithubPrGate.evaluatePr({ projectRoot });
  const md = evalResult.markdownReport;

  assert.ok(md.includes("EOS Sovereign Pull Request Gate Report"));
  assert.ok(md.includes("SecDevOps 7-Stage Quality Matrix"));
  assert.ok(md.includes("Contract Evolution Governance (Nubank Sachem / Buf)"));
  assert.ok(md.includes("Cryptographic Verification Attestation"));
  assert.ok(md.includes(evalResult.sha256Receipt));
});

test("BDD-183: Fail-Closed Merge Barrier Enactment (Breaking Contract Detected)", () => {
  const breachResult = EosGithubPrGate.evaluatePr({
    projectRoot,
    simulateContractBreach: true
  });

  assert.equal(breachResult.conclusion, "failure");
  assert.equal(breachResult.contractEvolutionVerdict, "REJECTED");
  assert.equal(breachResult.breakingContractionsCount, 1);

  const payload = EosGithubPrGate.formatCheckRunPayload(breachResult);
  assert.equal(payload.conclusion, "failure");
  assert.ok(payload.output.title.includes("BLOCKED"));

  // Also test failure in a quality stage (e.g. stage 4 tests failure)
  const stageFailResult = EosGithubPrGate.evaluatePr({
    projectRoot,
    simulateFailureStage: 4
  });

  assert.equal(stageFailResult.conclusion, "failure");
  assert.equal(stageFailResult.allStagesPassed, false);
  assert.equal(stageFailResult.stages[3].passed, false);
});

test("BDD-184: MCP Dispatch of eos_github_gate via EosMcpServer", () => {
  const server = new EosMcpServer(projectRoot);

  // 1. Verify tools/list contains eos_github_gate
  const listRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  });

  assert.ok(!listRes.error);
  const toolNames = listRes.result.tools.map((t) => t.name);
  assert.ok(toolNames.includes("eos_github_gate"));

  // 2. Call context action
  const ctxRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "eos_github_gate",
      arguments: {
        action: "context"
      }
    }
  });

  assert.ok(!ctxRes.error);
  const ctxData = JSON.parse(ctxRes.result.content[0].text);
  assert.equal(typeof ctxData.owner, "string");
  assert.equal(typeof ctxData.repo, "string");

  // 3. Call evaluate action
  const evalRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "eos_github_gate",
      arguments: {
        action: "evaluate"
      }
    }
  });

  assert.ok(!evalRes.error);
  const evalData = JSON.parse(evalRes.result.content[0].text);
  assert.equal(evalData.conclusion, "success");
  assert.equal(evalData.allStagesPassed, true);
  assert.equal(evalData.sha256Receipt.length, 64);
});
