/**
 * Sovereign Multi-Model AI Gateway & Adversarial Consensus Test Suite
 *
 * Verifies BDD-1563..BDD-1568 for SPEC-298 / CHANGE-160.
 * Strict Zero Runtime Dependencies (Law V).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { SovereignAiGateway, CONSTITUTIONAL_INVARIANTS } from "../src/core/eosSovereignAiGateway.ts";

test("BDD-1563: Dynamic Multi-Model Intent-Based Routing", async () => {
  const gateway = new SovereignAiGateway();

  // Test CODE_SYNTHESIS route
  const resCode = await gateway.routeRequest({
    requestId: "req-code-01",
    intent: "CODE_SYNTHESIS",
    prompt: "Write a pure domain entity representing a ledger entry.",
  });

  assert.equal(resCode.provider, "anthropic-claude");
  assert.equal(resCode.model, "claude-3-7-sonnet");
  assert.equal(resCode.cached, false);
  assert.ok(resCode.promptTokens > 0);
  assert.ok(resCode.completionTokens > 0);
  assert.ok(resCode.estimatedCostUsd > 0);

  // Test TRIAGE_FAST route
  const resTriage = await gateway.routeRequest({
    requestId: "req-triage-01",
    intent: "TRIAGE_FAST",
    prompt: "Is this pull request touching package.json?",
  });

  assert.equal(resTriage.provider, "google-gemini");
  assert.equal(resTriage.model, "gemini-2.0-flash");
  assert.equal(resTriage.cached, false);
});

test("BDD-1564: Adversarial Dual-Model Consensus and Architectural Verification", async () => {
  const gateway = new SovereignAiGateway();

  const session = await gateway.runConsensusSession(
    "Validate that no third party dependencies are introduced in domain.",
    {
      providerA: "google-gemini",
      providerB: "anthropic-claude",
      invariants: CONSTITUTIONAL_INVARIANTS,
    },
  );

  assert.ok(session.sessionId.startsWith("consensus-"));
  assert.equal(session.modelA.provider, "google-gemini");
  assert.equal(session.modelB.provider, "anthropic-claude");
  assert.ok(session.divergenceScore >= 0 && session.divergenceScore <= 1.0);
  assert.equal(session.invariantCheckPassed, true);
  assert.equal(session.verdict, "APPROVED");
  assert.ok(session.synthesisSummary.includes("APPROVED"));

  // Check metrics updated
  const metrics = gateway.getMetrics();
  assert.equal(metrics.consensusSessionsRun, 1);
});

test("BDD-1565: Provider Circuit Breaker Tripping and Automatic Failover", async () => {
  const gateway = new SovereignAiGateway();

  const primary = "anthropic-claude";
  assert.equal(gateway.getCircuit(primary).state, "CLOSED");

  // Record 3 failures to trigger circuit trip
  gateway.recordFailure(primary);
  gateway.recordFailure(primary);
  const statusAfter3 = gateway.recordFailure(primary);

  assert.equal(statusAfter3.state, "OPEN");
  assert.equal(statusAfter3.consecutiveFailures, 3);

  // Now route CODE_SYNTHESIS (normally anthropic-claude) -> should failover to openai-gpt
  const failoverRes = await gateway.routeRequest({
    requestId: "req-failover-01",
    intent: "CODE_SYNTHESIS",
    prompt: "Generate an isolated parser without dependencies.",
  });

  assert.equal(failoverRes.provider, "openai-gpt");
  assert.equal(failoverRes.model, "gpt-4o");

  // Reset circuit
  gateway.resetCircuit(primary);
  assert.equal(gateway.getCircuit(primary).state, "CLOSED");
});

test("BDD-1566: Semantic Vector Prompt Cache Matching with Cosine Similarity", async () => {
  const gateway = new SovereignAiGateway();

  const originalPrompt = "Check compliance with Law V zero dependencies.";
  const res1 = await gateway.routeRequest({
    requestId: "req-cache-01",
    intent: "TRIAGE_FAST",
    prompt: originalPrompt,
  });
  assert.equal(res1.cached, false);

  // Submit exact same prompt (similarity = 1.0 >= 0.96)
  const res2 = await gateway.routeRequest({
    requestId: "req-cache-02",
    intent: "TRIAGE_FAST",
    prompt: originalPrompt,
  });

  assert.equal(res2.cached, true);
  assert.equal(res2.estimatedCostUsd, 0);
  assert.ok(res2.latencyMs <= 10);

  const metrics = gateway.getMetrics();
  assert.equal(metrics.cachedRequests, 1);
  assert.ok(metrics.cacheHitRatio > 0);
});

test("BDD-1567: Token Consumption and Spend Ledger Accounting", async () => {
  const gateway = new SovereignAiGateway();

  await gateway.routeRequest({
    requestId: "req-spend-01",
    intent: "DEEP_RESEARCH",
    prompt: "Analyze the state of formal verification tools in WebAssembly runtimes.",
  });

  const metrics = gateway.getMetrics();
  assert.ok(metrics.totalRequests >= 1);
  assert.ok(metrics.totalTokensConsumed > 0);
  assert.ok(metrics.totalEstimatedCostUsd > 0);
});

test("BDD-1568: Cryptographic AI Gateway Audit Receipt Generation", async () => {
  const gateway = new SovereignAiGateway();

  const receipt = await gateway.auditAiGatewayPipeline({
    writeReceipt: true,
    receiptPath: "docs/evidence/AI_GATEWAY_RECEIPT.json",
  });

  assert.equal(receipt.specRef, "SPEC-298");
  assert.ok(receipt.providersAudited.length >= 5);
  assert.ok(receipt.routesEvaluated >= 5);
  assert.ok(receipt.consensusSessionsCount >= 1);
  assert.ok(receipt.sha256Signature.length === 64);

  assert.ok(existsSync("docs/evidence/AI_GATEWAY_RECEIPT.json"));
  const diskReceipt = JSON.parse(readFileSync("docs/evidence/AI_GATEWAY_RECEIPT.json", "utf8"));
  assert.equal(diskReceipt.sha256Signature, receipt.sha256Signature);
});
