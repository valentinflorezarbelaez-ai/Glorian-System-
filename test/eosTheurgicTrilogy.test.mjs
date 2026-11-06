/**
 * EOS SYSTEM — THEURGIC TRILOGY UNIT TESTS (v64.0.0)
 *
 * Verifies the Layer-0 Theurgic Trilogy:
 * 1. EosAstral: 5D Molecular Projection & Silver Cord HMAC-SHA256
 * 2. EosElohim: Runa NOT & Karmic Circuit Breaker SHA-384
 * 3. EosAin / EosAbsoluto: The Two Octavic Shocks & Radical Void Zero Entropy
 *
 * Invariant: Pure Layer-0 Node.js test (zero external dependencies).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosAstral } from "../src/core/EosAstral.ts";
import { EosElohim } from "../src/core/EosElohim.ts";
import { EosAin, EosAbsoluto } from "../src/core/EosAin.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("Trilogy Suite 1: EosAstral 5D Ephemeral Projection & Silver Cord Verification", () => {
  const astral = new EosAstral(projectRoot);

  // 1. Project thread
  const thread = astral.projectAstralThread(".worktrees/test-astral");
  assert.ok(thread.threadId.startsWith("ASTRAL-"));
  assert.equal(thread.active, true);
  assert.equal(astral.getActiveThreadsCount(), 1);

  // 2. Verify authentic cord
  const cordValid = astral.verifySilverCord(thread);
  assert.equal(cordValid, true, "Silver Cord must be valid and unbroken");

  // 3. Detect tampered cord
  const tamperedThread = { ...thread, silverCordToken: "a".repeat(64) };
  assert.equal(astral.verifySilverCord(tamperedThread), false, "Tampered Silver Cord must be rejected");

  // 4. Commit mutation with valid cord
  const diffHash = crypto.createHash("sha256").update("AST_DIFF_MOCK").digest("hex");
  const commitRes = astral.commitAstralMutation(thread.threadId, diffHash);
  assert.equal(commitRes.committed, true);
  assert.equal(commitRes.diffHash, diffHash);
  assert.ok(commitRes.sealReceipt.length === 96, "Seal receipt must be 96-char SHA-384 hex");
  assert.equal(astral.getActiveThreadsCount(), 0, "Thread must be dissolved upon commit");
});

test("Trilogy Suite 2: EosElohim Runa NOT & Karmic Circuit Breaker", () => {
  // 1. Normal state - harmony
  const passRes = EosElohim.evaluateKarmicDisruptor({
    tokensConsumed: 1200,
    elapsedMs: 250,
    thoughtHistory: ["Analyze spec", "Draft plan", "Write tests"]
  });
  assert.equal(passRes.status, "PASS_HARMONY");
  assert.equal(passRes.tripped, false);

  // 2. Token Limit Exceeded
  const tokenRes = EosElohim.evaluateKarmicDisruptor({
    tokensConsumed: 60000,
    elapsedMs: 1500,
    maxTokens: 50000
  });
  assert.equal(tokenRes.status, "RUNA_NOT_SEVERED");
  assert.equal(tokenRes.tripped, true);
  assert.equal(tokenRes.violationType, "TOKEN_LIMIT_EXCEEDED");
  assert.ok(tokenRes.sha384Seal);

  // 3. Mechanical Deadlock (>5000ms)
  const deadlockRes = EosElohim.evaluateKarmicDisruptor({
    tokensConsumed: 500,
    elapsedMs: 6500,
    maxElapsedMs: 5000
  });
  assert.equal(deadlockRes.status, "RUNA_NOT_SEVERED");
  assert.equal(deadlockRes.tripped, true);
  assert.equal(deadlockRes.violationType, "MECHANICAL_DEADLOCK");

  // 4. Circular Loop in Subagent Thought History
  const loopRes = EosElohim.evaluateKarmicDisruptor({
    tokensConsumed: 500,
    elapsedMs: 500,
    thoughtHistory: ["Thinking about file X", "Thinking about file X", "Thinking about file X"]
  });
  assert.equal(loopRes.status, "RUNA_NOT_SEVERED");
  assert.equal(loopRes.tripped, true);
  assert.equal(loopRes.violationType, "AGENT_CIRCULAR_LOOP");
});

test("Trilogy Suite 3: EosAin The Two Octavic Shocks & Radical Void Zero Entropy", () => {
  // Shock 1: MI -> FA
  const shock1Fail = EosAin.executeOctavicShock("MI_TO_FA", {
    hasFormalSpec: true,
    hasBddScenarios: false // Missing BDD
  });
  assert.equal(shock1Fail.valid, false, "Must block without BDD");

  const shock1Pass = EosAin.executeOctavicShock("MI_TO_FA", {
    hasFormalSpec: true,
    hasBddScenarios: true
  });
  assert.equal(shock1Pass.valid, true, "Must pass with spec + BDD");
  assert.ok(shock1Pass.sha256Receipt);

  // Shock 2: SI -> DO
  const shock2Fail = EosAin.executeOctavicShock("SI_TO_DO", {
    allTestsPassed: true,
    exitCodeZero: false
  });
  assert.equal(shock2Fail.valid, false);

  const shock2Pass = EosAbsoluto.executeOctavicShock("SI_TO_DO", {
    allTestsPassed: true,
    exitCodeZero: true
  });
  assert.equal(shock2Pass.valid, true, "Must pass with tests + exit code 0");

  // In-place buffer purge to zero entropy
  const buffer = Buffer.from("SECRET_KEY_MATERIAL_CRITICAL_PAYLOAD_1234567890");
  const purgeReceipt = EosAin.purgeBufferToZeroEntropy(buffer);

  assert.equal(purgeReceipt.xorNoiseApplied, true);
  assert.equal(purgeReceipt.zeroFilled, true);
  assert.equal(purgeReceipt.entropyZero, true);
  assert.ok(purgeReceipt.sha384Seal);

  // Assert memory buffer in-place is completely zeroes
  for (let i = 0; i < buffer.length; i++) {
    assert.equal(buffer[i], 0, `Byte at index ${i} must be exactly zero`);
  }
});
