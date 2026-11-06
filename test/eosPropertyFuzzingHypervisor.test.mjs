/**
 * EOS SYSTEM — PROPERTY-BASED FUZZING & TIME-TRAVEL HYPERVISOR TESTS (v64.0.0)
 *
 * Verifies SPEC-058 (CHANGE-051 / ADR-064) Acceptance Criteria:
 * - BDD-209: Generación Determinista de Mutaciones con Semilla Reproducible
 * - BDD-210: Preservación de Invariantes ante Cargas Adversarias Malformadas
 * - BDD-211: Reducción de Contraejemplos (Delta Shrinkage) ante Fallas de Invariantes
 * - BDD-212: Replay Determinista de Estados del Ledger SQLite WAL (Time-Travel)
 * - BDD-213: Evaluación Exhaustiva de los 49 Niveles de Introspección Subconsciente
 * - BDD-214: Despacho MCP de eos_fuzz_hypervisor y Atestación Criptográfica
 *
 * Invariant: Zero external npm dependencies in runtime. Pure node:test and node:assert.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  Mulberry32Prng,
  EosFuzzValueGenerator,
  DeltaShrinker,
  EosTimeTravelHypervisor,
  Eos49LevelsIntrospector,
  EosPropertyFuzzingHypervisor
} from "../src/core/eosPropertyFuzzingHypervisor.ts";

import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { CORE_TIER0_TOOL_NAMES } from "../src/mcp/eosMcpToolCatalog.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-209: Generación Determinista de Mutaciones con Semilla Reproducible", () => {
  const seed = 0x1234abcd;
  const prng1 = new Mulberry32Prng(seed);
  const prng2 = new Mulberry32Prng(seed);

  const seq1 = Array.from({ length: 100 }, () => prng1.nextUint32());
  const seq2 = Array.from({ length: 100 }, () => prng2.nextUint32());

  assert.deepEqual(seq1, seq2, "PRNG streams must be bit-for-bit identical for identical seed");

  const generator = new EosFuzzValueGenerator(new Mulberry32Prng(0xbeefcafe));
  let sawNaN = false;
  let sawInfinity = false;
  let sawBidi = false;

  for (let i = 0; i < 500; i++) {
    const n = generator.generateNumber();
    if (Number.isNaN(n)) sawNaN = true;
    if (!Number.isFinite(n)) sawInfinity = true;

    const s = generator.generateString(64);
    if (s.includes("\u202E")) sawBidi = true;
  }

  assert.ok(sawNaN, "Boundary generator must produce NaN");
  assert.ok(sawInfinity, "Boundary generator must produce Infinity");
  assert.ok(sawBidi, "Boundary generator must produce Bidi RTL overrides");
});

test("BDD-210: Preservación de Invariantes ante Cargas Adversarias Malformadas", () => {
  const hypervisor = new EosPropertyFuzzingHypervisor(projectRoot);
  const campaign = hypervisor.runFuzzCampaign({
    seed: 0xfeedface,
    iterations: 500,
    testJsonRpc: true,
    testDeltaShrinkage: false
  });

  assert.equal(campaign.invariantsViolated, 0, "No invariants must be breached by fuzzing inputs");
  assert.equal(campaign.sanitizationSuccessRate, 1.0, "Sanitization rate must be 100%");
  assert.ok(campaign.passed, "Fuzz campaign must pass");

  // Verify Object prototype was not contaminated
  const testObj = {};
  assert.equal((testObj).polluted, undefined, "Object.prototype must not be polluted");
  assert.equal((testObj).admin, undefined, "Object.prototype must not be polluted with admin");
});

test("BDD-211: Reducción de Contraejemplos (Delta Shrinkage) ante Fallas de Invariantes", () => {
  const failurePredicate = (str) => str.includes("FATAL_ANOMALY");
  const longPayload = "PRE_NOISE_9876543210_FATAL_ANOMALY_POST_NOISE_0123456789_END";

  assert.ok(failurePredicate(longPayload));

  const shrinkage = DeltaShrinker.shrinkString(longPayload, failurePredicate);

  assert.ok(shrinkage.shrinkSteps > 0, "Shrinkage must take >= 1 reduction step");
  assert.ok(
    shrinkage.minimalCounterexample.length < longPayload.length,
    `Counterexample length (${shrinkage.minimalCounterexample.length}) must be smaller than original (${longPayload.length})`
  );
  assert.ok(failurePredicate(shrinkage.minimalCounterexample), "Shrunk counterexample must still violate predicate");
  assert.equal(shrinkage.minimalCounterexample, "FATAL_ANOMALY");
});

test("BDD-212: Replay Determinista de Estados del Ledger SQLite WAL (Time-Travel)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-time-travel-test-"));
  const dbPath = path.join(tmpDir, "replay_test.sqlite");

  try {
    const ledger = new EosDurableSqliteLedger(dbPath);

    // Commit 5 transactions
    for (let i = 1; i <= 5; i++) {
      ledger.appendEntry({
        category: "ARCHITECTURE_DECISION",
        projectId: "eos-system",
        title: `Decision Step ${i}`,
        payload: { step: i, flag: `val_${i * 10}` }
      });
    }

    const replayHypervisor = new EosTimeTravelHypervisor(dbPath);
    const history = replayHypervisor.loadHistory();

    assert.equal(history.totalFrames, 5, "Total frames must match appended entries");
    assert.equal(history.chainVerified, true, "Ledger WAL chain must be valid");
    assert.equal(replayHypervisor.getCursorHeight(), 5, "Initial cursor must be at head (#5)");

    // Seek to height 3
    const seekResult = replayHypervisor.seekToHeight(3);
    assert.equal(seekResult.currentHeight, 3);
    assert.ok(seekResult.frame);
    assert.equal(seekResult.frame.seq, 3);
    assert.equal(seekResult.frame.category, "ARCHITECTURE_DECISION");

    // Step backward
    const frame2 = replayHypervisor.stepBackward();
    assert.ok(frame2);
    assert.equal(frame2.seq, 2);
    assert.equal(replayHypervisor.getCursorHeight(), 2);

    // Step forward
    const frame3 = replayHypervisor.stepForward();
    assert.ok(frame3);
    assert.equal(frame3.seq, 3);
    assert.equal(replayHypervisor.getCursorHeight(), 3);

    // Verify divergence check
    const divCheck = replayHypervisor.detectDivergence(frame3.stateDigest);
    assert.equal(divCheck.diverged, false, "State digest must match expected");
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on Windows lock
    }
  }
});

test("BDD-213: Evaluación Exhaustiva de los 49 Niveles de Introspección Subconsciente", () => {
  const hypervisor = new EosPropertyFuzzingHypervisor(projectRoot);
  const intro = hypervisor.evaluate49Levels();

  assert.equal(intro.totalLevels, 49, "Must evaluate exactly 49 levels");
  assert.equal(intro.passedLevels, 49, "All 49 levels must pass with score >= 90");
  assert.ok(intro.overallQuotient >= 90, `Overall quotient (${intro.overallQuotient}) must be >= 90`);
  assert.equal(intro.status, "PERFECT_SYNCHRONY");
  assert.equal(intro.octaves.length, 7, "Must contain exactly 7 octaves");

  for (const oct of intro.octaves) {
    assert.equal(oct.levels.length, 7, "Each octave must contain 7 sub-levels");
    assert.ok(oct.averageScore >= 90, `Octave average (${oct.averageScore}) must be >= 90`);
  }
});

test("BDD-214: Despacho MCP de eos_fuzz_hypervisor y Atestación Criptográfica", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-mcp-fuzz-test-"));
  const dbPath = path.join(tmpDir, "fuzz_mcp_ledger.sqlite");

  try {
    const server = new EosMcpServer(projectRoot, "full");

    // Verify tool catalog registration in full profile (outside lean core)
    const listRes = server.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    });
    const tools = listRes?.result?.tools || [];
    const fuzzTool = tools.find((t) => t.name === "eos_fuzz_hypervisor");
    assert.ok(fuzzTool, "eos_fuzz_hypervisor must be present in full profile");
    assert.ok(!CORE_TIER0_TOOL_NAMES.has("eos_fuzz_hypervisor"), "eos_fuzz_hypervisor belongs to full profile");

    // Invoke tool
    const callRes = server.handleRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "eos_fuzz_hypervisor",
        arguments: {
          action: "fuzz",
          seed: 0x9999,
          iterations: 200
        }
      }
    });

    assert.ok(callRes?.result?.content?.[0]?.text, "Tool result content must be defined");
    const payload = JSON.parse(callRes.result.content[0].text);
    assert.equal(payload.iterations, 200);
    assert.equal(payload.invariantsViolated, 0);
    assert.ok(payload.passed);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
});
