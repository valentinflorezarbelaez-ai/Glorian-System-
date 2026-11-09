/**
 * LLMOps privacy lane hermetic gates.
 * WITHIN_TESTED_SCOPE — policy only; not hardware TEE / NSA claims.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  EosLlmOpsPrivacyLane,
  containsPlaintextSecret,
  evaluatePrivacyLane,
  resolvePrivacyLaneMode,
} from "../src/core/eosLlmOpsPrivacyLane.ts";

test("BDD-LLMOPS-PRIVACY-001: default mode is cloud_allowed", () => {
  assert.equal(resolvePrivacyLaneMode({}), "cloud_allowed");
});

test("BDD-LLMOPS-PRIVACY-002: local lane rejects remote OpenAI endpoint", () => {
  const decision = evaluatePrivacyLane({
    promptOrPayload: "summarize this AST outline",
    providerOrEndpoint: "https://api.openai.com/v1/chat/completions",
    env: { EOS_LLM_PRIVACY_LANE: "local" },
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.code, "REJECT_REMOTE_PROVIDER");
});

test("BDD-LLMOPS-PRIVACY-003: open_weight lane allows localhost open-weight endpoint", () => {
  const decision = evaluatePrivacyLane({
    promptOrPayload: "format and lint this file",
    providerOrEndpoint: "http://127.0.0.1:11434/api/generate",
    preferLocalSlm: true,
    env: { EOS_LLM_PRIVACY_LANE: "open_weight" },
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.code, "ALLOW_LOCAL");
  assert.equal(decision.mode, "open_weight");
});

test("BDD-LLMOPS-PRIVACY-004: plaintext API key always fail-closed", () => {
  // Assemble at runtime so the repo secret-scan does not treat fixtures as live keys.
  const fakeKey = ["sk", "-", "abcdefghijklmnopqrstuvwxyz", "0123456789"].join("");
  assert.equal(containsPlaintextSecret(`Authorization: Bearer ${fakeKey}`), true);
  const decision = EosLlmOpsPrivacyLane.evaluate(`key=${fakeKey}`, "http://127.0.0.1:11434", {
    env: { EOS_LLM_PRIVACY_LANE: "cloud_allowed" },
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.code, "REJECT_PLAINTEXT_SECRET");
});

test("BDD-LLMOPS-PRIVACY-005: cloud_allowed admits remote without secrets", () => {
  const decision = evaluatePrivacyLane({
    promptOrPayload: "prove TLA+ invariants",
    providerOrEndpoint: "claude-3-7-sonnet",
    env: {},
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.code, "ALLOW_CLOUD");
});
